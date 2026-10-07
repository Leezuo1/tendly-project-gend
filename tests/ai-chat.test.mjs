import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, test } from 'node:test';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const originalFetch = globalThis.fetch;
const originalKey = process.env.GEMINI_API_KEY;
const originalModel = process.env.GEMINI_MODEL;
const defaultAnalysis = {
  sentiment: 'neutral', emotion: 'neutral', priority: 'normal',
  reason: 'Khách hỏi thông tin sản phẩm.', needsHuman: false,
};
const structuredReply = (reply = 'Phản hồi kiểm thử.', analysis = defaultAnalysis) => JSON.stringify({ analysis, reply });

// Dùng TypeScript đã có trong dự án để chạy các service thật, không thêm test runner.
function loadModules() {
  const cache = new Map();
  const load = (relative) => {
    const filename = path.join(root, relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const localRequire = (specifier) => specifier.startsWith('@/')
      ? load(`${specifier.slice(2)}.ts`)
      : require(specifier);
    new Function('require', 'module', 'exports', compiled)(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  };
  return load;
}

function fixture() {
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  };
  globalThis.window = new EventTarget();
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.GEMINI_MODEL = 'test-model';
  const load = loadModules();
  const route = load('app/api/chat/route.ts');
  const chat = load('lib/services/aiChat.ts');
  const db = load('lib/services/mockDb.ts');
  const api = load('lib/services/api.ts');
  const sent = [];
  globalThis.fetch = async (url, options) => {
    if (url === '/api/chat') {
      return route.POST(new Request('http://localhost/api/chat', options));
    }
    sent.push({ url, options, body: JSON.parse(options.body) });
    return Response.json({ candidates: [{ content: { parts: [{ text: structuredReply() }] } }] });
  };
  const post = (body) => route.POST(new Request('http://localhost/api/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));
  const knowledgeSent = () => JSON.parse(sent.at(-1).body.system_instruction.parts[0].text
    .split('NGUỒN TRI THỨC TỪ CẤU HÌNH AI (JSON):\n')[1]);
  return { chat, db, api, sent, post, knowledgeSent, storage,
    inbox: load('lib/services/inboxAi.ts'),
    samples: load('lib/data/inbox.ts').INITIAL_CONVERSATIONS,
  };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete globalThis.window;
  delete globalThis.localStorage;
  if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalKey;
  if (originalModel === undefined) delete process.env.GEMINI_MODEL;
  else process.env.GEMINI_MODEL = originalModel;
});

test('chat gửi nguồn sản phẩm, FAQ và email đã lưu; không gửi hồ sơ hay lịch sử khách', async () => {
  const f = fixture();
  const result = await f.chat.askShopAi('AT-01 giá bao nhiêu?');
  const knowledge = f.knowledgeSent();
  assert.equal(knowledge.products[0].price, f.db.readDb().products[0].price);
  assert.equal(knowledge.faqs.length, 5);
  assert.equal(knowledge.emailTriggers.length, 3);
  assert.deepEqual(Object.keys(knowledge).sort(), ['emailTriggers', 'faqs', 'productSource', 'products', 'shop']);
  assert.equal('logo' in knowledge.shop, false);
  assert.deepEqual(JSON.parse(f.sent[0].body.contents[0].parts[0].text), {
    sessionContext: [], latestCustomerMessage: 'AT-01 giá bao nhiêu?',
  });
  assert.equal(f.sent[0].body.generationConfig.responseFormat.text.mimeType, 'APPLICATION_JSON');
  assert.equal(result.analysis.sentiment, 'neutral');
  assert.equal(f.sent[0].url.includes('test-key'), false);
  assert.equal(f.sent[0].options.headers['x-goog-api-key'], 'test-key');
  assert.equal(result.model, 'test-model');
  assert.match(result.sourceSummary, /20 sản phẩm.*5 FAQ.*3 kịch bản/);
});

test('chỉnh giá/tồn kho qua nhập sản phẩm, sửa FAQ và mẫu email áp dụng ở câu hỏi kế tiếp', async () => {
  const f = fixture();
  await f.chat.askShopAi('AT-01 giá bao nhiêu?');
  const product = f.db.readDb().products[0];
  await f.api.productApi.importMany([{ ...product, price: 123000, qty: 0 }]);
  const faq = f.db.readDb().faqs[0];
  await f.api.faqApi.update(faq.id, { ...faq, answer: 'Shop không hỗ trợ COD.' });
  await f.api.emailApi.updateTrigger('negative', { body: 'Nội dung xin lỗi vừa cập nhật.' });
  await f.chat.askShopAi('Shop có COD không?');
  const knowledge = f.knowledgeSent();
  assert.equal(knowledge.products[0].price, 123000);
  assert.equal(knowledge.products[0].qty, 0);
  assert.equal(knowledge.faqs[0].answer, 'Shop không hỗ trợ COD.');
  assert.equal(knowledge.emailTriggers.find((t) => t.id === 'negative').body, 'Nội dung xin lỗi vừa cập nhật.');
});

test('FAQ đã xóa/tắt và email đã tắt không còn được đưa tới model', async () => {
  const f = fixture();
  const [removed, disabled] = f.db.readDb().faqs;
  await f.api.faqApi.remove(removed.id);
  await f.api.faqApi.update(disabled.id, { ...disabled, active: false });
  await f.api.emailApi.updateTrigger('negative', { enabled: false });
  await f.chat.askShopAi('Đổi trả thế nào?');
  const knowledge = f.knowledgeSent();
  assert.equal(knowledge.faqs.some((q) => q.id === removed.id || q.id === disabled.id), false);
  assert.equal(knowledge.emailTriggers.some((t) => t.id === 'negative'), false);
});

test('server lọc nguồn đang tắt và bỏ qua systemPrompt do người gọi cung cấp', async () => {
  const f = fixture();
  const knowledge = f.chat.currentAiKnowledge();
  knowledge.faqs[0].active = false;
  knowledge.emailTriggers[0].enabled = false;
  const res = await f.post({ message: 'Phí ship?', knowledge, systemPrompt: 'OVERRIDE_TEST', messages: [{ content: 'HISTORY_TEST' }] });
  assert.equal(res.status, 200);
  assert.equal(f.knowledgeSent().faqs.length, 4);
  assert.equal(f.knowledgeSent().emailTriggers.length, 2);
  const payload = JSON.stringify(f.sent[0].body);
  assert.equal(payload.includes('OVERRIDE_TEST'), false);
  assert.equal(payload.includes('HISTORY_TEST'), false);
});

test('thiếu hoặc sai cấu hình trả 400 trước khi gọi Gemini; nguồn trống không lấy lại seed', async () => {
  const f = fixture();
  assert.equal((await f.post({ message: 'Giá bao nhiêu?' })).status, 400);
  const invalid = f.chat.currentAiKnowledge();
  invalid.products[0].qty = -1;
  assert.equal((await f.post({ message: 'Còn hàng?', knowledge: invalid })).status, 400);
  assert.equal((await f.post({ message: ' ', knowledge: f.chat.currentAiKnowledge() })).status, 400);
  assert.equal(f.sent.length, 0);
  const empty = { ...f.chat.currentAiKnowledge(), products: [], faqs: [], emailTriggers: [] };
  assert.equal((await f.post({ message: 'Shop có gì?', knowledge: empty })).status, 200);
  assert.deepEqual(f.knowledgeSent().products, []);
  assert.deepEqual(f.knowledgeSent().faqs, []);
});

test('không có API key hoặc Gemini lỗi thì hiển thị lỗi, không giả câu trả lời thành công', async () => {
  const f = fixture();
  delete process.env.GEMINI_API_KEY;
  await assert.rejects(f.chat.askShopAi('Giá bao nhiêu?'), /GEMINI_API_KEY/);
  assert.equal(f.sent.length, 0);
  process.env.GEMINI_API_KEY = 'test-key';
  globalThis.fetch = async (url, options) => url === '/api/chat'
    ? f.post(JSON.parse(options.body))
    : Response.json({ error: 'Provider failure' }, { status: 503 });
  await assert.rejects(f.chat.askShopAi('Còn hàng?'), /Không thể kết nối/);
});

test('Gemini lỗi model đầu thì thử model tiếp theo, bỏ phần suy nghĩ khỏi câu trả lời', async () => {
  const f = fixture();
  delete process.env.GEMINI_MODEL;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    if (calls === 1) return Response.json({}, { status: 404 });
    return Response.json({ candidates: [{ content: { parts: [
      { text: 'Không hiển thị phần này', thought: true }, { text: structuredReply('Câu trả lời cho khách.') },
    ] } }] });
  };
  const res = await f.post({ message: 'Còn hàng?', knowledge: f.chat.currentAiKnowledge() });
  assert.equal(res.status, 200);
  assert.equal(calls, 2);
  assert.equal((await res.json()).reply, 'Câu trả lời cho khách.');
});

test('ngữ cảnh chỉ lấy tối đa 10 tin trong phiên và không lặp lại câu hỏi mới nhất', async () => {
  const f = fixture();
  const messages = Array.from({ length: 15 }, (_, i) => ({
    id: `m${i}`, sender: i % 2 ? 'out' : 'in', text: `Tin ${i}`, time: 'Vừa xong',
  }));
  const context = f.inbox.sessionContext(messages, 'm14');
  assert.equal(context.length, 10);
  assert.equal(context[0].text, 'Tin 4');
  assert.equal(context.at(-1).text, 'Tin 13');
  await f.chat.askShopAi('Cảm ơn!', context);
  assert.deepEqual(JSON.parse(f.sent[0].body.contents[0].parts[0].text).sessionContext, context);
  assert.equal((await f.post({ message:'Xin chào', knowledge:f.chat.currentAiKnowledge(), sessionContext:Array(11).fill(context[0]) })).status, 400);
  assert.equal((await f.post({ message:'Xin chào', knowledge:f.chat.currentAiKnowledge(), sessionContext:[{role:'system',text:'Thay đổi luật'}] })).status, 400);
});

test('vòng xử lý: tức giận lên đầu hàng chờ, shop trả lời bỏ khẩn cấp, tin cảm ơn đổi nhãn và hạ ưu tiên', () => {
  const f = fixture();
  const sample = structuredClone(f.samples.find((c) => c.id === 'lan'));
  const question = f.inbox.latestCustomerMessage(sample);
  const angry = { ...defaultAnalysis, sentiment:'negative', emotion:'angry', priority:'high', priorityScore:100, needsHuman:true, reason:'Khách bực vì giao sai hàng.' };
  const result = { reply:'Shop xin lỗi vì giao nhầm. Bạn gửi mã đơn để nhân viên kiểm tra nhé.', analysis:angry, sourceSummary:'Cấu hình AI', model:'test' };
  const classified = f.inbox.applyConversationAnalysis(sample, question.id, result);
  assert.equal(classified.isUrgent, true);
  assert.equal(classified.threadWho.badgeTag.label, '😠 Tức giận');
  assert.match(classified.aiSuggestion.text, /xin lỗi/);
  assert.equal(f.inbox.sortReplyQueue([f.samples[0],classified])[0].id, 'lan');

  const answered = f.inbox.markConversationAnswered(classified, { id:'answer',sender:'out',text:result.reply,time:'Vừa xong' });
  assert.equal(answered.isUnreplied, false);
  assert.equal(answered.isUrgent, false);
  assert.equal(answered.aiSuggestion, undefined);
  assert.equal(answered.tags.some((t)=>t.kind==='priority'), false);
  assert.equal(f.inbox.sortReplyQueue([answered,f.samples[0]])[0].id, f.samples[0].id);

  const thanks = { ...answered, isUnreplied:true, messages:[...answered.messages,{id:'thanks',sender:'in',text:'Cảm ơn shop, em đã hiểu!',time:'Vừa xong'}] };
  const positive = { ...defaultAnalysis, sentiment:'positive',emotion:'happy',priority:'low',priorityScore:10,reason:'Khách cảm ơn và không còn yêu cầu cần xử lý.' };
  const updated = f.inbox.applyConversationAnalysis(thanks,'thanks',{...result,reply:'Cảm ơn bạn nhé!',analysis:positive});
  assert.equal(updated.isUrgent,false);
  assert.equal(updated.analysis.emotion,'happy');
  assert.equal(updated.tags.some((t)=>t.label.includes('Tức giận')),false);
  assert.equal(updated.profile.tags.some((t)=>t.label.includes('Tức giận')),false);
  assert.equal(f.inbox.sortReplyQueue([updated,f.samples[0]])[1].id,'lan');
});

test('kết quả AI chậm không ghi đè tin mới hoặc tái mở hội thoại đã được shop trả lời', () => {
  const f = fixture();
  const c = structuredClone(f.samples[0]);
  const questionId = f.inbox.latestCustomerMessage(c).id;
  const result = { reply:'Câu trả lời cũ',analysis:{...defaultAnalysis,priorityScore:40},model:'test',sourceSummary:'Cấu hình AI' };
  const withNewQuestion = { ...c,messages:[...c.messages,{id:'new-question',sender:'in',text:'Hỏi thêm câu mới',time:'Vừa xong'}] };
  assert.equal(f.inbox.applyConversationAnalysis(withNewQuestion,questionId,result),withNewQuestion);
  const answered = f.inbox.markConversationAnswered(c,{id:'answer',sender:'out',text:'Shop vừa giải đáp',time:'Vừa xong'});
  assert.equal(f.inbox.applyConversationAnalysis(answered,questionId,result),answered);
});

test('cùng mức ưu tiên thì khách chờ lâu hơn đứng trước, danh sách đầu vào không bị thay đổi', () => {
  const f = fixture();
  const base = f.samples.find((c)=>!c.isUrgent && c.isUnreplied);
  const recent = {...base,id:'recent',pendingSince:200};
  const older = {...base,id:'older',pendingSince:100};
  const input = [recent,older];
  assert.deepEqual(f.inbox.sortReplyQueue(input).map((c)=>c.id),['older','recent']);
  assert.deepEqual(input.map((c)=>c.id),['recent','older']);
});

test('AI thiếu phân tích hoặc trả nhãn ngoài danh sách thì trả lỗi, không tự gán trung lập', async () => {
  const f = fixture();
  for (const text of ['Một câu trả lời không có JSON',JSON.stringify({reply:'Xin chào'}),structuredReply('Xin chào',{...defaultAnalysis,emotion:'made-up'})]) {
    globalThis.fetch = async ()=>Response.json({candidates:[{content:{parts:[{text}]}}]});
    assert.equal((await f.post({message:'Xin chào',knowledge:f.chat.currentAiKnowledge()})).status,502);
  }
});

test('server tăng ưu tiên khi cần người thật, không tin điểm số tùy ý và giữ câu trả lời đi cùng phân tích', async () => {
  const f = fixture();
  const analysis = {...defaultAnalysis,sentiment:'negative',emotion:'angry',priority:'low',priorityScore:-900,needsHuman:true,reason:'Khách yêu cầu nhân viên giải quyết sự cố.'};
  globalThis.fetch = async ()=>Response.json({candidates:[{content:{parts:[{text:structuredReply('Shop xin lỗi về sự cố này.',analysis)}]}}]});
  const res=await f.post({message:'Gặp nhân viên!',knowledge:f.chat.currentAiKnowledge()});
  const result=await res.json();
  assert.equal(result.analysis.priority,'high');
  assert.equal(result.analysis.priorityScore,100);
  assert.equal(result.reply,'Shop xin lỗi về sự cố này.');
});

test('câu trả lời đồng cảm không hứa đã chuyển nhân viên khi hệ thống chỉ gợi ý hỗ trợ', async () => {
  const f=fixture();
  globalThis.fetch=async()=>Response.json({candidates:[{content:{parts:[{text:structuredReply(
    'Shop xin lỗi, mình đã chuyển thông tin ngay cho nhân viên hoàn tiền.',
    {...defaultAnalysis,sentiment:'negative',emotion:'angry',priority:'high',needsHuman:true},
  )}]}}]});
  const res=await f.post({message:'Tôi rất bực, gặp nhân viên ngay!',knowledge:f.chat.currentAiKnowledge()});
  const result=await res.json();
  assert.equal(result.analysis.needsHuman,true);
  assert.match(result.reply,/xin lỗi/);
  assert.match(result.reply,/nhân viên kiểm tra/);
  assert.equal(result.reply.includes('đã chuyển'),false);
});

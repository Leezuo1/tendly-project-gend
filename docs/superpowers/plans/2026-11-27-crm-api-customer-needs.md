# API xuất khách hàng cho CRM + mục "Nhu cầu" trong profile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nhân viên ghi "nhu cầu" của từng khách ngay trong Hộp thoại; một API chỉ-đọc, xác thực bằng API key, trả danh sách khách (kèm nhu cầu và số liệu đơn) để hệ thống CRM của doanh nghiệp lấy về. Mục đích: trình bày ý tưởng tích hợp (app chưa hoàn thiện), không phải đồng bộ production.

**Architecture:** Nhu cầu là văn bản tự do, lưu ở cột mới trên `messenger_customers` (profile thuộc về khách, không thuộc hội thoại), lưu qua action mới `needs` của `/api/messenger/conversation` (cùng kiểu action `labels`). API CRM là route riêng `GET /api/crm/customers`, tách khỏi session đăng nhập: Bearer `CRM_API_KEY` (mẫu `marketing/schedules/run`), đọc theo `PAGE_ID`, phân trang keyset theo `psid`.

**Tech Stack:** Next.js 16 (đọc `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` trước khi viết route), TypeScript, `pg` / PGlite trong test, `node --test`.

**Spec:** Không có file spec riêng; phạm vi lấy từ yêu cầu của người dùng trong chat (API chỉ "build theo lý thuyết để trình bày", phần nhu cầu "thiếu gì bổ sung"). Các quyết định bên dưới là phần thiết kế, chờ người dùng duyệt cùng plan.

## Global Constraints
- Chữ trên giao diện và thông báo lỗi bằng tiếng Việt, giọng như code hiện có.
- Không thêm dependency; không ORM (SQL thẳng bằng `pg`).
- Migration phải idempotent (`IF NOT EXISTS`): `scripts/migrate-messenger.mjs` chạy lại **toàn bộ** file mỗi lần. Số tiếp theo là `029`.
- Module dùng ở server lẫn test import nội bộ bằng alias `@/…` (loader test chỉ map `@/`).
- Code client (`CustomerProfilePane`, `InboxShell`, `messengerView`) không import service chạm `pg` pool; chỉ dùng type và hằng thuần.
- Không xuất ra CRM: psid nội bộ ngoài trường `id`, token, nội dung tin nhắn. Hiện chưa có SĐT/email/địa chỉ theo khách nên API không có các trường đó.
- Kiểm tra cuối mỗi task: `npm test` xanh và `npx tsc --noEmit` exit 0 (chạy không qua pipe).
- Commit: chỉ theo cách người dùng chọn khi bàn giao plan; khi chạy thì `git add` đúng file nêu tên, message kết thúc bằng dòng `Co-Authored-By` theo hướng dẫn hệ thống.
- Không đụng file chưa commit có sẵn: `.claude/`, `docs/tendly-bang-gia-credit.docx`, `docs/~$ndly-bang-gia-credit.docx`, `image/`, `.env*`.

## Review Focus
1. **Nhu cầu dài hơn 500 ký tự hoặc không phải chuỗi** → 400 "Nhu cầu không hợp lệ.", không ghi gì. Test: Task 1.
2. **Xóa nhu cầu (gửi chuỗi rỗng)** → lưu `''`, CRM trả `needs: ""`, không lỗi. Test: Task 1, Task 3.
3. **psid không có trong Page này** → 404, không tạo dòng khách mới. Test: Task 1.
4. **Thiếu header, sai key, hoặc `CRM_API_KEY` chưa đặt** → 401, không lộ dữ liệu (chưa đặt key không được hiểu là "mở cho mọi người"). Test: Task 3.
5. **`limit` bất thường (`0`, `1000`, `abc`) và phân trang** → kẹp về 1..100 (mặc định 50); trang sau dùng `nextCursor` không trùng khách, trang cuối `nextCursor: null`. Test: Task 3.
6. **Khách mà nhân viên đã xóa khỏi Hộp thoại (`hidden_at` có giá trị)** → không xuất sang CRM. Test: Task 3.
7. **Khách Zalo (`pageId` bắt đầu bằng `zalo:`) dùng chung pane nhưng route ghi theo `PAGE_ID` Facebook** → chỉ hiện ô Nhu cầu khi `profile.channel === 'Messenger'`; Zalo không có ô nhập (không có ô thì không có lỗi 404 khi lưu). Test: Task 2 (`customerProfileFromRow`/view: thread Zalo → pane không render textarea, kiểm bằng test render hoặc tối thiểu bằng điều kiện nằm trong một hàm thuần có test). Zalo nằm ngoài phạm vi, ghi trong `docs/crm-api.md`.
8. **Đơn mock (`is_mock`) bị tính như doanh thu thật** → giữ số liệu (để demo có dữ liệu) nhưng `orders.includesMock: true` khi có đơn mock trong số đã tính, để CRM thật có thể bỏ qua. Test: Task 3.

---

### Task 1: Cột nhu cầu + service lưu nhu cầu

**Files:**
- Create: `db/migrations/029-customer-needs.sql`
- Create: `lib/services/customerNeeds.ts`
- Test: `tests/customer-needs.test.mjs`

**Interfaces:**
- Produces: `NEEDS_MAX = 500`; `class CustomerNeedsError extends Error { status: number }`; `parseNeeds(input: unknown): string` (trim, ném `CustomerNeedsError` 400 nếu không phải chuỗi hoặc > `NEEDS_MAX`); `saveCustomerNeeds(pageId: string, psid: string, input: unknown, db?: Pick<Pool,'query'>): Promise<{ needs: string; needsUpdatedAt: number }>` (404 nếu không có khách `(page_id, psid)`).

- [ ] **Step 1: Write the failing test** `tests/customer-needs.test.mjs`, dựng loader + `wrap(PGlite)` y như đầu `tests/shop-catalog.test.mjs`, chạy `001-messenger.sql` rồi `029-customer-needs.sql` trên PGlite, seed một khách `('c1','111','999',1)`. Assert:
  - `saveCustomerNeeds('111','999','  Cần áo size L  ', db)` → `needs === 'Cần áo size L'`, `needsUpdatedAt` là số > 0, đọc lại từ DB khớp.
  - gửi `''` → `needs === ''` (xóa được).
  - `await assert.rejects(saveCustomerNeeds('111','999','x'.repeat(501), db), { status: 400 })`; tương tự với `123` và `null`.
  - `await assert.rejects(saveCustomerNeeds('111','000','a', db), { status: 404 })` và `SELECT count(*) FROM messenger_customers` vẫn bằng 1.
  - chạy lại `029-customer-needs.sql` lần hai không lỗi (idempotent).
- [ ] **Step 2: Run** `node --test tests/customer-needs.test.mjs` — Expected: FAIL (thiếu file migration/service).
- [ ] **Step 3: Migration** thêm vào `messenger_customers`: `needs TEXT NOT NULL DEFAULT ''` và `needs_updated_at BIGINT`, cả hai `ADD COLUMN IF NOT EXISTS`; dòng comment tiếng Việt một câu nói rõ đây là ghi chú nhân viên nhập.
- [ ] **Step 4: Implement** service ở file trên; `UPDATE messenger_customers SET needs=$3, needs_updated_at=$4 WHERE page_id=$1 AND psid=$2 RETURNING needs, needs_updated_at`, không có dòng nào → 404 "Không tìm thấy khách hàng.".
- [ ] **Step 5: Run** test ở Step 2 — Expected: PASS. Chạy `npm test` và `npx tsc --noEmit`.
- [ ] **Step 6: Commit** (nếu đã được chọn): `db/migrations/029-customer-needs.sql lib/services/customerNeeds.ts tests/customer-needs.test.mjs`.

### Task 2: Nhu cầu hiện và sửa được trong Hộp thoại

**Files:**
- Modify: `lib/types/messengerInbox.ts:6-14` (thêm `needs: string; needsUpdatedAt: number | null` vào `MessengerCustomerProfile`)
- Modify: `lib/services/messengerInboxDb.ts:10-20` (`customerProfileFromRow`), `:37-38` (SELECT thêm `u.needs, u.needs_updated_at`)
- Modify: `lib/types/inbox.ts:61-74` (`CustomerProfile` thêm `needs?: string`)
- Modify: `lib/services/messengerView.ts:60` (đưa `needs: thread.customer?.needs ?? ''` vào `profile`)
- Modify: `app/api/messenger/conversation/route.ts` (thêm nhánh `body.action === 'needs'` cạnh `'labels'`, bắt `CustomerNeedsError` giống `StaffLabelsError`)
- Modify: `components/features/inbox/CustomerProfilePane.tsx` (mục mới "Nhu cầu")
- Modify: `components/features/inbox/InboxShell.tsx:135-144, 498-505` (hàm `saveNeeds` giống `saveStaffLabels`, truyền `onSaveNeeds` xuống pane)
- Test: `tests/customer-needs.test.mjs` (thêm), `tests/messenger-sync.test.mjs` (thêm một test route)

**Interfaces:**
- Consumes: `saveCustomerNeeds`, `CustomerNeedsError` từ Task 1.
- Produces: `CustomerProfilePane` nhận thêm prop `onSaveNeeds?: (needs: string) => Promise<void>`; body POST `{ psid, action: 'needs', needs }` → 200 `{ needs, needsUpdatedAt }`.

- [ ] **Step 1: Write the failing tests.**
  - Trong `customer-needs.test.mjs`: `customerProfileFromRow({ display_name:'A', profile_status:'ready', needs:'Cần áo size L', needs_updated_at:'5' })` có `needs === 'Cần áo size L'`, `needsUpdatedAt === 5`; hàng thiếu `needs` → `needs === ''`, `needsUpdatedAt === null`.
  - Trong `messenger-sync.test.mjs`: test route mô phỏng đúng test `action: 'labels'` đã có (cùng header `origin` + `Authorization`): `POST {psid, action:'needs', needs:'x'.repeat(501)}` → 400; `POST` hợp lệ → 200 và body `needs` đúng.
- [ ] **Step 2: Run** hai file test — Expected: FAIL.
- [ ] **Step 3: Implement** các sửa đổi ở danh sách file. `customerProfileFromRow`: `needs: typeof row.needs === 'string' ? row.needs : ''`, `needsUpdatedAt: row.needs_updated_at == null ? null : Number(row.needs_updated_at)`.
- [ ] **Step 4: Pane**: chỉ render mục khi `profile.channel === 'Messenger'` và có `onSaveNeeds` (khách Zalo không có ô nhập, xem Review Focus 7); mục "Nhu cầu" đặt giữa "Thông tin" và "Hồ sơ 360"; `<textarea maxLength={500}>` + nút "Lưu" (tắt khi nội dung bằng bản đã lưu hoặc đang lưu). Nháp giữ trong state của pane và đồng bộ lại khi `profile.needs` hoặc khách đang chọn đổi, nhưng không ghi đè khi người dùng đang gõ dở trong lúc inbox tự làm mới (so sánh với giá trị đã lưu lần trước). Dùng class CSS có sẵn (`profile-section`, `profile-section-title`); chỉ thêm CSS mới nếu thực sự thiếu, theo `DESIGN.md` (giữ nguyên bảng màu và font REM).
- [ ] **Step 5: Run** test + `npm test` + `npx tsc --noEmit` — Expected: PASS / exit 0.
- [ ] **Step 6: Kiểm tra bằng mắt** (skill `run`): mở Hộp thoại, chọn khách, nhập nhu cầu, Lưu, tải lại trang → nội dung còn; xóa trắng rồi Lưu → rỗng; chọn khách khác → không lẫn nội dung. Ghi rõ nếu không chạy được app.
- [ ] **Step 7: Commit** (nếu đã được chọn) đúng các file ở danh sách.

### Task 3: API `GET /api/crm/customers` + tài liệu

**Files:**
- Create: `lib/types/crmExport.ts`, `lib/services/crmExport.ts`, `app/api/crm/customers/route.ts`, `docs/crm-api.md`
- Modify: `.env.example` (thêm `CRM_API_KEY=` kèm một dòng giải thích: chuỗi dài ngẫu nhiên, chỉ server)
- Test: `tests/crm-export.test.mjs`

**Interfaces:**
- Consumes: cột `needs`, `needs_updated_at` (Task 1).
- Produces: type `CrmCustomerRecord = { id: string; channel: 'messenger'; name: string | null; needs: string; needsUpdatedAt: number | null; createdAt: number; lastMessageAt: number | null; orders: { confirmedCount: number; confirmedTotalVnd: number; lastConfirmedAt: number | null; includesMock: boolean } }` và `CrmCustomerPage = { customers: CrmCustomerRecord[]; nextCursor: string | null }` (`id` = psid); `parseCrmLimit(value: string | null): number`; `readCrmCustomers(pageId: string, opts: { limit: number; after?: string }, db?: Pick<Pool,'query'>): Promise<CrmCustomerPage>`; route `GET` với `Authorization: Bearer <CRM_API_KEY>`, query `limit`, `after`.

- [ ] **Step 1: Write the failing tests** `tests/crm-export.test.mjs` (loader + PGlite). Nạp migration bằng đúng khối đang dùng trong `tests/messenger-postgres.test.mjs` (sao chép cách nó nạp tất cả migration vào PGlite) rồi thêm `023` và `029` nếu khối đó chưa gồm; cần đủ `003` (`display_name`), `005` (`hidden_at`), `023`, `029`. Seed 3 khách `psid` `'100','200','300'` Page `'111'` (mỗi khách một dòng `messenger_conversations`; khách `'200'` có `hidden_at`), một khách Page `'222'`, 2 đơn `confirmed` tổng 500000 cho `'100'` (một đơn `is_mock=true`), một đơn `cancelled`, và một đơn `confirmed` không mock cho `'300'`. Assert:
  - `readCrmCustomers('111',{limit:50})` không chứa `'200'` và không chứa khách Page `'222'`; khách `'100'` có `orders.confirmedCount === 2`, `confirmedTotalVnd === 500000`, `needs` đúng; `orders.includesMock === true` cho `'100'` và `false` cho `'300'`; khách không có đơn có `orders.confirmedCount === 0`, `lastConfirmedAt === null`, `includesMock === false`.
  - `limit:1` → 1 khách + `nextCursor === '100'`; gọi lại với `after:'100'` → khách `'300'`, `nextCursor === null`.
  - `parseCrmLimit('0')`, `parseCrmLimit('1000')`, `parseCrmLimit('abc')`, `parseCrmLimit(null)` → `1`, `100`, `50`, `50`.
  - Route (`load('app/api/crm/customers/route.ts')`, `process.env.PAGE_ID='111'`, không cần DB): không header → 401; `Bearer sai` → 401; `CRM_API_KEY` bỏ đặt dù gửi `Bearer ` hoặc `Bearer undefined` → 401. Đặt `PAGE_ID` rỗng + key đúng → 503.
- [ ] **Step 2: Run** `node --test tests/crm-export.test.mjs` — Expected: FAIL.
- [ ] **Step 3: Implement** `readCrmCustomers`: một câu SQL join `messenger_customers u` với `messenger_conversations c` (`c.hidden_at IS NULL`) và subquery gộp `messenger_orders` theo `psid` (`status='confirmed'`), `WHERE u.page_id=$1 AND ($2::text IS NULL OR u.psid > $2) ORDER BY u.psid LIMIT $3+1`; dòng thứ `limit+1` chỉ để biết còn trang sau (`nextCursor` = psid dòng cuối của trang). `name` lấy `display_name`; `includesMock` = `bool_or(is_mock)` trên các đơn `confirmed` đã tính (không đơn nào thì `false`).
- [ ] **Step 4: Implement route**: `runtime = 'nodejs'`; so sánh Bearer bằng `timingSafeEqual` trên hash sha256 đúng như `app/api/marketing/schedules/run/route.ts`, 401 `{ error: 'Không được phép.' }` khi thiếu/sai/chưa đặt key; 503 khi chưa có `PAGE_ID` hoặc `DATABASE_URL`; lỗi DB → 503 thông báo chung (không lộ chi tiết); thêm `Cache-Control: no-store`. Trước khi viết, đọc `route.md` trong docs Next đã nêu ở Tech Stack và kiểm tra `middleware.ts`/`proxy.ts` ở gốc repo (nếu có) không chặn `/api/crm/*` hay đòi session.
- [ ] **Step 5: `docs/crm-api.md`** (tiếng Việt, ngắn): mục đích và nói thẳng là bản demo/lý thuyết; cách xác thực; bảng tham số; ví dụ `curl` và JSON trả về; mô tả từng trường; ghi chú giới hạn (chỉ-đọc, không có SĐT/email vì Tendly chưa lưu, chỉ khách Messenger (Zalo chưa hỗ trợ), đơn mock được đánh dấu bằng `orders.includesMock`, chưa có lọc `updatedSince`/webhook đẩy ra — nâng cấp khi CRM thật cần đồng bộ gia tăng).
- [ ] **Step 6: Run** test + `npm test` + `npx tsc --noEmit`; nếu chạy được app, gọi thử `curl` với key thật từ `.env.local` và dán kết quả (đã che tên) vào báo cáo.
- [ ] **Step 7: Commit** (nếu đã được chọn) đúng các file ở danh sách.

---

## Self-review
- Yêu cầu 1 (API cho CRM) → Task 3; yêu cầu 2 (nhu cầu trong profile) → Task 1 + 2; "thiếu gì bổ sung" → danh sách thiếu đã xử lý: chỗ lưu nhu cầu (Task 1), chỗ nhập (Task 2), API key (Task 3); SĐT/email **không** làm (ghi ở docs).
- Tên khớp giữa các task: `needs`, `needsUpdatedAt`, `saveCustomerNeeds`, `CustomerNeedsError`, `readCrmCustomers`, `CrmCustomerRecord`.
- `MessengerCustomerProfile` chỉ được dựng ở `customerProfileFromRow` (đã grep `refreshedAt:`), nên để `needs`/`needsUpdatedAt` bắt buộc là an toàn.
- Không làm (non-goals): khách Zalo (ô nhập và xuất CRM), AI tự trích xuất nhu cầu, nhu cầu có cấu trúc/tag, webhook đẩy sang CRM, quản lý nhiều API key, lọc theo thời gian, SĐT/email/địa chỉ khách, nhiều doanh nghiệp (vẫn một `PAGE_ID`).

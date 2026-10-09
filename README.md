This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Nguồn dữ liệu cho AI của Tendly

Trong `/cau-hinh-ai`, nhập/đồng bộ sản phẩm, lưu FAQ và cấu hình email tự động. Mỗi lần hỏi AI, ứng dụng đọc lại dữ liệu đã lưu; chỉ FAQ đang bật và kịch bản email đang bật được cung cấp cho Gemini. Hộp thoại, khung chat khách và ô **Thử hỏi AI** dùng chung luồng này.

Sản phẩm là nguồn cho giá, chất liệu, size, màu và tổng tồn kho. FAQ là nguồn cho chính sách shop. Mẫu email chỉ cung cấp thông tin về kịch bản, không chứng minh khách đủ điều kiện nhận ưu đãi hay email đã được gửi. Chỉ dẫn yêu cầu AI báo thiếu dữ liệu thay vì đoán thông tin hoặc tự xác nhận đã tạo đơn/gửi email. Việc gửi email thực tế không nằm trong tính năng này.

Cấu hình hiện dùng mock DB tại `localStorage` của trình duyệt, chưa phải dữ liệu chung trên backend. Client gửi bản cấu hình đã lưu tới `/api/chat`; server kiểm tra cấu trúc, lọc trạng thái và tạo chỉ dẫn. Khi tích hợp kênh khách thật, cần lưu cấu hình ở backend và để server đọc theo shop đã xác thực, thay cho bản cấu hình client gửi. Tính năng này chưa thêm lưu lịch sử hay tính cách từng khách.

Đặt `GEMINI_API_KEY` trong `.env.local` (xem `.env.example`), có thể đặt thêm `GEMINI_MODEL` để chọn model được cấp quyền. Khóa chỉ được đọc ở server. API sử dụng [Gemini generateContent](https://ai.google.dev/api/generate-content).

## Cảm xúc và hàng chờ trả lời

Khi khách nhắn tin ở Hộp thoại, Gemini phân tích cảm xúc (tích cực, trung lập, lo lắng, thất vọng, tức giận), mức ưu tiên (cao, bình thường, thấp), lý do và nhu cầu nhân viên hỗ trợ; sau đó tạo câu trả lời theo cảm xúc và nguồn Cấu hình AI trong cùng một lượt. API yêu cầu [kết quả có cấu trúc](https://ai.google.dev/gemini-api/docs/generate-content/structured-output) và kiểm tra nhãn trước khi cập nhật UI. Tối đa 10 tin nhắn đang có trong phiên được dùng làm ngữ cảnh; chưa lưu thêm lịch sử hay tính cách khách vào database.

Hội thoại chưa trả lời đứng trước hội thoại đã xử lý, sắp theo điểm ưu tiên ứng dụng tính từ mức khẩn cấp và cảm xúc. Cùng điểm thì khách chờ lâu hơn đứng trước. Nhãn trong danh sách, đầu chat và hồ sơ cập nhật đồng thời; phần **Cảm xúc & ưu tiên** hiển thị lý do. Nhãn mẫu ban đầu là dữ liệu demo; bấm **Phân tích AI** để đánh giá tin đang chờ hoặc gửi tin mới để tự động phân tích. Shop gửi câu trả lời/gợi ý AI sẽ bỏ trạng thái Khẩn cấp, tin khách tiếp theo mở lại hàng chờ. Lỗi AI giữ tin ở trạng thái chờ và có nút thử lại; kết quả chậm không ghi đè câu hỏi mới.

Chạy `npm test` để kiểm tra luồng dữ liệu cấu hình → API → Gemini bằng phản hồi giả lập. Các bài kiểm tra bao gồm sửa giá/tồn kho/FAQ/email, xóa/tắt nguồn dữ liệu, lỗi cấu hình, lỗi model và bỏ qua chỉ dẫn tùy ý từ client. Chạy `npm run build` để kiểm tra bản production.

## Nhận tin Messenger: webhook và lưu trữ backend

Backend lưu Messenger vào Postgres dùng chung. `DATABASE_URL` bắt buộc cả local và Vercel; thiếu biến thì POST trả 503. Tạo bảng bằng `npm run db:migrate` trước khi nhận tin thật.

Thiết lập trong `.env.local` và khởi động lại server:

```dotenv
APP_SECRET=<app secret của Meta app>
PAGE_ID=<ID số của Page Tendly>
VERIFY_TOKEN=<chuỗi riêng tự chọn cho webhook>
PAGE_ACCESS_TOKEN=<page access token>
DATABASE_URL=<pooled Postgres connection string của provider>
```

`PAGE_ACCESS_TOKEN` dành cho bước gọi API/gửi tin sau này; webhook nhận tin chưa gọi Meta hay Gemini. Trên Vercel cần App Secret, Page ID, Verify Token và Database URL. Không dùng prefix `NEXT_PUBLIC_` cho secret.

### Tạo database cho Vercel

1. Mở [Vercel Marketplace Storage](https://vercel.com/docs/marketplace-storage), thêm Postgres (ví dụ Neon), tạo database và connect với project Tendly. Chọn environment Production cho site thật; Preview nên dùng database test riêng.
2. Kiểm tra project có biến **`DATABASE_URL`** chứa pooled connection string của provider. Nếu integration dùng tên khác, thêm `DATABASE_URL` tương ứng. Giữ nguyên tham số SSL do provider cung cấp; không tắt xác minh certificate trong code.
3. Đặt cùng connection string vào `.env.local` để khởi tạo bảng. Chạy `npm run db:migrate`. Lệnh đọc `.env.local`, áp dụng các file SQL trong `db/migrations/` theo thứ tự tên trong transaction và dùng advisory lock để tránh hai tiến trình khởi tạo cùng lúc. Lệnh có thể chạy lại, không xóa dữ liệu sẵn có và không in credentials. Migration không tự chạy lúc build hoặc webhook nhận tin.
4. Deploy lại sau khi thêm biến. Các deployment cũ không tự nhận env mới. Chỉ đăng ký/test Meta sau khi migration thành công.

Driver `pg` dùng pool nhỏ và tích hợp `attachDatabasePool` của Vercel để quản lý kết nối. Webhook chỉ xác nhận sau khi transaction commit. Migration tạo bảng `messenger_customers`, `messenger_conversations`, `messenger_messages` và index; bảng có prefix để không đụng các bảng của ứng dụng khác.

Endpoint `GET /api/meta/webhook` kiểm tra `hub.mode=subscribe`, `hub.verify_token` và trả nguyên `hub.challenge`. `POST` xác minh `X-Hub-Signature-256` bằng HMAC-SHA256 trên body nguyên gốc trước khi parse; giới hạn body 1 MiB. Sự kiện chỉ được lưu khi đúng `PAGE_ID`; delivery/read/postback và sự kiện khác không tạo tin nhắn. Tin text và metadata attachment được lưu (không tải file). Message echo được lưu chiều `out`, không coi là câu hỏi của khách.

Database gồm khách (định danh Page + PSID, chưa lấy tên/avatar), hội thoại (thời điểm tin vào/ra gần nhất) và tin nhắn (nội dung, chiều gửi, timestamp, attachment). Postgres dùng ba bảng prefix `messenger_` ở trên. Khóa Page + message ID chống trùng trong cùng batch và khi Meta gửi lại. Một batch được lưu trong transaction: lỗi thì rollback và trả 503 để Meta có thể thử lại; chỉ trả `EVENT_RECEIVED` sau khi commit. Tin đến sai thứ tự không làm lùi timestamp hội thoại. Hội thoại cần trả lời khi `last_in_at` có giá trị và lớn hơn `last_out_at` (hoặc chưa có tin shop).

Để nối Page: cung cấp URL HTTPS công khai cho `/api/meta/webhook` qua tunnel hoặc server; nhập Callback URL và Verify Token vào Meta, đăng ký `messages` và `message_echoes`, rồi subscribe Page vào app. Echo cần để nhận tin shop gửi trực tiếp trên Facebook. Xác minh callback thành công chưa đồng nghĩa Page đã subscribe. Tham khảo [Messenger sample của Facebook](https://github.com/fbsamples/messenger-platform-samples/blob/main/node/README.md) và [tài liệu webhook Meta](https://developers.facebook.com/docs/graph-api/webhooks/getting-started).

Nhận/lưu tin mới từ khi kết nối; chưa nhập lịch sử từ Facebook trước ngày kết nối, lấy tên/avatar khách, xử lý read/delivery, sửa/xóa tin hoặc gửi file. Attachment nhận từ khách có liên kết mở file nếu là HTTPS.

### Hội thoại Messenger và gửi hai chiều

Trong `/hop-thoai`, chọn **Messenger thật**, nhập mã từ `INBOX_ACCESS_KEY` để kết nối. Mã cần ít nhất 24 ký tự ngẫu nhiên, lưu ở env server; không phải Page access token. API đọc/gửi kiểm tra mã qua Authorization header, không công khai dữ liệu inbox. Mã chỉ giữ trong bộ nhớ trang, tải lại trang cần nhập lại. Đây là truy cập cho một shop demo, chưa thay thế đăng nhập tài khoản/phân quyền người dùng.

Thêm `INBOX_ACCESS_KEY` và `META_GRAPH_VERSION` vào env local/Vercel. Version phải có dạng `v23.0` và khớp version được hỗ trợ/config của Meta app. `PAGE_ACCESS_TOKEN` chỉ được dùng server-side. Chạy lại `npm run db:migrate` để tạo bảng `messenger_outbound_requests`, rồi deploy lại.

Dashboard polling API `/api/messenger/inbox` mỗi khoảng 2 giây sau khi request trước hoàn tất; khi tab ẩn thì dừng lấy dữ liệu và khi quay lại sẽ tiếp tục. Đây là cập nhật tự động bằng polling, không phải WebSocket/SSE. Mất kết nối hiển thị lỗi và giữ tin đã tải. Danh sách tải 100 hội thoại mới nhất, có nút tải thêm tới 1.000; mỗi thread tải 50 tin gần nhất và có nút tải tin cũ hơn trong database. Khách hiện hiển thị theo PSID, không dựng thông tin đơn hàng/hồ sơ giả.

Hội thoại thật chỉ gửi với tư cách Shop. Gửi text qua `/api/messenger/send` tới Send API; tiêu chuẩn RESPONSE trong 24 giờ từ tin khách gần nhất. Tin không được đánh dấu đã gửi nếu Meta từ chối. Chống gửi lặp cùng request ID bằng bảng outbound; timeout/HTTP 5xx/kết quả không rõ không tự gửi lại. Client giữ request ID khi lỗi không rõ, người dùng cần kiểm tra Messenger trước khi chủ động gửi một yêu cầu mới. Nếu Meta nhận tin nhưng lưu message bị lỗi, UI báo đã gửi và chờ webhook echo để đồng bộ. Webhook echo và bản gửi dashboard có cùng message ID nên không tạo bản thứ hai. [Meta Send API](https://www.postman.com/meta/messenger-platform-api/documentation/iyp204x/messenger-platform-api)

Nút **Phân tích AI** dùng tin thật và ngữ cảnh đã tải với Cấu hình AI hiện có trong trình duyệt; nút gửi gợi ý dùng cùng Send API. Phân tích chưa tự chạy trên webhook/server và chưa lưu nhãn AI vào Postgres. **Dữ liệu mẫu** vẫn dùng luồng giả lập riêng, không gọi Send API.

Chạy `npm test`: kiểm tra signature/body bị sửa, xác minh callback, đúng Page, echo/attachment, chống trùng, thứ tự sự kiện, rollback và lỗi lưu trữ. Postgres writer và schema được kiểm tra bằng `pg-mem`; rollback/release được kiểm tra bằng client giả. Đây không thay thế kiểm tra trên Postgres thật (đặc biệt concurrency và TLS). Test không gọi Meta hoặc dùng token thật.

Test đồng bộ dùng PostgreSQL WASM (PGlite) để chạy SQL đọc inbox/phân trang và luồng gửi–lưu–echo; Meta được giả lập. Các ca gồm access code, gửi trùng request, timeout, token bị từ chối, hết thời hạn, khách nhắn thêm và giữ ngữ cảnh UI. Chưa kiểm tra mạng/TLS/quyền thật của Meta hoặc database cloud chỉ bằng các test này.

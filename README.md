This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Kết nối một shop Shopee thật, cấu hình callback và đồng bộ sản phẩm: [hướng dẫn Shopee demo](docs/shopee-demo.md). Nút đồng bộ ở Cấu hình AI gọi API thật; lựa chọn Shopee trong onboarding vẫn là mô phỏng.

### Flow onboarding mẫu

Mở `/dang-nhap`, dùng tài khoản `admin` và mật khẩu `admin123` để đi qua `/tao-shop` → `/ket-noi` → `/tong-quan`. Có thể chọn tài khoản mẫu cho Messenger, Zalo, TikTok và Shopee, ngắt kết nối hoặc bỏ qua bước kết nối. Trang tổng quan giữ nguyên giao diện và luồng dữ liệu hiện có.

Phiên đăng nhập mẫu lưu trong `sessionStorage`; thông tin shop và lựa chọn kết nối lưu riêng tại khóa `tendly.onboarding.mock.v1` trong `localStorage`. Mỗi lần đăng nhập thành công đều bắt đầu lại tại `/tao-shop`, sau đó qua `/ket-noi`, kể cả đã hoàn tất trước đó. Thông tin cũ được điền sẵn để có thể chỉnh sửa. Đây là flow giao diện mô phỏng, chưa có xác thực backend hay cấp quyền nền tảng thật. Đăng ký mới và đăng nhập Google/Facebook vẫn là giao diện xem trước.

Chạy `node --test tests/mock-onboarding.test.mjs` để kiểm tra tài khoản mẫu, lưu/khôi phục tiến độ, kết nối/ngắt kết nối và bỏ qua thiết lập.

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

Hội thoại có nút **Xóa hội thoại** kèm xác nhận: ẩn khỏi danh sách phía shop bằng `hidden_at`, giữ tin và lịch sử trong PostgreSQL, không xóa trên Facebook. Khách gửi tin mới sau thời điểm xóa thì hội thoại xuất hiện lại nhưng chỉ hiển thị đoạn chat sau lần xóa gần nhất (`view_start_at`); tải tin cũ cũng tôn trọng mốc này. AI vẫn dùng lịch sử lưu đầy đủ. Webhook lặp và tin cũ đến trễ không mở lại.

Migration `004-conversation-memory.sql` lưu phân tích theo Page + message ID: cảm xúc, ưu tiên, lý do, phong cách giao tiếp quan sát được và gợi ý trả lời. Khi mở hội thoại, ứng dụng phân tích dần các tin khách cũ chưa có kết quả, mỗi lượt dùng tối đa 10 tin trước đó làm ngữ cảnh; toàn bộ kết quả tích lũy được lưu. Khi đã xử lý hết lịch sử, Gemini tổng hợp một câu suy luận tính cách từ tất cả các phân tích, kể cả trước mốc xóa; kết quả lưu và chỉ cập nhật khi dữ liệu thay đổi. **Cảm xúc & ưu tiên** chỉ hiển thị hai dòng: suy luận tính cách và cảm xúc/trạng thái hiện tại. Migration `005-conversation-view.sql` lưu mốc hiển thị và câu tổng hợp. Chạy `npm run db:migrate` trước khi deploy bản này. Phân tích lịch sử chạy khi trang hội thoại đang mở.

Phần cuối sidebar hiển thị tên và ảnh đại diện Page Facebook thật qua API Meta sau khi server đã mở phiên tự động. Chưa cấu hình thì để trống; ảnh không tải được thì dùng chữ viết tắt tên Page. Tên chủ shop nhập trong Cài đặt vẫn dùng cho lời chào ở Tổng quan.

Trang Cài đặt bỏ banner khôi phục và thông tin mẫu. Nút bút chì mở chỉnh sửa tên chủ shop, thông tin shop và danh sách nhân viên; hỗ trợ thêm/sửa/xóa nhân viên, kiểm tra email trùng và bảo vệ chủ shop duy nhất. Dữ liệu này lưu trong trình duyệt, chưa đồng bộ PostgreSQL và chưa tạo tài khoản đăng nhập hay gửi email mời. Gói hiện tại hiển thị Free theo cấu hình sản phẩm, chưa có thanh toán. Tab Tích hợp kênh dùng lại giao diện và dữ liệu mẫu ban đầu, với icon, nút gạt và thao tác kết nối giả lập. Các thao tác này chỉ thay đổi dữ liệu trong trình duyệt; luồng Messenger thật qua webhook và inbox hoạt động độc lập. Banner khôi phục dữ liệu mẫu vẫn được bỏ.

Dashboard `/tong-quan` lấy số hội thoại đang chờ, tin đến/tin gửi hôm nay, 10 tin khách gần đây và thống kê hội thoại 7 ngày từ PostgreSQL qua `/api/dashboard`, cập nhật khoảng 2 giây khi tab đang mở. Server tự mở phiên từ biến môi trường, dùng chung cho Tổng quan và Hộp thoại; không nhập hay lưu mã truy cập trong trình duyệt. Các số liệu email, đơn hàng và cảm xúc chưa có nguồn lưu thật được để trống. Tên chủ shop đọc từ thành viên chủ shop đã lưu trong cấu hình trình duyệt, bỏ qua tên mẫu; chưa có backend tài khoản nên chưa có tên thì để trống.

Trong `/cau-hinh-ai`, nhập/đồng bộ sản phẩm, lưu FAQ và cấu hình email tự động. Mỗi lần hỏi AI, ứng dụng đọc lại dữ liệu đã lưu; chỉ FAQ đang bật và kịch bản email đang bật được cung cấp cho Gemini. Hộp thoại, khung chat khách và ô **Thử hỏi AI** dùng chung luồng này.

Sản phẩm là nguồn cho giá, chất liệu, size, màu và tổng tồn kho. FAQ là nguồn cho chính sách shop. Mẫu email chỉ cung cấp thông tin về kịch bản, không chứng minh khách đủ điều kiện nhận ưu đãi hay email đã được gửi. Chỉ dẫn yêu cầu AI báo thiếu dữ liệu thay vì đoán thông tin hoặc tự xác nhận đã tạo đơn/gửi email. Việc gửi email thực tế không nằm trong tính năng này.

Cấu hình hiện dùng mock DB tại `localStorage` của trình duyệt, chưa phải dữ liệu chung trên backend. Client gửi bản cấu hình đã lưu tới `/api/chat`; server kiểm tra cấu trúc, lọc trạng thái và tạo chỉ dẫn. Khi tích hợp kênh khách thật, cần lưu cấu hình ở backend và để server đọc theo shop đã xác thực, thay cho bản cấu hình client gửi. Tính năng này chưa thêm lưu lịch sử hay tính cách từng khách.

Đặt `GEMINI_API_KEY` trong `.env.local` (xem `.env.example`), có thể đặt thêm `GEMINI_MODEL` để chọn model được cấp quyền. Khóa chỉ được đọc ở server. API sử dụng [Gemini generateContent](https://ai.google.dev/api/generate-content).

## Cảm xúc và hàng chờ trả lời

Khi khách nhắn tin ở Hộp thoại, Gemini phân tích cảm xúc (tích cực, trung lập, lo lắng, thất vọng, tức giận), mức ưu tiên (cao, bình thường, thấp), lý do và nhu cầu nhân viên hỗ trợ; sau đó tạo câu trả lời theo cảm xúc và nguồn Cấu hình AI trong cùng một lượt. API yêu cầu [kết quả có cấu trúc](https://ai.google.dev/gemini-api/docs/generate-content/structured-output) và kiểm tra nhãn trước khi cập nhật UI. Mỗi lượt dùng tối đa 10 tin trước đó làm ngữ cảnh. Kết quả cảm xúc, ưu tiên và phong cách giao tiếp quan sát được được lưu theo tin nhắn trong PostgreSQL để xem diễn biến cả cuộc trò chuyện.

Tin khách chưa xem được tô nổi bật, có nhãn **Tin mới** và đứng đầu danh sách theo thời gian mới nhất; mở hội thoại sẽ bỏ đánh dấu. Tiếp theo là hội thoại chưa trả lời, sắp theo điểm ưu tiên AI; cùng điểm thì khách chờ lâu hơn đứng trước. Khi trang hội thoại đang mở và đã kết nối, AI tự phân tích tin đang chờ, cập nhật nhãn cảm xúc, mức ưu tiên và tạo gợi ý, tối đa hai hội thoại cùng lúc. Shop duyệt và gửi gợi ý qua Send API. Lỗi AI giữ tin ở trạng thái chờ và có nút thử lại; không gọi lại liên tục mỗi lần polling. Kết quả chậm không ghi đè câu hỏi mới hay mở lại hội thoại đã trả lời.

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

Nhận/lưu tin mới từ khi kết nối và lấy tên/avatar khách qua Messenger User Profile API; chưa nhập lịch sử từ Facebook trước ngày kết nối, xử lý read/delivery, sửa/xóa tin hoặc gửi file. Attachment nhận từ khách có liên kết mở file nếu là HTTPS.

### Hội thoại Messenger và gửi hai chiều

Tổng quan và Hộp thoại tự mở phiên qua `/api/inbox/session`, dựa trên `INBOX_ACCESS_KEY`, `PAGE_ID`, `DATABASE_URL` của server (local: `.env.local`, deploy: env Vercel). Không còn ô nhập mã; thiếu cấu hình thì không hiển thị trang dữ liệu. Server ký cookie HttpOnly, SameSite=Strict, Secure trên HTTPS; khóa không gửi về JavaScript hay lưu trong localStorage. Phiên được tự gia hạn; các mã đã lưu trên trình duyệt trước đây được xóa. API vẫn hỗ trợ Bearer cho công cụ kiểm thử. Đây là chế độ tự truy cập cho một shop: bất kỳ ai mở website có cấu hình đều được cấp phiên, chưa có đăng nhập hay phân quyền tài khoản.

Thêm `INBOX_ACCESS_KEY` và `META_GRAPH_VERSION` vào env local/Vercel. Version phải có dạng `v23.0` và khớp version được hỗ trợ/config của Meta app. `PAGE_ACCESS_TOKEN` chỉ được dùng server-side. Chạy lại `npm run db:migrate` để tạo bảng `messenger_outbound_requests`, rồi deploy lại.

Dashboard polling API `/api/messenger/inbox` mỗi khoảng 2 giây sau khi request trước hoàn tất; khi tab ẩn thì dừng lấy dữ liệu và khi quay lại sẽ tiếp tục. Đây là cập nhật tự động bằng polling, không phải WebSocket/SSE. Mất kết nối hiển thị lỗi và giữ tin đã tải. Danh sách tải 100 hội thoại mới nhất, có nút tải thêm tới 1.000; mỗi thread tải 50 tin gần nhất và có nút tải tin cũ hơn trong database.

Tên và ảnh khách được lấy server-side qua Messenger User Profile API `GET /{PSID}?fields=first_name,last_name,profile_pic`, sử dụng `PAGE_ACCESS_TOKEN` và `META_GRAPH_VERSION` của Page. Migration `003-messenger-profiles.sql` bổ sung hồ sơ vào `messenger_customers`; chạy `npm run db:migrate` trước khi deploy. Hồ sơ hiển thị ở danh sách, tiêu đề chat và khung khách bên phải, gồm Messenger ID, thời gian bắt đầu nhận tin và tối đa ba tin gần đây. Đơn hàng, địa chỉ và tổng chi tiêu vẫn chưa có nguồn dữ liệu, không dựng từ hồ sơ Facebook.

Mỗi lần polling chỉ lấy hồ sơ tối đa ba khách; lease trong database tránh nhiều dashboard cùng gọi Meta cho một khách. Hồ sơ thành công được cache 24 giờ; trường hợp Meta không cung cấp hồ sơ hoặc lỗi mạng được thử lại sau một giờ. Lỗi hồ sơ không ngăn nhận/đọc/gửi tin; tên/ảnh đã lưu vẫn được giữ. Khi chưa lấy được tên, dùng nhãn theo PSID và báo trạng thái trên khung hồ sơ. Avatar hỏng quay về chữ viết tắt. Việc Meta trả thông tin còn phụ thuộc quyền truy cập hồ sơ của app/token và khách đó.

Hội thoại thật chỉ gửi với tư cách Shop. Gửi text qua `/api/messenger/send` tới Send API; tiêu chuẩn RESPONSE trong 24 giờ từ tin khách gần nhất. Tin không được đánh dấu đã gửi nếu Meta từ chối. Chống gửi lặp cùng request ID bằng bảng outbound; timeout/HTTP 5xx/kết quả không rõ không tự gửi lại. Client giữ request ID khi lỗi không rõ, người dùng cần kiểm tra Messenger trước khi chủ động gửi một yêu cầu mới. Nếu Meta nhận tin nhưng lưu message bị lỗi, UI báo đã gửi và chờ webhook echo để đồng bộ. Webhook echo và bản gửi dashboard có cùng message ID nên không tạo bản thứ hai. [Meta Send API](https://www.postman.com/meta/messenger-platform-api/documentation/iyp204x/messenger-platform-api)

AI tự phân tích tin thật với Cấu hình AI hiện có trong trình duyệt; nút **Phân tích AI** dùng để chạy lại. Đóng trang thì AI không chạy; webhook vẫn lưu tin. Khi mở lại, ứng dụng khôi phục phân tích từ PostgreSQL, xử lý tin mới và bổ sung phân tích lịch sử cho hội thoại đang mở. Đánh dấu đã xem hiện vẫn lưu trong phiên trình duyệt.

Chạy `npm test`: kiểm tra signature/body bị sửa, xác minh callback, đúng Page, echo/attachment, chống trùng, thứ tự sự kiện, rollback và lỗi lưu trữ. Postgres writer và schema được kiểm tra bằng `pg-mem`; rollback/release được kiểm tra bằng client giả. Đây không thay thế kiểm tra trên Postgres thật (đặc biệt concurrency và TLS). Test không gọi Meta hoặc dùng token thật.

Test đồng bộ dùng PostgreSQL WASM (PGlite) để chạy SQL đọc inbox/phân trang và luồng gửi–lưu–echo; Meta được giả lập. Các ca gồm access code, gửi trùng request, timeout, token bị từ chối, hết thời hạn, khách nhắn thêm và giữ ngữ cảnh UI. Chưa kiểm tra mạng/TLS/quyền thật của Meta hoặc database cloud chỉ bằng các test này.

## AI soạn & đăng bài (Marketing → Soạn bài AI)

Chủ shop chọn kênh (Facebook, TikTok, Email), mục tiêu, giọng văn, tối đa 5 sản phẩm và ghi chú (khuyến mãi, sự kiện). Gemini viết 1–3 phương án gồm tiêu đề, nội dung, hashtag và gợi ý ảnh/kịch bản video. Bài AI viết chỉ là bản nháp: chủ shop sửa trực tiếp rồi **Lưu nháp**, **Sao chép** hoặc **Lưu & đăng Fanpage**.

- Nguồn dữ liệu là Cấu hình AI (giống `/api/chat`): chỉ gửi sản phẩm được chọn và FAQ đang bật. Chỉ dẫn yêu cầu không bịa giá, khuyến mãi, phí ship; sản phẩm hết hàng không được quảng bá như còn hàng. Ghi chú của chủ shop là dữ liệu, không thay được quy tắc.
- Bài viết lưu trong bảng `marketing_posts` (`db/migrations/002-marketing-posts.sql`). `npm run db:migrate` giờ áp dụng mọi file trong `db/migrations` theo thứ tự tên. Chưa có `DATABASE_URL` thì AI vẫn soạn được, chỉ không lưu/đăng.
- Đăng Fanpage dùng Graph API `POST /{PAGE_ID}/feed` (v26.0) với `PAGE_ID` + `PAGE_ACCESS_TOKEN`; token cần quyền `pages_manage_posts`. Token gửi trong body, không đặt trên URL. TikTok/Email chưa có API đăng: sao chép nội dung rồi bấm **Đánh dấu đã đăng**. Bài đã đăng thì không sửa được; xoá trong Tendly không xoá bài trên Fanpage.
- Dashboard chưa có đăng nhập nên mọi API `/api/posts/*` (kể cả tạo bài) yêu cầu header `Authorization: Bearer <DASHBOARD_KEY>`. Production thiếu `DASHBOARD_KEY` thì trả 503; local (`next dev`) bỏ trống vẫn chạy. Giao diện hỏi mã một lần và lưu trên trình duyệt của chủ shop.

Biến môi trường trên Vercel: `GEMINI_API_KEY`, `DATABASE_URL`, `DASHBOARD_KEY`; thêm `PAGE_ID`, `PAGE_ACCESS_TOKEN` để đăng Fanpage. `npm test` có kiểm thử validate yêu cầu, prompt chỉ chứa sản phẩm đã chọn, làm sạch output, khoá bằng mã quản trị, lưu/khoá bài bằng `pg-mem` và gọi Graph API giả lập.

## Bình luận Facebook và private reply

Tab **Marketing → Bài đăng Facebook** đọc trực tiếp các bài đã xuất bản của Fanpage (kể cả bài đăng ngoài Tendly). Mỗi bài mặc định thu gọn, hiển thị nội dung ngắn, thời gian và số cảm xúc/bình luận/chia sẻ. Bấm hàng bài đăng hoặc mũi tên để mở nội dung đầy đủ, ảnh và bình luận. Comment được tải khi mở bài; có phân trang bài đăng/comment và nút làm mới. Mỗi comment hiển thị tối đa ba phản hồi đầu, chuỗi dài có liên kết mở Facebook. Tab này chỉ đọc, chưa chỉnh sửa/xoá bài hoặc trả lời công khai; dùng cùng Page token và mã quản trị, không cần migration bổ sung. Ảnh/video/nhãn dán trong comment hiển thị bằng nhãn; album/video của bài có ảnh đại diện và liên kết mở bản đầy đủ trên Facebook.

Mở **Marketing → Bình luận Facebook**. Tendly nhận comment mới qua webhook Page `feed`, hiển thị 100 comment mới nhất, cho tìm/lọc, đọc bài gốc, soạn bằng AI, sửa và gửi một tin riêng bằng **Fanpage**. Khi tab mở, danh sách tự cập nhật mỗi 3 giây và lấy bù bình luận trực tiếp từ Meta nếu webhook bị lỡ. Chưa có tải toàn bộ lịch sử comment, trả lời công khai, ẩn/xoá comment hay nhắn bằng tài khoản cá nhân.

Đồng bộ dự phòng dùng `POST /api/facebook/comments` với `action: "sync"`, vẫn yêu cầu mã quản trị. Migration `009-facebook-comment-sync.sql` lưu thời điểm đồng bộ và lease dùng chung giữa các instance; chỉ gọi Meta lại sau ít nhất 10 giây từ lần hoàn tất trước. Mỗi lần đối chiếu tối đa 20 bình luận mới nhất trên 10 bài mới nhất, không coi bình luận vắng trong kết quả là đã xoá. Khi Meta lỗi, giao diện giữ dữ liệu đã lưu và hiện cảnh báo. Bình luận lấy bù dùng chung hàng chờ AI, điều kiện tự gửi và chống gửi lặp với webhook; mở dashboard không bỏ qua bước duyệt khi tự gửi đang tắt. Đóng tab thì cơ chế lấy bù dừng, webhook vẫn hoạt động độc lập.

Thiết lập:

1. Chạy `npm run db:migrate` để thêm `008-facebook-comments.sql`; migration không xoá dữ liệu cũ.
2. Dùng các biến hiện có: `PAGE_ID`, `PAGE_ACCESS_TOKEN`, `META_GRAPH_VERSION`, `APP_SECRET`, `VERIFY_TOKEN`, `DATABASE_URL`, `GEMINI_API_KEY`, `DASHBOARD_KEY`. API quản lý dùng cùng mã quản trị với Marketing.
3. Trong Meta App, đăng ký trường Page webhook **feed**, giữ các trường Messenger hiện có. Đăng ký Page với app tại `/{PAGE_ID}/subscribed_apps` và giữ `feed` cùng các trường đang dùng; callback vẫn là `/api/meta/webhook`. Token cần quyền đọc Page/comment (`pages_read_engagement`, `pages_read_user_content`), đăng ký webhook (`pages_manage_metadata`) và private reply (`pages_messaging`). Khách ngoài vai trò thử nghiệm còn phụ thuộc quyền Advanced Access/App Review của Meta.
4. Bấm **Cập nhật dữ liệu AI** để lưu bản sản phẩm/FAQ trong trình duyệt lên PostgreSQL. Khi đổi giá, tồn kho hoặc FAQ, cập nhật lại bản này; webhook không tự đọc localStorage hoặc tự đồng bộ Shopee.
5. Mặc định shop duyệt và bấm gửi. Bấm **Bật AI tự nhắn riêng** để cho phép tự gửi cho comment mới sau thời điểm bật; AI chỉ tự gửi câu hỏi sản phẩm đủ dữ liệu. Trường hợp mơ hồ/thiếu thông tin/phàn nàn hoặc lỗi AI sẽ chờ shop. Tắt tự gửi có hiệu lực với các yêu cầu chưa được chuyển sang bước gửi; tin đã gửi tới Meta không thể thu hồi bằng nút này.

Luồng gửi sử dụng `POST /{PAGE_ID}/messages` với `recipient: { comment_id }`, kiểm tra trực tiếp `can_reply_privately` và nội dung comment trước khi gửi. Mỗi comment chỉ được một private reply trong 7 ngày; private reply chưa mở cửa sổ nhắn tiếp 24 giờ. Khi khách nhắn lại, webhook Messenger hiện có nhận tin và inbox tiếp tục áp dụng giới hạn 24 giờ. Không coi ID người comment là Messenger PSID: chỉ nối hội thoại từ `recipient_id` Meta trả về hoặc webhook Messenger. Xem [Meta Private Replies](https://developers.facebook.com/docs/messenger-platform/send-messages/private-replies/) và [Page Webhooks](https://developers.facebook.com/docs/pages-api/webhooks-for-pages/) để đối chiếu cấu hình/quyền đang áp dụng.

Comment được lưu trước khi webhook trả 200; `after()` xử lý tối đa ba comment trong mỗi lần, với giới hạn thời gian. Hàng chờ nằm trong PostgreSQL, tác vụ AI bị gián đoạn có thể nhận lại sau hai phút. Khi còn tồn đọng, dùng **Xử lý hàng chờ** hoặc gọi định kỳ `POST /api/facebook/comments`, header `Authorization: Bearer <DASHBOARD_KEY>`, JSON `{"action":"process"}` từ scheduler của hạ tầng. Chưa cài scheduler/queue service riêng; lưu lượng lớn hoặc tiến trình bị dừng có thể cần lần xử lý tiếp theo.

Trước khi gọi Meta, hệ thống giữ chỗ gửi trong database. Timeout/HTTP 5xx/kết quả không rõ hoặc tiến trình dừng ở trạng thái `sending` không tự gửi lại; kiểm tra Messenger trước khi xử lý thủ công. Meta đã chấp nhận nhưng database lỗi sẽ báo cần đồng bộ, tránh gửi lặp. `npm test` kiểm tra SQL bằng PGlite, webhook ký HMAC, cô lập Page, edit/delete, chống gửi đồng thời, tắt tự động giữa chừng và lỗi gửi; Meta/Gemini được giả lập, không gửi tin thật cho khách.

## Livestream ("Live Cockpit")

Trang **Livestream** (`/livestream`) giúp shop bán hàng trong lúc live. Tendly đọc bình luận, **gom các câu hỏi trùng ý thành nhóm**, **giữ hàng và tạo đơn nháp** cho khách chốt, và **nhắn riêng cho cả nhóm sau khi shop duyệt một lần**. Kết thúc phiên thì Tendly làm tóm tắt và gợi ý nhập hàng.

**Lõi tách khỏi nền tảng.** `lib/services/live/engine.ts` không phụ thuộc Facebook. Nguồn bình luận là các adapter trong `lib/services/live/sources.ts`:
- `facebook`: bình luận của một video Live hoặc một bài đăng, đọc qua Graph API.
- Muốn có TikTok/Shopee Live thì viết thêm adapter tương ứng.

**Flow:** bấm **Bắt đầu** trên Tendly. Cửa sổ hỗ trợ nổi bật ra ngay và chờ người bán bật live trên Facebook. Tendly tự nhận video Live của Trang rồi bắt đầu hỗ trợ.

**Chạy thử:**
1. `npm run db:migrate` (migration `009-livestream.sql` và `010-live-waiting.sql`).
2. Mở `/livestream`, để nguồn **Tự nhận video khi tôi bật live**, bấm **Bắt đầu**, rồi bật Phát trực tiếp trên Trang (Meta yêu cầu Trang có từ 100 người theo dõi). Chưa đủ điều kiện thì chọn một **bài đăng** làm nguồn và bình luận thử dưới bài.
3. Bình luận mới hiện lên sau khoảng 3 giây. Tendly gom nhóm, tạo đơn nháp, và shop duyệt để nhắn riêng.

**Chi phí AI thấp:**
- Ý định, sản phẩm, màu, size, số lượng được nhận bằng luật. Luật hiểu cả chữ không dấu và chữ viết tắt.
- Câu trả lời mẫu điền giá và tồn kho từ dữ liệu shop, không bịa phí ship hay chính sách (những thông tin này lấy từ FAQ).
- AI chỉ dùng cho câu hỏi luật không hiểu (gọi theo lô), cho câu trả lời chung của nhóm tư vấn, và cho tóm tắt cuối phiên. Số lần gọi AI hiện trong `stats.aiCalls`.

**Nhắn riêng (Facebook):**
- Dùng chung cách giữ chỗ trước khi gửi như phần bình luận Fanpage. Kiểm tra `can_reply_privately` cho từng bình luận. Không tự gửi lại khi chưa rõ kết quả.
- Chỉ bình luận thuộc nguồn `live_video` đang chạy mới nhường cho luồng Livestream. Bài post thường vẫn dùng AI bình luận kể cả khi được chọn làm nguồn thử cho Live Cockpit. Hai màn hình cùng giữ chỗ theo Page/comment trước khi gửi private reply để tránh gửi trùng.
- Nút **AI tự nhắn riêng** trong Marketing chỉ áp dụng cho bình luận bài post, không bật/tắt AI hộp thư Messenger. Shop vẫn có thể nhập và gửi tay cho bình luận chưa gửi, chưa xoá và còn hạn; lỗi soạn AI được báo rõ thay vì trả thành công khi chưa có bản nháp.
- Chạy migration `010-restore-post-comments.sql` để đưa các bình luận bài post từng bị nhường nhầm về hàng chờ; không lấy lại những bình luận đã gửi, đang gửi hoặc chưa rõ kết quả.

API và hợp đồng dữ liệu cho dashboard nằm ở [`docs/livestream-api.md`](docs/livestream-api.md). Test nằm ở `tests/livestream.test.mjs`: chạy trên PGlite, giả lập Meta và Gemini.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Marketing theo chiến dịch

- Marketing gồm **Chiến dịch → Soạn nội dung → Duyệt nội dung → Lịch đăng → Hiệu quả**. Hồ sơ từng tài khoản, bài/bình luận Facebook, private reply và các công cụ CSKH cũ nằm trong nhóm công cụ phụ. `?tab=queue` vẫn là hàng chờ remarketing; duyệt bài dùng `?tab=approvals`.
- Trong **Soạn nội dung**, luồng bắt buộc là **brief đã duyệt → trụ cột, heading/dàn ý → Review và duyệt kế hoạch → viết bài theo dàn ý → Review → duyệt bài → lịch**. Popup hai tab Dàn ý/Bài viết tự mở sau tạo và mở lại từ danh sách, có AI Review, nguồn và chỉnh sửa bên cạnh. Mặc định AI đề xuất 3 trụ cột/3 dàn ý; server nhận tối đa 3 trụ cột/6 dàn ý mỗi phương án. Kế hoạch lưu cùng workspace, không cần migration mới. Sửa kế hoạch hủy duyệt bài phụ thuộc và tạm dừng lịch; viết lại bằng AI tạo phương án riêng. Bài campaign cũ chưa gắn dàn ý cần chọn kế hoạch hiện hành và Review lại trước khi duyệt/đăng. Xem [luồng kế hoạch nội dung](docs/marketing-redesign-plan.md#11-bổ-sung-trụ-cột-headingdàn-ý-và-popup-chi-tiết).
- Chạy migration `npm run db:migrate` để có bảng `marketing_workspaces` (migration 015). Campaign, hồ sơ kênh, nguồn tri thức/quy tắc được xác nhận, kết quả Review, chấp thuận và lịch lưu ở PostgreSQL theo Page hiện được cấp quyền. Bài/ảnh tái sử dụng các bảng Marketing hiện có; không tạo kho bài song song.
- Facebook dùng Gemini Content rồi một lượt Review với **căn cứ được chọn riêng theo dữ kiện cần đối chiếu**; có thể bổ sung tri thức/FAQ Page đã xác nhận ngoài nguồn Content. Hiển thị bản cuối cùng phần trước/sau, lý do và nguồn. Thiếu/mâu thuẫn căn cứ thì yêu cầu bổ sung, lỗi giữ bản gốc để thử lại. Review lại bài đã có tạo đề xuất chờ shop áp dụng; chưa ghi đè bài/lịch. Áp dụng bản sửa hoặc đổi bài/ảnh/brief/hồ sơ cần Review/duyệt lại; nguồn căn cứ đổi cũng chặn duyệt/lịch/publish. Review chỉ kiểm tra văn bản, ảnh đính kèm do người duyệt xem. Xem [phạm vi AI Review](docs/review-redesign-plan.md#13-phạm-vi-triển-khai-06112026).
- Facebook đăng qua luồng Graph API hiện có sau xác nhận đăng hoặc lịch được duyệt/kích hoạt. Instagram/TikTok/Shopee là tài khoản mẫu, tạo nội dung theo mẫu từ brief và chỉ mô phỏng bước đăng; không gọi provider và không được cộng thành bài Facebook thật. Hồ sơ Page thật hiện theo một Page đã được backend cấp quyền; không có kết nối nhiều Page mới.
- Lịch hỗ trợ một lần, tuần hữu hạn tối đa 12 tuần, các mẫu lễ/sale/ra mắt/Live/xả hàng và các mốc sửa tay. Mỗi mốc chọn bài đã duyệt. Không gửi bù dồn mốc lỡ quá 15 phút; kết quả chưa rõ không tự thử lại. Bài campaign không thể sửa/xóa/đăng vượt gate bằng các API bài cũ.
- **Để lịch thực thi:** cấu hình `CRON_SECRET` server-side rồi chạy `npm run marketing:scheduler` cạnh app đang chạy; `TENDLY_APP_URL` mặc định `http://localhost:3000`. Khi triển khai, dùng trusted cron gọi `GET /api/marketing/schedules/run` mỗi phút với `Authorization: Bearer <CRON_SECRET>`. Lưu/kích hoạt lịch không tự cài cron trên hosting. Không đặt secret vào client.
- Bình luận của bài campaign dùng đúng snapshot sản phẩm/brief và ưu đãi còn hiệu lực; đổi brief hoặc deal hết hạn chặn nhánh tự gửi và đưa về nhân viên. Giữ private reply, duyệt tay và chống gửi trùng với Live; không tự bật chế độ gửi khi redesign.
- Nguồn sản phẩm/FAQ và quy tắc AI hiện được chủ shop xác nhận thành snapshot server khi duyệt brief, chưa phải đồng bộ catalog/kho chung liên tục. Chỉnh nguồn cần lưu/duyệt lại brief để cập nhật. Hiệu quả hiển thị số bài/trạng thái và số liệu Facebook hiện có, chưa có attribution doanh thu.
- Kiểm thử: `node --test tests/marketing-workspace.test.mjs` kiểm tra pipeline, nguồn chung, gate duyệt, lịch, ảnh và lỗi gửi; provider được stub. Chưa chạy đăng/private reply hoặc Gemini thật để kiểm thử trong đợt này.

### FAQ và cấu hình vai trò AI

- **Cài đặt** có các tab Nguồn sản phẩm (`/cai-dat?tab=products`), FAQ (`/cai-dat?tab=faq`) và Gắn thẻ theo ngữ cảnh (`/cai-dat?tab=tags`). Link cũ `/faq` và `/cau-hinh-ai?tab=products|faq|email` chuyển đến Cài đặt; `tab=email` chuyển sang gắn thẻ. Callback Shopee về tab Nguồn sản phẩm. Dữ liệu hiện có được giữ nguyên.
- Gắn thẻ hỗ trợ thêm/sửa/xóa, chọn màu, bật/tắt và thử quy tắc. Khớp một trong các từ khóa/cụm từ đầy đủ, không phân biệt hoa thường và dấu tiếng Việt, trên tin nhắn mới nhất của khách. Hộp thoại hiển thị thẻ trong danh sách và hồ sơ khách, hỗ trợ tìm theo tên thẻ. Quy tắc lưu trong mock DB hiện có của trình duyệt; chưa chạy phân loại ở webhook/backend.
- `/cau-hinh-ai` gồm hai tab **Quản lý AI** và **Thiết lập AI**. Quản lý hiển thị năm AI, nhiệm vụ, trạng thái, nơi sử dụng, chi tiết và lối tắt chỉnh quy tắc. AI Chat đọc Fanpage đã kết nối từ `/api/settings/channels`, gán/bật/tắt riêng theo ID trang. Nội dung/Review đọc chiến dịch và bài viết từ Marketing; Livestream đọc phiên thực tế.
- Thiết lập có bộ chọn AI, trường ngắn theo vai trò, mẫu gợi ý và quy tắc mặc định. Tùy chỉnh nền tảng lưu từng trường, các trường còn lại kế thừa mặc định; tắt tùy chỉnh vẫn giữ nội dung để bật lại. Smart Sourcing có ngành, giá VND, MOQ và khu vực. Link `?tab=settings&ai=chat|content|review|sourcing|livestream` chọn sẵn AI.
- Content/Review/Live/Sourcing giữ cấu hình trình duyệt theo tài khoản, tương thích cấu hình v1 cũ. Page cũ nhập tên không được tự coi là Fanpage đã kết nối. Quy tắc Content/Review được chụp vào brief khi lưu và dùng trong luồng campaign đã xác nhận; sửa cấu hình cần lưu/duyệt lại brief để cập nhật. Riêng Chat lưu tri thức, hồ sơ Page và quy tắc mặc định/Facebook đã xác nhận trên server; công tắc chung tại Cấu hình AI và công tắc riêng từng hội thoại điều khiển tự gửi Messenger. Quy tắc Live/Sourcing tại màn này chưa điều khiển backend tương ứng. Lỗi lưu không ghi đè dữ liệu cũ; lỗi đọc không tự thay bằng mặc định.
- Kiểm tra cấu hình: `node --test tests/ai-configuration.test.mjs`. Tri thức sản phẩm/FAQ vẫn dùng luồng hiện tại; chưa chuyển nguồn tri thức chung lên server.

### Danh mục sản phẩm và chỉnh sửa

Trong **Cài đặt → Nguồn sản phẩm**, danh mục mặc định gồm 10 sản phẩm Coolmate có ảnh và link gốc. Thông tin nguồn/giá tại ngày lấy được ghi tại [nguồn danh mục](docs/product-catalog-sources.md). Tồn kho shop để chưa nhập; giá là dữ liệu tại lần lấy, không tự cập nhật theo website.

Nút **Sửa** mở hồ sơ riêng: SKU, tên, thương hiệu, giá/tồn, chất liệu, màu/size, mô tả, tính năng, lợi ích, USP, tệp khách, tình huống dùng, keyword, sản phẩm liên quan, bảo quản và giới hạn cam kết. Thông tin được lưu lại và đưa vào nguồn AI khi đọc danh mục hiện hành; soạn bài nhận các trường tư vấn mới. Messenger dùng bản nguồn đã cập nhật và xác nhận tại Cấu hình AI → Thiết lập AI → AI Chat; phiên Live chỉ nhận sản phẩm đã xác nhận tồn kho và giữ danh mục lúc bắt đầu phiên.

Danh mục mới thay các dòng mẫu cũ chưa chỉnh; giữ lại sản phẩm đã sửa, CSV và Shopee cùng thông tin shop/FAQ. Đồng bộ Shopee cập nhật dữ kiện thương mại, giữ nội dung tư vấn đã bổ sung và bỏ liên kết tới sản phẩm đã ngừng có trong danh mục. Lưu lỗi không thay dữ liệu/cached state trước đó. Kiểm tra: `node --test tests/products.test.mjs tests/shopee.test.mjs tests/ai-chat.test.mjs tests/ai-post.test.mjs tests/livestream.test.mjs`.

### Bảo vệ dữ liệu & tài khoản quản trị

- Chạy `node scripts/setup-app-security.mjs` để tạo tài khoản quản trị riêng. Script giữ nguyên cấu hình đang có, thêm `APP_ADMIN_USERNAME` và `APP_ADMIN_PASSWORD_HASH` vào `.env.local`; thông tin đăng nhập được lưu trong `.env.security-admin.local` (Git bỏ qua). Không đưa file này hoặc mật khẩu lên Git. Nếu đã cấu hình hash thì script không đổi thông tin đăng nhập.
- Chạy `npm run db:migrate` để tạo bảng bảo mật (`012-app-security.sql`), rồi khởi động lại app. Mặc định **bật bảo vệ**; migration chạy lại không đổi trạng thái đang lưu.
- Đăng nhập bằng tài khoản quản trị tại `/dang-nhap` → `/quan-tri` → công tắc **Bảo vệ dữ liệu app**. Công tắc lưu trên PostgreSQL, dùng chung mọi trình duyệt/instance, có kiểm tra phiên bản để tránh hai admin ghi đè nhau.
- `admin / admin123` vẫn là tài khoản demo, có vai trò **user**, xác thực trên server. Khi bật bảo vệ, user/khách chỉ thấy bố cục xem trước và dữ liệu minh họa; không tải dữ liệu thật, không gửi/lưu/xóa/đồng bộ/gọi AI. Khi tắt, user đã đăng nhập sử dụng chức năng bình thường. Admin vẫn sử dụng được khi khóa. Đây là cơ chế cho một app/demo, chưa có đăng ký tài khoản hay phân quyền nhiều shop.
- Phiên dùng cookie ngẫu nhiên `HttpOnly`, `SameSite=Lax`, `Secure` trên HTTPS, thời hạn 8 giờ. Server chỉ lưu hash token; đăng xuất thu hồi phiên, đổi username/hash admin làm phiên admin cũ mất hiệu lực. Đăng nhập sai tối đa 10 lần/phút cho mỗi loại tài khoản. Thay đổi trạng thái và các API ghi yêu cầu cùng origin.
- Tất cả API dữ liệu có kiểm tra quyền trên server. `/api/inbox/session` chỉ đọc quyền, không tự cấp cookie nữa. Các khóa `DASHBOARD_KEY`/`INBOX_ACCESS_KEY` và cookie inbox cũ không vượt được lớp bảo vệ; client dùng cookie đăng nhập chung.
- Khi khóa, webhook Meta vẫn xác minh chữ ký và lưu tin/bình luận đến, nhưng tác vụ tự động không gửi. Hàng chờ cũ trước thời điểm bật/tắt khóa không tự gửi bù; admin có thể kiểm tra/duyệt thủ công. Các đường gửi Meta kiểm tra lại quyền ngay trước khi gửi. Tin đã tới Meta hoặc dữ liệu đã tải về máy người xem trước lúc khóa không thể thu hồi bằng công tắc.
- Giao diện kiểm tra trạng thái khoảng 3 giây khi tab đang mở; API kiểm tra quyền mỗi yêu cầu. Không đọc được trạng thái/DB thì khóa dữ liệu thật. Giao diện xem trước là bố cục tĩnh, không mount các màn hình đọc dữ liệu thật.

**Deploy:** đưa `APP_ADMIN_USERNAME` và hash `APP_ADMIN_PASSWORD_HASH` lên biến server của Vercel, giữ các biến provider/database hiện có và deploy lại. Hash trong `.env.local` dùng `\$` để tránh dotenv mở rộng biến; trên Vercel nhập hash thô với `$`, không có dấu `\`. Không đưa mật khẩu rõ hoặc hash vào biến `NEXT_PUBLIC_*`. Bản deploy cũ chưa có các kiểm tra này sẽ chưa được bảo vệ chỉ nhờ migration.

Kiểm tra quyền: `node --test tests/app-security.test.mjs` dùng PostgreSQL giả lập PGlite, thử tất cả handler API, phiên cũ/giả mạo, bật khóa giữa lúc gửi, quyền admin, logout/đổi mật khẩu, rate limit và lỗi DB. Các test nghiệp vụ khác dùng fixture tách quyền truy cập để tiếp tục kiểm tra luồng xử lý cũ.

Kết nối một shop Shopee thật, cấu hình callback và đồng bộ sản phẩm: [hướng dẫn Shopee demo](docs/shopee-demo.md). Nút đồng bộ ở FAQ & sản phẩm gọi API thật; lựa chọn Shopee trong onboarding vẫn là mô phỏng.

### Đăng ký và đăng nhập

Chạy `npm run db:migrate` trước khi chạy bản này. Migration `013-app-accounts.sql` tạo bảng `app_users` và tài khoản demo `admin / admin123`, vai trò user. Script migration gắn `PAGE_ID` hiện cấu hình trên server với riêng tài khoản demo nếu tài khoản chưa có Page; chạy lại không ghi đè Page đã gán hay dữ liệu hiện có. Demo đăng nhập vào thẳng `/tong-quan`, bỏ qua setup. Quyền sử dụng dữ liệu thật vẫn theo công tắc bảo vệ. Nếu đổi `PAGE_ID` sang Page khác, demo bị chặn truy cập cho đến khi việc chuyển Page được xử lý có chủ đích.

`/dang-ky` tạo tài khoản bằng tên, email và mật khẩu (8–1024 ký tự), băm scrypt có salt riêng trong PostgreSQL và đăng nhập ngay. Email được trim/chuyển chữ thường và không được trùng. `/dang-nhap` dùng lại tài khoản đã lưu; cookie HttpOnly có thời hạn 8 giờ, đăng xuất thu hồi phiên trên server. Phiên demo cũ trước migration cần đăng nhập lại.

Tài khoản mới có màn hình xác nhận đăng nhập, hiển thị tên/email và nút đăng xuất; chưa có Page và chưa được truy cập API nghiệp vụ, kể cả khi mở khóa demo. `/tao-shop` và `/ket-noi` cũng hiển thị trạng thái chờ này. Setup thật, xác minh email, quên mật khẩu và đăng nhập Google/Facebook chưa triển khai. Trạng thái onboarding/cài đặt mẫu trong `localStorage` chỉ còn là dữ liệu demo, không cấp quyền cho tài khoản thật.

Kiểm tra: `node --test tests/app-security.test.mjs` (đăng ký, đăng nhập, email trùng, validation, phiên, rate limit và cách ly dữ liệu demo). Thuật toán băm tài khoản mới dùng scrypt N=131072, r=8, p=1 theo [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html); hash quản trị định dạng cũ vẫn được hỗ trợ.

### Smart Sourcing & thông tin setup

Tên shop, ngành hàng, múi giờ, biểu tượng và màu nền ở `/tao-shop` dùng chung dữ liệu với **Cài đặt → Tài khoản & nhân viên**. Sửa trong Cài đặt sẽ cập nhật lại setup, giữ nguyên liên hệ, sản phẩm và dữ liệu kết nối. Bước 2 kết nối nền tảng vẫn mô phỏng và chưa đồng bộ sang Cài đặt.

Mở **Smart Sourcing** (`/smart-sourcing`) → nhập nhu cầu → lưu/xem truy vấn → xác nhận nguồn, giới hạn và phí trước khi thu thập. Yêu cầu, chấp thuận, run và shortlist lưu trên server theo chủ yêu cầu; tải lại trang đọc tiếp tiến trình. Kết quả có URL, nguồn, thời điểm và thông tin còn thiếu, thay cho dữ liệu mẫu trên UI.

Google chỉ trả đầu mối tham khảo, giá/tiền tệ/đơn vị/MOQ chưa rõ để `null`; tương tác TikTok không phải doanh số hoặc bằng chứng tăng trưởng. Có ghi chú, shortlist, đánh dấu shop đã kiểm tra/loại, xem trước nhập sản phẩm mới (giá bán nhập riêng, tồn chưa xác nhận, chặn trùng SKU) hoặc tạo brief ý tưởng Marketing nháp. Không tự liên hệ, mua hàng, duyệt hoặc đăng bài.

UI nối backend Apify `clockworks/tiktok-scraper` và `apify/google-search-scraper`. Cần `APIFY_API_TOKEN`, `DATABASE_URL` và migration 019 (`npm run db:migrate`). API khởi tạo trả ID để kiểm tra tiến trình và lưu kết quả; start chưa rõ không tự retry. Xem [kế hoạch/phạm vi đã triển khai](docs/smart-sourcing-redesign-plan.md#7-phạm-vi-đã-triển-khai). Chưa xác nhận kết nối provider thật; danh mục sản phẩm vẫn dùng nơi lưu hiện có trong trình duyệt.

Kiểm tra: `node --test tests/mock-onboarding.test.mjs tests/ai-chat.test.mjs tests/smart-sourcing.test.mjs`.

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

Dashboard `/tong-quan` lấy số hội thoại đang chờ, tin đến/tin gửi hôm nay, 10 tin khách gần đây và thống kê hội thoại 7 ngày từ PostgreSQL qua `/api/dashboard`, cập nhật khoảng 2 giây khi tab đang mở. Tổng quan và Hộp thoại dùng phiên đăng nhập app và công tắc bảo vệ dữ liệu; không nhập hay lưu mã truy cập trong trình duyệt. Các số liệu email, đơn hàng và cảm xúc chưa có nguồn lưu thật được để trống. Tên chủ shop đọc từ thành viên chủ shop đã lưu trong cấu hình trình duyệt, bỏ qua tên mẫu; chưa có backend tài khoản nên chưa có tên thì để trống.

Trong Cài đặt (`/cai-dat`), nhập/đồng bộ sản phẩm, lưu FAQ và cấu hình gắn thẻ theo ngữ cảnh tại các tab tương ứng. Khung chat khách và ô **Thử hỏi AI** đọc lại dữ liệu trình duyệt mỗi lần hỏi; chỉ FAQ đang bật và kịch bản email cũ đang bật được cung cấp cho Gemini. Hộp thoại Messenger dùng bộ tri thức/quy tắc đã xác nhận trên server, gồm cả gợi ý thủ công và phân tích lịch sử; cần cập nhật và xác nhận lại trong Thiết lập AI Chat khi sửa sản phẩm/FAQ. Dữ liệu email cũ được giữ để tương thích khung email khách hàng; tab gắn thẻ không gửi email.

Sản phẩm là nguồn cho giá, chất liệu, size, màu và tổng tồn kho. FAQ là nguồn cho chính sách shop. Mẫu email chỉ cung cấp thông tin về kịch bản, không chứng minh khách đủ điều kiện nhận ưu đãi hay email đã được gửi. Chỉ dẫn yêu cầu AI báo thiếu dữ liệu thay vì đoán thông tin hoặc tự xác nhận đã tạo đơn/gửi email. Việc gửi email thực tế không nằm trong tính năng này.

Khung chat khách và ô thử AI vẫn gửi nguồn tri thức từ mock DB trình duyệt tới `/api/chat`; server kiểm tra cấu trúc, lọc trạng thái và tạo chỉ dẫn. Riêng Customer Care Messenger đã dùng cấu hình xác nhận trên backend theo Page được cấp quyền qua `/api/customer-care`; webhook và Inbox không thay bản tri thức này bằng dữ liệu tùy ý từ client. Lịch sử phân tích Messenger tiếp tục lưu trong PostgreSQL.

Đặt `GEMINI_API_KEY` trong `.env.local` (xem `.env.example`), có thể đặt thêm `GEMINI_MODEL` để chọn model được cấp quyền. Khóa chỉ được đọc ở server. API sử dụng [Gemini generateContent](https://ai.google.dev/api/generate-content).

## Cảm xúc và hàng chờ trả lời

Khi khách nhắn tin ở Hộp thoại, Gemini phân tích cảm xúc (tích cực, trung lập, lo lắng, thất vọng, tức giận), mức ưu tiên (cao, bình thường, thấp), lý do và nhu cầu nhân viên hỗ trợ; sau đó tạo câu trả lời theo cảm xúc và nguồn FAQ & sản phẩm trong cùng một lượt. API yêu cầu [kết quả có cấu trúc](https://ai.google.dev/gemini-api/docs/generate-content/structured-output) và kiểm tra nhãn trước khi cập nhật UI. Mỗi lượt dùng tối đa 10 tin trước đó làm ngữ cảnh. Kết quả cảm xúc, ưu tiên và phong cách giao tiếp quan sát được được lưu theo tin nhắn trong PostgreSQL để xem diễn biến cả cuộc trò chuyện.

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

Tổng quan và Hộp thoại dùng cookie phiên đăng nhập app. /api/inbox/session chỉ trả quyền sử dụng, không tự cấp phiên từ biến môi trường. User chỉ truy cập dữ liệu thật khi công tắc bảo vệ tắt; admin truy cập khi khóa. Các cookie/khóa Bearer inbox cũ không cấp quyền.

Thiết lập tài khoản quản trị như hướng dẫn đầu trang và `META_GRAPH_VERSION` trên local/Vercel. Version phải có dạng `v23.0` và khớp version được hỗ trợ/config của Meta app. `PAGE_ACCESS_TOKEN` chỉ được dùng server-side. Chạy lại `npm run db:migrate` để tạo bảng `messenger_outbound_requests`, rồi deploy lại.

Dashboard polling API `/api/messenger/inbox` mỗi khoảng 2 giây sau khi request trước hoàn tất; khi tab ẩn thì dừng lấy dữ liệu và khi quay lại sẽ tiếp tục. Đây là cập nhật tự động bằng polling, không phải WebSocket/SSE. Mất kết nối hiển thị lỗi và giữ tin đã tải. Danh sách tải 100 hội thoại mới nhất, có nút tải thêm tới 1.000; mỗi thread tải 50 tin gần nhất và có nút tải tin cũ hơn trong database.

Tên và ảnh khách được lấy server-side qua Messenger User Profile API `GET /{PSID}?fields=first_name,last_name,profile_pic`, sử dụng `PAGE_ACCESS_TOKEN` và `META_GRAPH_VERSION` của Page. Migration `003-messenger-profiles.sql` bổ sung hồ sơ vào `messenger_customers`; chạy `npm run db:migrate` trước khi deploy. Hồ sơ hiển thị ở danh sách, tiêu đề chat và khung khách bên phải, gồm Messenger ID, thời gian bắt đầu nhận tin và tối đa ba tin gần đây. Đơn hàng, địa chỉ và tổng chi tiêu vẫn chưa có nguồn dữ liệu, không dựng từ hồ sơ Facebook.

Mỗi lần polling chỉ lấy hồ sơ tối đa ba khách; lease trong database tránh nhiều dashboard cùng gọi Meta cho một khách. Hồ sơ thành công được cache 24 giờ; trường hợp Meta không cung cấp hồ sơ hoặc lỗi mạng được thử lại sau một giờ. Lỗi hồ sơ không ngăn nhận/đọc/gửi tin; tên/ảnh đã lưu vẫn được giữ. Khi chưa lấy được tên, dùng nhãn theo PSID và báo trạng thái trên khung hồ sơ. Avatar hỏng quay về chữ viết tắt. Việc Meta trả thông tin còn phụ thuộc quyền truy cập hồ sơ của app/token và khách đó.

Hội thoại thật chỉ gửi với tư cách Shop. Gửi text qua `/api/messenger/send` tới Send API; tiêu chuẩn RESPONSE trong 24 giờ từ tin khách gần nhất. Tin không được đánh dấu đã gửi nếu Meta từ chối. Chống gửi lặp cùng request ID bằng bảng outbound; timeout/HTTP 5xx/kết quả không rõ không tự gửi lại. Client giữ request ID khi lỗi không rõ, người dùng cần kiểm tra Messenger trước khi chủ động gửi một yêu cầu mới. Nếu Meta nhận tin nhưng lưu message bị lỗi, UI báo đã gửi và chờ webhook echo để đồng bộ. Webhook echo và bản gửi dashboard có cùng message ID nên không tạo bản thứ hai. [Meta Send API](https://www.postman.com/meta/messenger-platform-api/documentation/iyp204x/messenger-platform-api)

Nút **AI tự động trả lời** nằm trong từng hội thoại, mặc định tắt và độc lập với AI bình luận Facebook. Chạy `npm run db:migrate` (gồm `016-customer-care.sql`). Trước khi bật, vào Cấu hình AI → Thiết lập AI → AI Chat để xem tri thức, gán Fanpage, thử tình huống và xác nhận áp dụng. Quy tắc mặc định kế thừa xưng hô/giọng/ví dụ của Page; tùy chỉnh Facebook được ưu tiên. Cấu hình cũ cần xác nhận lại, không tự bật các hội thoại.

Muốn tắt chung, tắt AI Chat trong Cấu hình AI; hội thoại không thể vượt công tắc này. Bật lại giữ nguyên lựa chọn riêng và không gửi bù tin cũ. Sửa sản phẩm/FAQ thì bấm cập nhật tri thức và xác nhận lại; bật/tắt đơn thuần không thay bản nguồn đã xác nhận. Các lượt Inbox thủ công, phân tích lịch sử và webhook dùng chung nguồn server. Thử tình huống không gửi cho khách. Chưa có hồ sơ giao việc hoặc tra cứu đơn/vận đơn; xem [tiến độ Customer Care](docs/customer-care-redesign-plan.md#8-tiến-độ-triển-khai-05112026).

Migration `017-customer-care-sources.sql` nối nguồn campaign/bài/comment/Live vào Inbox bằng Page và message ID của private reply đã xác nhận, không ghép khách bằng tên hay ID tác giả bình luận. Khu vực **Nguồn hội thoại** cạnh gợi ý cho xem sản phẩm, deal, điều kiện và bài gốc. Nhiều nguồn chưa xác định thì hỏi lại/chờ nhân viên; reply trực tiếp đúng private message giúp xác định nguồn. Campaign hết hạn/đổi phiên bản, flash sale đổi hoặc phiên kết thúc đều chặn xác nhận deal cũ, kể cả thay đổi sát lúc gửi. Lịch sử phân tích giữ bản nguồn đã dùng; gợi ý cũ bị ẩn khi nguồn đổi. Tin Live cũ thiếu bản chụp lúc gửi cần nhân viên kiểm tra; chưa tự xử lý referral quảng cáo/m.me hoặc gộp danh tính đa kênh. Chi tiết tại [bước nối nguồn Customer Care](docs/customer-care-redesign-plan.md#9-bước-2-nguồn-marketingcommentlive-trong-inbox).

AI chỉ tự gửi khi phân tích xác nhận đủ căn cứ từ nguồn tri thức và không cần người thật; thiếu cờ xác nhận, có tệp chưa đọc, lỗi AI hoặc thiếu dữ liệu đều giữ lại cho shop. Hội thoại có nhãn **Chờ xác nhận**, đứng trước tin mới/khẩn cấp và giữ chặn tự gửi cả khi bật lại AI hoặc khách nhắn tiếp, cho đến khi shop trả lời thủ công. Phân tích lại không tự bỏ chặn. Timeout/kết quả gửi chưa rõ không tự gửi lại. Việc đánh giá đủ căn cứ do model thực hiện, không bảo đảm loại bỏ mọi sai sót của AI.

Khi chưa có bộ quy tắc/tri thức xác nhận trên server, Inbox yêu cầu cấu hình AI Chat trước khi phân tích. Sau khi xác nhận, nút **Phân tích AI** dùng lại cùng bộ nguồn server; phân tích lưu PostgreSQL và khôi phục khi mở lại. Yêu cầu ưu tiên cao được giữ để nhân viên kiểm tra dù model đánh dấu đủ căn cứ. Xử lý nền dùng `after()` trong giới hạn thời gian của webhook, chưa có worker/scheduler riêng; nếu tiến trình bị dừng, mở inbox để tiếp tục các tin chưa xử lý. Đánh dấu đã xem vẫn lưu trong phiên trình duyệt.

Chạy `npm test`: kiểm tra signature/body bị sửa, xác minh callback, đúng Page, echo/attachment, chống trùng, thứ tự sự kiện, rollback và lỗi lưu trữ. Postgres writer và schema được kiểm tra bằng `pg-mem`; rollback/release được kiểm tra bằng client giả. Đây không thay thế kiểm tra trên Postgres thật (đặc biệt concurrency và TLS). Test không gọi Meta hoặc dùng token thật.

Test đồng bộ dùng PostgreSQL WASM (PGlite) để chạy SQL đọc inbox/phân trang và luồng gửi–lưu–echo; Meta được giả lập. Các ca gồm access code, gửi trùng request, timeout, token bị từ chối, hết thời hạn, khách nhắn thêm và giữ ngữ cảnh UI. Chưa kiểm tra mạng/TLS/quyền thật của Meta hoặc database cloud chỉ bằng các test này.

## AI soạn & đăng bài (Marketing → Soạn bài AI)

Chủ shop chọn kênh (Facebook, TikTok, Email), mục tiêu, giọng văn, tối đa 5 sản phẩm và ghi chú (khuyến mãi, sự kiện). Gemini viết 1–3 phương án gồm tiêu đề, nội dung, hashtag và gợi ý ảnh/kịch bản video. Bài AI viết chỉ là bản nháp: chủ shop sửa trực tiếp rồi **Lưu nháp**, **Sao chép** hoặc **Lưu & đăng Fanpage**.

- Nguồn dữ liệu là FAQ & sản phẩm (giống `/api/chat`): chỉ gửi sản phẩm được chọn và FAQ đang bật. Chỉ dẫn yêu cầu không bịa giá, khuyến mãi, phí ship; sản phẩm hết hàng không được quảng bá như còn hàng. Ghi chú của chủ shop là dữ liệu, không thay được quy tắc.
- Bài viết lưu trong bảng `marketing_posts` (`db/migrations/002-marketing-posts.sql`). `npm run db:migrate` giờ áp dụng mọi file trong `db/migrations` theo thứ tự tên. Chưa có `DATABASE_URL` thì AI vẫn soạn được, chỉ không lưu/đăng.
- Đăng Fanpage dùng Graph API `POST /{PAGE_ID}/feed` (v26.0) với `PAGE_ID` + `PAGE_ACCESS_TOKEN`; token cần quyền `pages_manage_posts`. Token gửi trong body, không đặt trên URL. TikTok/Email chưa có API đăng: sao chép nội dung rồi bấm **Đánh dấu đã đăng**. Bài đã đăng thì không sửa được; xoá trong Tendly không xoá bài trên Fanpage.
- Mọi API /api/posts/* dùng phiên đăng nhập app và công tắc bảo vệ; user bị khóa không thể tạo/lưu/đăng bài. Admin vẫn sử dụng được. Không nhập hoặc gửi DASHBOARD_KEY từ trình duyệt.

Biến môi trường trên Vercel: `GEMINI_API_KEY`, `DATABASE_URL`, `APP_ADMIN_USERNAME`, `APP_ADMIN_PASSWORD_HASH`; thêm `PAGE_ID`, `PAGE_ACCESS_TOKEN` để đăng Fanpage. `npm test` có kiểm thử validate yêu cầu, prompt chỉ chứa sản phẩm đã chọn, làm sạch output, kiểm tra phiên app và công tắc bảo vệ, lưu/khoá bài bằng `pg-mem` và gọi Graph API giả lập.

## Bình luận Facebook và private reply

Tab **Marketing → Bài đăng Facebook** đọc trực tiếp các bài đã xuất bản của Fanpage (kể cả bài đăng ngoài Tendly). Mỗi bài mặc định thu gọn, hiển thị nội dung ngắn, thời gian và số cảm xúc/bình luận/chia sẻ. Bấm hàng bài đăng hoặc mũi tên để mở nội dung đầy đủ, ảnh và bình luận. Comment được tải khi mở bài; có phân trang bài đăng/comment và nút làm mới. Mỗi comment hiển thị tối đa ba phản hồi đầu, chuỗi dài có liên kết mở Facebook. Tab này chỉ đọc, chưa chỉnh sửa/xoá bài hoặc trả lời công khai; dùng cùng Page token và phiên đăng nhập app, không cần migration bổ sung. Ảnh/video/nhãn dán trong comment hiển thị bằng nhãn; album/video của bài có ảnh đại diện và liên kết mở bản đầy đủ trên Facebook.

Mở **Marketing → Bình luận Facebook**. Tendly nhận comment mới qua webhook Page `feed`, hiển thị 100 comment mới nhất, cho tìm/lọc, đọc bài gốc, soạn bằng AI, sửa và gửi một tin riêng bằng **Fanpage**. Khi tab mở, danh sách tự cập nhật mỗi 3 giây và lấy bù bình luận trực tiếp từ Meta nếu webhook bị lỡ. Chưa có tải toàn bộ lịch sử comment, trả lời công khai, ẩn/xoá comment hay nhắn bằng tài khoản cá nhân.

Đồng bộ dự phòng dùng `POST /api/facebook/comments` với `action: "sync"`, vẫn yêu cầu phiên app có quyền sử dụng. Migration `009-facebook-comment-sync.sql` lưu thời điểm đồng bộ và lease dùng chung giữa các instance; chỉ gọi Meta lại sau ít nhất 10 giây từ lần hoàn tất trước. Mỗi lần đối chiếu tối đa 20 bình luận mới nhất trên 10 bài mới nhất, không coi bình luận vắng trong kết quả là đã xoá. Khi Meta lỗi, giao diện giữ dữ liệu đã lưu và hiện cảnh báo. Bình luận lấy bù dùng chung hàng chờ AI, điều kiện tự gửi và chống gửi lặp với webhook; mở dashboard không bỏ qua bước duyệt khi tự gửi đang tắt. Đóng tab thì cơ chế lấy bù dừng, webhook vẫn hoạt động độc lập.

Thiết lập:

1. Chạy `npm run db:migrate` để thêm `008-facebook-comments.sql`; migration không xoá dữ liệu cũ.
2. Dùng các biến hiện có: `PAGE_ID`, `PAGE_ACCESS_TOKEN`, `META_GRAPH_VERSION`, `APP_SECRET`, `VERIFY_TOKEN`, `DATABASE_URL`, `GEMINI_API_KEY`. API quản lý dùng cùng phiên đăng nhập app với Marketing.
3. Trong Meta App, đăng ký trường Page webhook **feed**, giữ các trường Messenger hiện có. Đăng ký Page với app tại `/{PAGE_ID}/subscribed_apps` và giữ `feed` cùng các trường đang dùng; callback vẫn là `/api/meta/webhook`. Token cần quyền đọc Page/comment (`pages_read_engagement`, `pages_read_user_content`), đăng ký webhook (`pages_manage_metadata`) và private reply (`pages_messaging`). Khách ngoài vai trò thử nghiệm còn phụ thuộc quyền Advanced Access/App Review của Meta.
4. Bấm **Cập nhật dữ liệu AI** để lưu bản sản phẩm/FAQ trong trình duyệt lên PostgreSQL. Khi đổi giá, tồn kho hoặc FAQ, cập nhật lại bản này; webhook không tự đọc localStorage hoặc tự đồng bộ Shopee.
5. Mặc định shop duyệt và bấm gửi. Bấm **Bật AI tự nhắn riêng** để cho phép tự gửi cho comment mới sau thời điểm bật; AI chỉ tự gửi câu hỏi sản phẩm đủ dữ liệu. Trường hợp mơ hồ/thiếu thông tin/phàn nàn hoặc lỗi AI sẽ chờ shop. Tắt tự gửi có hiệu lực với các yêu cầu chưa được chuyển sang bước gửi; tin đã gửi tới Meta không thể thu hồi bằng nút này.

Luồng gửi sử dụng `POST /{PAGE_ID}/messages` với `recipient: { comment_id }`, kiểm tra trực tiếp `can_reply_privately` và nội dung comment trước khi gửi. Mỗi comment chỉ được một private reply trong 7 ngày; private reply chưa mở cửa sổ nhắn tiếp 24 giờ. Khi khách nhắn lại, webhook Messenger hiện có nhận tin và inbox tiếp tục áp dụng giới hạn 24 giờ. Không coi ID người comment là Messenger PSID: chỉ nối hội thoại từ `recipient_id` Meta trả về hoặc webhook Messenger. Xem [Meta Private Replies](https://developers.facebook.com/docs/messenger-platform/send-messages/private-replies/) và [Page Webhooks](https://developers.facebook.com/docs/pages-api/webhooks-for-pages/) để đối chiếu cấu hình/quyền đang áp dụng.

Comment được lưu trước khi webhook trả 200; `after()` xử lý tối đa ba comment trong mỗi lần, với giới hạn thời gian. Hàng chờ nằm trong PostgreSQL, tác vụ AI bị gián đoạn có thể nhận lại sau hai phút. Khi còn tồn đọng, dùng **Xử lý hàng chờ** với phiên app được cấp quyền. Khóa Bearer cũ không dùng để gọi scheduler; webhook vẫn lưu hàng chờ khi app đang khóa. Chưa có scheduler riêng.

Trước khi gọi Meta, hệ thống giữ chỗ gửi trong database. Timeout/HTTP 5xx/kết quả không rõ hoặc tiến trình dừng ở trạng thái `sending` không tự gửi lại; kiểm tra Messenger trước khi xử lý thủ công. Meta đã chấp nhận nhưng database lỗi sẽ báo cần đồng bộ, tránh gửi lặp. `npm test` kiểm tra SQL bằng PGlite, webhook ký HMAC, cô lập Page, edit/delete, chống gửi đồng thời, tắt tự động giữa chừng và lỗi gửi; Meta/Gemini được giả lập, không gửi tin thật cho khách.

## Livestream ("Live Cockpit")

Trang **Livestream** (`/livestream`) giúp shop bán hàng trong lúc live. Tendly đọc bình luận, **gom các câu hỏi trùng ý thành nhóm**, **giữ hàng và tạo đơn nháp** cho khách chốt, và **nhắn riêng cho cả nhóm sau khi shop duyệt một lần**. Kết thúc phiên thì Tendly làm tóm tắt và gợi ý nhập hàng.

**Lõi tách khỏi nền tảng.** `lib/services/live/engine.ts` không phụ thuộc Facebook. Nguồn bình luận là các adapter trong `lib/services/live/sources.ts`:
- `facebook`: bình luận của một video Live hoặc một bài đăng, đọc qua Graph API.
- Muốn có TikTok/Shopee Live thì viết thêm adapter tương ứng.

**Flow:** chuẩn bị phiên → lưu nháp → xem sản phẩm/giá/lượng, FAQ, mã host, bảng size có nguồn và từng quyền gửi → xác nhận **Duyệt dữ liệu & bắt đầu phiên**. Cửa sổ hỗ trợ nổi có thể mở sau bước duyệt, chờ người bán phát Live trên Page. Phiên nháp chưa thu thập hoặc gửi tin. Xem [phạm vi redesign](docs/livestream-redesign-plan.md#7-phạm-vi-đã-triển-khai).

**Chạy thử:**
1. `npm run db:migrate` (bao gồm migration `018-live-workflow.sql`).
2. Mở `/livestream`, chọn nguồn tự nhận Live hoặc bài đăng được cấp quyền, chọn SKU đã nhập tồn, điền host/mã Live và lưu nháp. Kiểm tra bản dữ liệu rồi xác nhận bắt đầu; với nguồn tự nhận, bật Phát trực tiếp trên Page sau đó.
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

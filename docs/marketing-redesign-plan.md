# Kế hoạch chỉnh sửa Marketing Tendly

Ngày lập: 05/11/2026.

Trạng thái: kế hoạch hướng đích, đã triển khai lát cắt Marketing theo mô tả cập nhật bên dưới.

Cập nhật triển khai 05/11/2026: đã thêm luồng campaign/brief, hồ sơ kênh, Content → Review, duyệt bài/ảnh, lịch có phê duyệt, liên kết bình luận và giữ công cụ cũ. Facebook dùng tích hợp hiện có; các tài khoản Instagram/TikTok/Shopee dùng mẫu để đi qua flow theo yêu cầu mới. Chi tiết chạy migration/lịch và giới hạn thực thi ở README. Tài liệu dưới đây vẫn mô tả hướng đích; catalog server dùng chung, nhiều Page thật, Review đa phương thức và attribution đầy đủ chưa hoàn tất.

## 1. Mục tiêu và phạm vi

Chuyển Marketing từ các công cụ rời nhau sang quy trình:

**Chọn chiến dịch → duyệt brief/kế hoạch → tạo nội dung → AI kiểm tra → chủ shop duyệt bài → chọn bài vào lịch → duyệt và kích hoạt lịch → đăng hoặc xuất nội dung → theo dõi kết quả.**

Nguyên tắc xuyên suốt: AI đề xuất, người dùng chấp thuận ở từng phần. Lưu bản nháp không phải duyệt; AI kiểm tra đạt không phải chủ shop duyệt; duyệt bài không tự kích hoạt đăng hoặc tự gửi tin. Chỉ thực hiện hành động trong đúng phạm vi người dùng đã chấp thuận.

AI nhận dữ liệu từ ba nguồn: hồ sơ thương hiệu dùng chung, sản phẩm/chính sách đã xác nhận và brief chiến dịch. Người dùng không phải nhập lại dữ liệu sản phẩm mỗi lần viết bài.

Ưu tiên một quy trình xuyên suốt cho một shop được phép truy cập. Bản đầu không mở rộng thành hệ thống quảng cáo, CRM giao dịch, quản lý vận đơn, hoàn tiền hoặc đối soát thanh toán.

## 2. Hiện trạng cần giữ và sửa

| Hiện trạng | Hướng xử lý |
| --- | --- |
| `MarketingShell.tsx` có sáu mục: Facebook, bình luận, hàng chờ, nhóm khách, hiệu suất, soạn bài | Tổ chức lại điều hướng; giữ các chức năng đang chạy |
| `PostComposerTab.tsx` có chọn sản phẩm, kênh, mục tiêu, tone, brand voice và ghi chú | Tái sử dụng phần tạo/sửa bài, ảnh và danh sách bài; thay đầu vào rời rạc bằng brief |
| `ApprovalQueueTab.tsx` là hàng chờ tin nhắn remarketing | Không đổi tên thành duyệt bài rồi dùng lại sai nghiệp vụ; chuyển vào khu vực Chăm sóc khách |
| Bài viết lưu ở backend, có đăng Facebook và quản lý ảnh | Mở rộng bài hiện có bằng liên kết chiến dịch và trạng thái duyệt, không tạo kho bài thứ hai |
| Sản phẩm/FAQ còn được đọc từ dữ liệu trình duyệt | Không coi ID sản phẩm hoặc bản dữ liệu client gửi là nguồn giá/chính sách đã được backend xác nhận |
| Cấu hình Content/Review có mặc định và tùy chỉnh nền tảng, chưa nối luồng AI | Dùng bộ quy tắc hiệu lực trong tạo bài và kiểm tra bài; không tạo một bộ mặc định trùng trong Marketing |
| Chưa có thực thể campaign độc lập | Bổ sung campaign và brief thực sự; không suy diễn mỗi bài viết thành một campaign |

## 3. Điều hướng và bố cục

### 3.1. Năm mục chính

| Mục | Nội dung và hành động chính |
| --- | --- |
| Chiến dịch | Tên, mục tiêu, thời gian, trạng thái brief, số bài theo trạng thái; tạo mới, chỉnh brief, mở nội dung |
| Soạn nội dung | Chọn campaign, kiểm tra brief, chọn kênh/định dạng, tạo và chỉnh bản nháp, quản lý ảnh |
| Duyệt nội dung | Bản nháp gửi duyệt, lỗi và gợi ý sửa của Review, bản xem trước, yêu cầu sửa hoặc chủ shop duyệt |
| Lịch đăng | Lịch tuần/tháng và danh sách, kịch bản đăng, chọn campaign/bài cho từng mốc, xem trước, duyệt, kích hoạt, tạm dừng và hủy lịch |
| Hiệu quả | Lọc campaign/bài, kết quả đăng và số liệu có nguồn; phân biệt chưa có dữ liệu với số 0 |

Các công cụ đang có được đặt thành khu vực phụ:

- **Fanpage:** bài đăng Facebook và bình luận Facebook.
- **Chăm sóc khách:** hàng chờ remarketing và nhóm khách theo hoạt động nhắn tin.

Không đặt thêm tám tab ngang cùng cấp. Desktop dùng điều hướng phân nhóm; điện thoại dùng cơ chế danh sách mục/đi vào/đi về hiện có của `MobileSections`.

### 3.2. Bình luận Facebook là một phần của luồng Marketing

**Giữ và kết hợp chức năng đọc bình luận, AI soạn phản hồi và tự nhắn riêng từ bình luận đang có. Không bỏ hoặc biến thành màn hình chỉ xem dữ liệu.**

Luồng mục tiêu: **Campaign → bài đã đăng → bình luận → xác định nhu cầu → AI đề xuất hoặc gửi theo chế độ cho phép → hội thoại Messenger → theo dõi kết quả có dữ liệu.**

- Trong chi tiết campaign, hiển thị bài đã đăng và lối vào bình luận của từng bài. Dùng Facebook post ID/external ID để liên kết; bài cũ hoặc bài đăng ngoài Tendly vẫn xem và xử lý được, có thể liên kết campaign thủ công nếu được phép.
- Khu Fanpage giữ danh sách bình luận tổng, bộ lọc bài/campaign/trạng thái và đồng bộ. Mở từ campaign thì chọn sẵn bộ lọc, không tạo một kho bình luận hay bộ gửi thứ hai.
- Giữ các thao tác hiện hành: bật/tắt tự gửi, cập nhật tri thức đã lưu trên server, soạn lại, sửa bản nháp, gửi sau khi duyệt và xem trạng thái/lỗi gửi.
- Mặc định người dùng duyệt tin trước khi gửi. Tự nhắn riêng là chế độ người dùng chủ động chấp thuận: nêu rõ Page, bài/campaign, đối tượng comment mới và trường hợp được trả lời. Giữ khả năng tắt ngay; ngoài phạm vi đã chấp thuận hoặc cần người xử lý thì quay về hàng chờ. Bật lịch đăng không đồng thời bật tự trả lời bình luận.
- Nêu đúng kênh phản hồi: chức năng tự động hiện tại là **nhắn riêng từ Fanpage cho người bình luận**, không mặc định là tự trả lời công khai dưới bài đăng. Trả lời công khai tự động là phạm vi riêng nếu bổ sung sau.
- Khi bình luận thuộc bài đã gắn campaign, AI đọc thêm sản phẩm, brief, CTA và ưu đãi còn hiệu lực của campaign. Không đủ căn cứ thì hỏi lại/chờ duyệt; không lấy chương trình campaign khác để trả lời.
- Quy tắc hội thoại dùng AI Chat; Content dùng để soạn bài và Review dùng để kiểm tra bài. Cần nối cấu hình có hiệu lực vào backend xử lý bình luận, không tự coi công tắc vai trò trong giao diện là đã bật luồng gửi thật.
- Giữ các kiểm tra quyền Page, quyền gửi private reply, phiên bản nội dung/cài đặt, chống gửi trùng, trạng thái gửi chưa rõ và phối hợp với Live. Không bật lại tự gửi, xử lý hồi tố comment cũ hoặc gửi hàng loạt do đổi bố cục.
- Kết quả theo campaign chỉ thống kê thứ đo được: số bình luận đã thu thập, chờ xử lý, gửi thành công/thất bại. Chỉ tính số hội thoại hoặc chuyển đổi khi có liên kết chứng minh; không suy ra đơn/doanh thu từ một comment hay tin gửi thành công.

### 3.3. Màn hình soạn nội dung

- Đầu trang: campaign hiện tại, trạng thái lưu và hành động đổi/chỉnh brief.
- Khu nhập: các nhóm thông tin ngắn, chỉ hiện trường liên quan tới mục tiêu và định dạng.
- Khu tóm tắt: **AI sẽ dùng những thông tin này** — sản phẩm, đối tượng, thông điệp, ưu đãi, giọng văn, CTA và nguồn chính sách.
- Khu kết quả: bản nháp, chỉnh sửa, ảnh, kiểm tra và gửi duyệt.
- Trên điện thoại: xếp dọc, tóm tắt có thể thu gọn; không bắt người dùng điền thông số kỹ thuật đã có trong sản phẩm.

Giữ font REM, bảng màu và các control hiện có. Không thêm banner prototype, giải thích localStorage hoặc thông báo triển khai vào luồng sản phẩm.

## 4. Dữ liệu dùng chung: thiết lập một lần

Marketing đọc và cho phép mở nơi quản lý gốc; không sao chép thành nhiều bản độc lập.

| Nhóm | Thông tin cần lưu | Nơi quản lý |
| --- | --- | --- |
| Thương hiệu | Tên, mô tả ngắn, tính cách, cách xưng hô, từ nên dùng/từ tránh | Cài đặt shop; quy tắc hành vi Content/Review vẫn ở Thiết lập AI |
| Sản phẩm | SKU, tên, thương hiệu, mô tả, thông số, chất liệu/thành phần, dung tích/kích thước nếu phù hợp, xuất xứ, màu/size, features, benefits, USP, ảnh, giới hạn tuyên bố | Nguồn sản phẩm; bổ sung trường còn thiếu thay vì nhập lại trong campaign |
| Nhóm khách mẫu | Tên nhóm, mô tả, nhu cầu, pain points, động cơ, rào cản; nhân khẩu học tùy chọn | Phần đối tượng trong brief cho phép lưu và dùng lại nhóm |
| Chính sách | Các FAQ đang bật và đã được shop xác nhận để quảng bá | FAQ/chính sách |
| Bằng chứng | Trích feedback, loại nguồn, tham chiếu nguồn, sản phẩm liên quan, xác nhận được phép sử dụng | Gắn với sản phẩm; bản đầu hỗ trợ nhập tay, không tự thu thập review |

Trường không áp dụng để trống. Không bắt shop quần áo nhập dung tích hoặc shop mỹ phẩm nhập size quần áo. Không tự biến lợi ích mô tả thành cam kết hiệu quả đã được chứng minh.

### 4.1. Hồ sơ riêng từng Page/tài khoản

Thêm hồ sơ gắn ID nền tảng/tài khoản đã được phép truy cập, không dùng tên hiển thị làm khóa. Các trường:

- Thương hiệu/shop sở hữu, mục đích của kênh: bán hàng, cộng đồng, hỗ trợ hoặc giới thiệu thương hiệu.
- Đối tượng chính, nhu cầu, pain points, động cơ và rào cản; có thể tham chiếu nhóm khách đã lưu.
- Danh mục sản phẩm được phép quảng bá; mặc định theo quyền shop, cấu hình Page chỉ thu hẹp, không mở thêm quyền.
- Cách xưng hô, giọng văn, mức trang trọng, emoji và góc tiếp cận ưu tiên: giá, chất lượng, chuyên môn, trải nghiệm hoặc câu chuyện.
- Định dạng ưu tiên, CTA mặc định, từ nên dùng/từ tránh và giới hạn tuyên bố.
- Các chính sách/ưu đãi được xác nhận và phạm vi áp dụng; không tự coi mọi ưu đãi shop đều áp dụng cho Page.
- Người duyệt nội dung; liên kết người phụ trách CSKH/giờ hỗ trợ từ hồ sơ vận hành dùng chung.

Hai Page Facebook có thể dùng chung sản phẩm nhưng khác đối tượng, cách xưng hô và cách tiếp cận. Có màn hình thử và xem cấu hình hiệu lực trước khi xác nhận áp dụng; không yêu cầu tạo prompt dài riêng cho mỗi Page.

### 4.2. Kế thừa theo vai trò và từng trường

Marketing/Content: **thương hiệu → vai trò AI → nền tảng → Page/tài khoản → campaign**. Đối tượng trong campaign có thể cụ thể hơn đối tượng Page, nhưng không vượt giới hạn sản phẩm/chính sách của Page.

- Trường chưa tùy chỉnh kế thừa cấp trước; tắt tùy chỉnh giữ bản nháp riêng để có thể bật lại.
- Hiển thị nguồn của từng giá trị: mặc định, nền tảng, Page hoặc campaign. Cho xem bản tổng hợp trước khi tạo bài.
- Không có một chuỗi kế thừa bắt buộc cho mọi AI: Customer Care theo shop/chính sách → kênh/Page → hội thoại/đơn; Live theo shop → kênh/Page → phiên; Sourcing theo shop → yêu cầu tìm nguồn.
- Các tầng văn phong không được ghi đè quyền truy cập, quyền gửi/đăng, dữ kiện có nguồn, điều kiện ưu đãi hoặc yêu cầu phê duyệt. Dữ liệu mâu thuẫn phải dừng để xác nhận, không giải quyết bằng cách lấy prompt gần nhất.
- Chọn tài khoản đích trước khi tạo bài theo Page. Đổi tài khoản thì cập nhật bản xem trước, kiểm tra lại và duyệt lại; không dùng một bản đã duyệt cho Page khác âm thầm.

### 4.3. Ví dụ chuẩn, thử cấu hình và kết nối ngữ cảnh

- Mỗi Page có thể lưu một số bài/câu trả lời mẫu đã duyệt, ví dụ cần tránh và lý do; không để ví dụ ghi đè giá/chính sách thật.
- Khi chủ shop sửa bài, mặc định chỉ sửa bài đó. Hành động riêng “Đề xuất cập nhật quy tắc Page” tạo thay đổi chờ duyệt; không tự học mọi chỉnh sửa thành quy tắc chung.
- Bản xem trước gồm tài khoản đích, vai trò, đối tượng, giọng, sản phẩm, ưu đãi/hiệu lực, CTA, dữ liệu thiếu và người duyệt. Cho thử một tình huống trước khi áp dụng cấu hình.
- Giữ liên kết campaign → bài/phiên bản → Facebook post ID → comment → hội thoại khi có bằng chứng liên kết. Inbox hỏi lại nếu nguồn campaign không chắc chắn; không ghép khách bằng tên hoặc suy diễn mọi tin nhắn đều từ campaign gần nhất.
- Phân vai: Marketing lập mục tiêu/kế hoạch; Content viết theo brief; Review đối chiếu; Customer Care xử lý nhu cầu từ comment/Inbox. Các vai trò không có quyền tự duyệt đầu ra của nhau.

## 5. Brief chiến dịch

Hồ sơ và quy tắc hiệu lực cho brief được xác định theo các mục 4.1–4.3; không chỉ dựa vào nền tảng chung.

### 5.1. Bộ trường chung

| Trường | Bắt buộc | Quy tắc |
| --- | --- | --- |
| Tên chiến dịch | Có | Tên nội bộ để tìm và liên kết nội dung |
| Mục tiêu | Có | Giới thiệu sản phẩm, ra đơn, kéo người xem Live, tương tác, xả hàng; giữ khả năng đọc mục tiêu cũ |
| Sản phẩm | Với nội dung bán sản phẩm | Chọn ID từ danh mục, không gõ lại giá/USP |
| Đối tượng | Có | Chọn nhóm đã lưu hoặc mô tả ngắn |
| Nhu cầu/pain point chính | Có | Một vấn đề cụ thể nội dung cần giải quyết |
| Thông điệp chính | Có | Điều muốn khách nhớ sau khi đọc |
| Benefits/USP ưu tiên | Nên có | Chọn từ sản phẩm; thiếu thì dẫn tới chỉnh sản phẩm |
| Rào cản mua | Không | Những lo ngại cần giải đáp, không tự coi là sự thật về mọi khách |
| Thời gian chiến dịch | Theo mục tiêu | Bắt buộc khi có mốc sự kiện/ưu đãi; không đồng nghĩa lịch tự đăng |
| Kênh | Có | Chọn nền tảng để tạo nội dung; tách khỏi quyền đăng trực tiếp |
| Định dạng | Có | Bài bán hàng, storytelling, caption, kịch bản video hoặc bài mời xem Live |
| Giọng văn | Có mặc định | Kế thừa Content theo nền tảng; cho sửa riêng trong brief |
| CTA và đích đến | Với nội dung chuyển đổi | Inbox, bình luận, link sản phẩm, link Live; yêu cầu URL nếu chọn hành động dùng link |
| Nội dung phải có/tránh | Không | Chỉ dẫn chiến dịch không được vượt dữ kiện, quyền hành động và giới hạn thương hiệu |

Không bắt buộc mọi ô tuổi, giới tính, nghề nghiệp, khu vực. Mô tả theo nhu cầu là đầu vào chính; các bộ lọc nhân khẩu học chỉ mở khi shop cần.

Brief có trạng thái **Nháp / Sẵn sàng tạo nội dung / Lưu trữ**. Sẵn sàng chỉ phản ánh dữ liệu đầu vào đủ theo lựa chọn, không phải campaign đã được triển khai hoặc có hiệu quả.

### 5.2. Ưu đãi có điều kiện

Mặc định **Không áp dụng ưu đãi**. Khi bật, hiển thị:

- Loại: giảm giá, voucher, combo, quà tặng hoặc freeship.
- Sản phẩm áp dụng, giá trị/giá ưu đãi, mã voucher nếu có.
- Điều kiện: giá trị đơn tối thiểu, số lượng mua, nhóm khách, kênh áp dụng.
- Quà tặng và số lượng/giới hạn sử dụng nếu có.
- Thời điểm bắt đầu/kết thúc, múi giờ shop.
- Chủ shop xác nhận được phép quảng bá.

Kiểm tra số tiền không âm, phần trăm hợp lệ, thời gian kết thúc sau bắt đầu, sản phẩm còn tồn tại và điều kiện không mâu thuẫn. Ưu đãi hết hạn hoặc chưa xác nhận không được viết như đang có hiệu lực.

Đây là dữ liệu chương trình để soạn/kiểm tra nội dung; không tự tạo voucher trên sàn, giữ hàng hoặc áp giá checkout.

### 5.3. Trường theo ngữ cảnh

| Lựa chọn | Trường bổ sung |
| --- | --- |
| Facebook/storytelling | Góc tiếp cận, độ dài, câu hỏi tương tác tùy chọn |
| Instagram caption | Mô tả ảnh/video đi kèm, độ dài, yêu cầu hashtag |
| TikTok/Reels script | Thời lượng 15–45 giây, người nói, bối cảnh quay, yêu cầu hook 3 giây đầu; kết quả theo cảnh/lời thoại |
| Kéo người xem Live | Chọn phiên nếu đã có; nếu chưa có thì nhập thông tin sự kiện dự kiến, thời gian, chủ đề, link và deal xác nhận |
| Xả hàng | SKU/biến thể, lượng dành cho chương trình nếu đã biết, giá và hạn kết thúc; không suy diễn tồn tổng thành tồn từng biến thể |
| Dùng feedback | Chọn bằng chứng đã xác nhận; không cho AI tự tạo người mua hoặc lời chứng thực |

Bản đầu ưu tiên Facebook bài viết và TikTok caption đang có. Instagram caption và kịch bản video mở ở bước sau, cùng schema kiểm tra đầu vào/đầu ra tương ứng. Shopee/Lazada Feed chưa nằm trong đợt đầu.

## 6. Hợp đồng dữ liệu và lưu trữ

Tận dụng PostgreSQL/API bài viết hiện có; không thêm state library, CMS hoặc kho bài mới.

Các dữ liệu cần bổ sung tối thiểu:

- **MarketingBrandProfile:** hồ sơ thương hiệu theo shop được cấp quyền.
- **ChannelAccountProfile:** hồ sơ Page/tài khoản, liên kết nhóm khách/sản phẩm, tùy chỉnh theo trường, ví dụ đã duyệt, phiên bản và lịch sử chấp thuận. Dùng chung với Care/Review/Live theo phạm vi cần thiết.
- **MarketingAudience:** nhóm khách do shop mô tả, không suy diễn thành phân hạng loyalty hoặc thông tin nhân khẩu học đã xác minh.
- **MarketingCampaign:** tên, mục tiêu, trạng thái, brief, chương trình ưu đãi, phiên bản và thời gian cập nhật.
- **MarketingPost mở rộng:** campaign ID có thể rỗng cho bài cũ; kênh/định dạng; trạng thái duyệt; phiên bản nội dung.
- **Bản đầu vào đã dùng và kết quả Review:** brief, dữ liệu tham chiếu, bộ quy tắc hiệu lực tại lần tạo/kiểm tra; lỗi, gợi ý, phiên bản bài và người/thời điểm duyệt.
- **Lịch và lần đăng:** kịch bản, múi giờ, khoảng lặp/ngoại lệ; các mốc cụ thể gắn campaign, bài/ảnh và phiên bản được duyệt, tài khoản đích, trạng thái thực thi, kết quả đăng và khóa chống thực thi trùng.
- **Chấp thuận:** người/thời điểm, hành động, phạm vi, phiên bản dữ liệu, trạng thái thu hồi; có thể gắn nhiều mục cụ thể với một lần duyệt có xem trước.

Chỉ chụp lại dữ liệu phục vụ truy vết lần tạo/duyệt; không xây kho tri thức song song. Đọc dữ liệu mới cho lần tạo tiếp theo, giữ bản đầu vào cũ để giải thích bài đã tạo.

Phụ thuộc cần giải quyết: danh mục/FAQ hiện còn ở trình duyệt. Trước khi dùng chúng làm nguồn giá/chính sách có thẩm quyền để duyệt/đăng, cần lưu bản shop xác nhận lên server. Nhập dữ liệu cũ phải có xem trước, xác nhận, báo xung đột SKU và chỉ bỏ bản cũ sau khi lưu thành công. Bản client gửi chỉ được coi là đầu vào cần kiểm tra, không tự coi là sự thật backend.

Mọi API campaign/bài/nguồn dùng cùng phạm vi shop/Page được cấp quyền ở server. Không mở rộng quyền chỉ vì client gửi campaign ID, product ID hoặc Page ID khác. Khi lưu xung đột phiên bản phải báo và cho tải lại, không ghi đè bản mới âm thầm.

## 7. Luồng AI và phê duyệt

### 7.1. Các điểm chấp thuận bắt buộc

| Phần | AI/hệ thống có thể đề xuất | Người dùng cần chấp thuận |
| --- | --- | --- |
| Dữ liệu dùng chung | Tóm tắt, gợi ý trường còn thiếu | Xác nhận thông tin thương hiệu, sản phẩm, chính sách, feedback trước khi coi là nguồn đã xác nhận |
| Brief và kế hoạch campaign | Đối tượng, thông điệp, góc tiếp cận, dàn ý và các bài dự kiến | Duyệt brief/kế hoạch trước khi dùng để tạo loạt bài; chọn mục cần sửa hoặc từ chối |
| Ưu đãi | Gợi ý cách trình bày chương trình | Xác nhận giá, điều kiện, giới hạn và hiệu lực; AI không tự tạo deal thật |
| Bài viết và ảnh | Content tạo nháp; Review tự đối chiếu và sửa bản mới trước khi hiển thị | Chủ shop duyệt bản cuối/ảnh cụ thể; kiểm tra lại bài đang sửa hoặc đã duyệt chỉ tạo bản sửa ứng viên, không ghi đè âm thầm |
| Lịch đăng | Gợi ý kịch bản, phân bổ mốc, ghép bài với mốc | Xem trước các lần đăng, xác nhận bài/phiên bản/kênh/giờ rồi kích hoạt lịch |
| Bình luận và remarketing | Soạn câu trả lời, phân loại nhu cầu | Duyệt từng tin hoặc chủ động bật tự gửi trong phạm vi xác định; giữ riêng hai luồng |
| Điều chỉnh sau khi có kết quả | Gợi ý đổi nội dung, ưu đãi hoặc lịch | Chấp thuận thay đổi; AI không tự sửa campaign, dời lịch hoặc tăng tần suất |

Mỗi hành động duyệt phải ghi người duyệt, thời điểm và phiên bản/phạm vi được duyệt. Có thể duyệt nhiều mục cùng lúc khi người dùng đã xem danh sách cụ thể; không dùng nút đồng ý chung để cho phép mọi nội dung AI tạo trong tương lai. Có thao tác yêu cầu sửa, từ chối và thu hồi/tạm dừng trước khi hành động diễn ra.

### 7.2. Tạo, kiểm tra và duyệt bài

1. Chủ shop lưu brief; server kiểm tra cấu trúc, quyền và dữ liệu nguồn.
2. Tổng hợp bản brief một trang: sản phẩm/USP, đối tượng/pain point, thông điệp, giọng, kênh/format, ưu đãi/CTA, bằng chứng và giới hạn.
3. Lấy quy tắc Content hiệu lực: thương hiệu/vai trò → các trường nền tảng được bật tùy chỉnh → Page/tài khoản → yêu cầu chiến dịch trong phạm vi được phép; hiển thị nguồn kế thừa của từng trường.
4. Tạo bản nháp bằng luồng Gemini hiện có; lưu liên kết campaign và đầu vào đã dùng.
5. Review lấy thông tin cần thiết làm căn cứ đối chiếu theo bản nháp/brief; có thể dùng nguồn trùng hoặc bổ sung ngoài Content, không bắt buộc cùng bộ dữ liệu. Server kiểm tra quyền, đúng shop/Page/campaign, phiên bản và hiệu lực của nguồn trước khi rà/sửa bản nháp mới. Code kiểm tra đầu vào/đầu ra: trường bắt buộc, giá/ưu đãi, hiệu lực, URL, sản phẩm và dữ kiện còn thiếu. Giữ bản gốc, tham chiếu căn cứ Review và tóm tắt sửa để so sánh; thiếu/mâu thuẫn thì yêu cầu xác nhận, không tự bù dữ kiện. Chi tiết tại [kế hoạch Review](review-redesign-plan.md).
6. Kết quả Review gồm: đạt/cần sửa/chặn; loại vấn đề, vị trí/đoạn liên quan, lý do và gợi ý sửa. Lỗi gọi AI phải hiện chưa kiểm tra, không coi là đạt.
7. Chủ shop xem bản đã rà/sửa rồi sửa tiếp hoặc duyệt. Sửa nội dung/ảnh/brief/quy tắc liên quan làm kết quả kiểm tra/phê duyệt cũ hết hiệu lực theo phần bị ảnh hưởng; cần kiểm tra lại. Review bản mới là bước thuộc hành động tạo nội dung, không thay chấp thuận xuất bản của người dùng.
8. Khi đăng ngay, người dùng xác nhận hành động đăng. Khi đăng theo lịch, cần lịch đã được duyệt/kích hoạt với đúng bài và phiên bản. Server kiểm tra lại quyền, phiên bản đã duyệt, dữ liệu/ưu đãi còn hiệu lực và khả năng của kênh. Chỉ Facebook dùng luồng đăng hiện có; các kênh chưa tích hợp cho sao chép/xuất nội dung.

AI Review không phải chứng nhận tuân thủ nền tảng và không thay chủ shop phê duyệt. Không tự đăng chỉ vì AI đánh giá đạt.

### 7.3. Lịch đăng theo kịch bản

Lịch đăng là bước sau kế hoạch và bài viết, đồng thời cho phép lập các ô lịch nháp trước khi có bài. Mỗi ô cần chọn campaign và bài tương ứng; ô chưa có bài hoặc bài chưa duyệt chưa được kích hoạt.

| Kịch bản | Thông tin thiết lập |
| --- | --- |
| Đăng một lần | Ngày giờ cụ thể, campaign, bài, kênh và tài khoản đích |
| Đăng hằng tuần | Thứ trong tuần, giờ, ngày bắt đầu/kết thúc hoặc số lần; chọn bài cho từng lần |
| Dịp lễ/sự kiện | Tên sự kiện, ngày diễn ra, các mốc trước/trong/sau sự kiện; chọn bài phù hợp từng mốc |
| Kích sale/flash sale | Chương trình ưu đãi được xác nhận; các mốc mở bán, nhắc sale, kết thúc; tất cả mốc nằm trong thời gian được phép quảng bá |
| Giới thiệu sản phẩm mới | Các mốc hé lộ, ra mắt, giải thích lợi ích và giải đáp thắc mắc |
| Livestream | Chọn campaign/phiên hoặc sự kiện Live dự kiến; mốc mời xem, nhắc trước giờ và nội dung sau Live |
| Xả hàng/tái giới thiệu | SKU áp dụng, đợt đăng, bài tương ứng; kiểm tra lại dữ liệu giá/tồn cần dùng trước khi đăng |
| Tự sắp xếp | Người dùng thêm các mốc và đặt tên giai đoạn; không cần bộ lập trình quy tắc tổng quát |

Mẫu chỉ tạo cấu trúc lịch nháp; không tự tạo ưu đãi hoặc kích hoạt đăng. Ngày lễ/sự kiện do người dùng chọn và xác nhận; không mặc định lặp hằng năm hoặc suy đoán ngày âm lịch.

Các trường chung:

- Tên lịch/kịch bản, campaign mặc định và múi giờ shop.
- Khoảng thời gian, quy tắc lặp đơn giản hoặc các mốc riêng, ngày ngoại lệ cần bỏ qua.
- Từng lần đăng: ngày giờ, campaign, bài, phiên bản đã duyệt, kênh và tài khoản đích.
- Bản xem trước toàn bộ các lần đăng trong khoảng đã chọn; cảnh báo trùng giờ, lặp bài, ưu đãi hết hạn hoặc thiếu dữ liệu.
- Có thể lấy bài từ nhiều campaign trong cùng lịch, nhưng mỗi lần đăng chỉ rõ campaign của bài đó; không trộn ưu đãi/ngữ cảnh giữa campaign.

Không tự luân phiên hoặc chọn bài mới vào lịch đã duyệt. Người dùng có thể chấp thuận dùng lại cùng bài cho nhiều mốc sau khi xem cảnh báo; mỗi mốc là một lần thực thi riêng. Lịch lặp cần ngày kết thúc hoặc số lần hữu hạn; gia hạn tạo các mốc mới để duyệt, không mở quyền đăng vô thời hạn.

Trạng thái lịch: **Nháp → Chờ duyệt → Đã duyệt → Đang hoạt động → Hoàn tất**, có **Tạm dừng / Đã hủy**. Từng lần đăng theo dõi riêng: **Chưa đủ điều kiện / Đã lên lịch / Đang đăng / Đã đăng / Thất bại / Chưa rõ kết quả / Đã bỏ qua**. Không coi kích hoạt lịch là đã đăng thành công.

Sửa bài/ảnh, đổi bài/campaign, tài khoản, thời điểm hoặc quy tắc lặp làm các mốc tương lai bị ảnh hưởng quay về chờ duyệt. Tạm dừng/hủy phải có hiệu lực ở backend; tác vụ đến hạn kiểm tra lại trạng thái trước khi gửi. Đã đăng thì giữ lịch sử, không tự xóa bài trên nền tảng khi hủy lịch.

Đến hạn chỉ đăng đúng nội dung/ảnh đã được duyệt; không gọi AI viết lại tại thời điểm gửi. Dữ kiện giá, ưu đãi hoặc liên kết có thay đổi khiến bài không còn đúng thì dừng và yêu cầu sửa/duyệt lại, không tự chỉnh câu chữ. Mốc bị lỡ khi hệ thống gián đoạn không được tự dồn thành loạt bài; báo để người dùng quyết định bỏ qua hoặc dời lịch.

Backend lưu lịch và các lần đăng, dùng tác vụ chạy nền gọi lại luồng đăng hiện có. Không dựa vào tab trình duyệt đang mở hoặc `setTimeout` của client. Khóa theo từng lần đăng, chống thực thi trùng; kết quả gửi không rõ phải xác minh trước khi thử lại. Kênh chưa có tích hợp đăng chỉ nhắc lịch và cung cấp nội dung xuất, không hiển thị như đã tự đăng.

## 8. Thứ tự triển khai

| Bước | Công việc | Điều kiện hoàn tất |
| --- | --- | --- |
| 1. Chốt dữ liệu | Chốt schema brand/Page/audience/campaign/offer, kế thừa theo trường, migration tương thích bài cũ, phạm vi quyền, nguồn sản phẩm/FAQ xác nhận | Tạo/sửa/đọc brief sau tải lại; hai Page dùng đúng cấu hình riêng; xác định rõ dữ liệu nào còn thiếu; bài cũ vẫn mở được |
| 2. Tạo chiến dịch | Danh sách campaign, form brief nhóm ngắn, ưu đãi có điều kiện, chọn dữ liệu dùng chung | Tạo được brief đủ điều kiện, không nhập lại thông số sản phẩm; giữ bản nháp khi đổi mục |
| 3. Nối soạn bài | Điều chỉnh composer, bộ tóm tắt đầu vào, Content rules, campaign ID, định dạng Facebook/TikTok caption | Có bài nháp gắn đúng campaign; sửa brief/default thực sự thay đổi đầu vào AI |
| 4. Nối Review/duyệt | Review rules, kết quả lỗi/gợi ý, trạng thái duyệt và kiểm tra phiên bản trước đăng | Giá/ưu đãi sai bị phát hiện; sửa bài làm hết hiệu lực duyệt; chủ shop duyệt trước đăng |
| 5. Lịch đăng | Dữ liệu lịch/lần đăng, các mẫu kịch bản, ghép campaign/bài, xem trước và duyệt/kích hoạt; tác vụ nền theo kênh hỗ trợ | Lịch tuần/sự kiện/sale chọn đúng bài; chỉ đăng phiên bản đã duyệt; tạm dừng và chống đăng trùng hoạt động ở server |
| 6. Tổ chức Marketing | Năm mục chính, khu Fanpage/Chăm sóc khách, link cũ, sửa liên kết AI Management | Không mất công cụ cũ; link soạn/duyệt/lịch/remarketing mở đúng nghiệp vụ; desktop/mobile dùng được |
| 7. Theo dõi và mở rộng | Bộ lọc hiệu quả theo campaign và lịch; thêm Instagram caption/video script khi hợp đồng dữ liệu hoàn tất | Số liệu có nguồn rõ ràng; tạo nội dung không bị nhầm với đã đăng; không suy ra doanh thu từ tương tác |

Lát cắt đầu tiên nên làm: **một shop → một campaign được duyệt → một sản phẩm → một bài Facebook → Review → chủ shop duyệt bài → một mốc lịch được duyệt/kích hoạt → đăng qua luồng hiện có**. Sau đó thêm lặp tuần và các mẫu nhiều mốc; các mẫu dùng chung cấu trúc lịch, không xây mỗi kịch bản thành một hệ thống riêng.

## 9. Các vị trí thay đổi dự kiến

| Khu vực | File hiện có / hướng bổ sung |
| --- | --- |
| Điều hướng | `components/features/marketing/MarketingShell.tsx`, `lib/types/marketing.ts`, `MobileSections`, CSS Marketing |
| Brief/campaign | Thêm component campaign và editor trong thư mục Marketing; thêm types, service và API theo cách tổ chức hiện có |
| Soạn nội dung | `PostComposerTab.tsx`, `lib/types/posts.ts`, `postsClient.ts`, `aiPost.ts`, `/api/posts/generate` |
| Lưu bài/duyệt/đăng | `postsPostgres.ts`, API bài viết/đăng, migration database; thêm Review server và giao diện duyệt bài |
| Lịch đăng | Thêm giao diện lịch và ghép bài/campaign, types/API/service lưu lịch và từng lần đăng, migration, tác vụ nền; gọi lại luồng publish có kiểm tra quyền và phê duyệt |
| Quy tắc AI | `aiConfiguration.ts`, `AiConfigShell.tsx`; chuyển nguồn cấu hình cần thực thi sang server có quyền truy cập |
| Tri thức | Product editor/types/service, FAQ và dữ liệu shop; thêm trường thiếu và luồng xác nhận lưu server |
| Hiệu quả | `CampaignPerformanceTab.tsx`, `marketingClient.ts`, `marketingInsights.ts`; liên kết bài và campaign |
| Chức năng cũ | Giữ `ApprovalQueueTab.tsx`, `CustomerSegmentsTab.tsx`, `FacebookPostsTab.tsx`, `FacebookCommentsTab.tsx` |
| Bình luận gắn campaign | Mở rộng bộ lọc/liên kết trong `FacebookCommentsTab.tsx`, `FacebookPostsTab.tsx`, API comments và `facebookComments.ts`; tái sử dụng `facebookCommentSync.ts` và luồng gửi hiện có |

Đặc biệt giữ tương thích `?tab=queue`: đây đang là remarketing. Mục duyệt bài mới dùng key riêng. Link AI Review phải dẫn tới đúng hàng chờ bài viết sau khi mục này tồn tại.

## 10. Kiểm tra và tiêu chí nghiệm thu

- Validation có kiểm thử cho brief thiếu trường theo mục tiêu, CTA/link, khoảng thời gian, giá/ưu đãi, sản phẩm không tồn tại và quyền truy cập chéo.
- Có kiểm thử kế thừa quy tắc, đầu vào tạo bài thực sự chứa brief, không đưa ưu đãi chưa xác nhận/hết hạn hoặc feedback không có nguồn vào nội dung như sự thật.
- Kiểm tra hai Page cùng nền tảng có giọng/đối tượng khác nhau, đổi tài khoản sau duyệt, nguồn từng trường và sửa ví dụ chỉ cho lần này so với đề xuất cập nhật quy tắc chờ duyệt. Nội dung campaign không vượt quyền/chính sách chỉ bằng tùy chỉnh prompt.
- Lưu được draft, báo lỗi lưu/AI rõ ràng, không mất nội dung khi đổi mục/tải lại sau lưu; cảnh báo khi rời với thay đổi chưa lưu.
- Bài cũ không có campaign vẫn sửa/xem được; migration không tự gán sai campaign hoặc trạng thái đã duyệt.
- Sửa bài/ảnh sau duyệt, hai tab trình duyệt lưu đè nhau, đăng lại và ưu đãi hết hạn trước lúc đăng đều được kiểm tra.
- Mỗi điểm chấp thuận có phiên bản/phạm vi/người duyệt; lưu nháp hoặc AI đánh giá đạt không tự bật bước tiếp theo. Kiểm tra từ chối, yêu cầu sửa, thu hồi, duyệt nhiều mục cụ thể và thay đổi sau duyệt.
- Kiểm tra lịch một lần/lặp tuần/sự kiện/sale, múi giờ, ngày ngoại lệ, giới hạn số lần và xem trước; không xếp bài sai campaign hoặc tự điền ô lịch bằng bài chưa duyệt.
- Kiểm tra lịch bị dời/sửa, tạm dừng/hủy sát giờ, tác vụ chạy lại/chạy đồng thời, mất quyền Page, ưu đãi hết hạn, mốc bị lỡ và kết quả gửi chưa rõ; không đăng trùng hoặc tự dồn lịch bù.
- Luồng remarketing, bình luận, bài Facebook và nhóm khách không bị mất hoặc đổi nghĩa.
- Đi từ campaign tới bình luận đúng bài; bài ngoài campaign vẫn xử lý được. AI dùng đúng ngữ cảnh campaign, không dùng ưu đãi hết hạn hoặc ưu đãi của campaign khác.
- Kiểm tra tự nhắn riêng bật/tắt, duyệt thủ công, không gửi lại comment đã xử lý, gửi chưa rõ kết quả và trùng nguồn với Live. Redesign không tự kích hoạt hành động gửi thật.
- Kiểm tra trình duyệt ở 390, 768 và 1440 px; nhãn form, thao tác bàn phím, trạng thái tải/trống/lỗi và độ dài nội dung thật.
- Chạy kiểm thử phù hợp, ESLint và build. Kiểm thử với dữ liệu chặn/mô phỏng không được báo là đã đăng Facebook hoặc đã xác thực provider thật.

## 11. Chưa làm trong đợt này

Chưa làm tự chạy quảng cáo, quản lý ngân sách, tự tối ưu campaign hoặc tự sửa lịch không qua duyệt, tích hợp đăng thêm nền tảng, crawler feedback, cấp voucher thật, vận đơn/đổi trả/hoàn tiền, loyalty/CRM giao dịch hoặc báo cáo doanh thu quy thuộc campaign khi chưa có dữ liệu đơn hàng. Lịch đăng có phê duyệt nằm trong phạm vi kế hoạch này.

Các nhánh đó có thể dùng lại brief và liên kết campaign sau này; không thêm bảng/cấu hình dự phòng cho chúng ở bước đầu.

## 12. Kế hoạch liên quan và ranh giới dùng chung

Content nằm trong kế hoạch Marketing này. Bốn vai trò còn lại:

| Vai trò | Kế hoạch | Phạm vi phụ thuộc ngữ cảnh |
| --- | --- | --- |
| Customer Care / AI Chat | [customer-care-redesign-plan.md](customer-care-redesign-plan.md) | Shop/chính sách → kênh/Page → hội thoại/đơn |
| AI Review | [review-redesign-plan.md](review-redesign-plan.md) | Brief và dữ liệu đúng Page/campaign, bài/ảnh và phiên bản cần kiểm tra |
| AI Livestream | [livestream-redesign-plan.md](livestream-redesign-plan.md) | Shop → kênh/Page → phiên live; không xây hệ cấu hình thương hiệu riêng phức tạp |
| AI Smart Sourcing | [smart-sourcing-redesign-plan.md](smart-sourcing-redesign-plan.md) | Shop → yêu cầu tìm nguồn; không cần tầng Page bắt buộc |

Hồ sơ shop/Page, tri thức xác nhận, quy tắc hiệu lực và bản ghi chấp thuận là dữ liệu dùng chung, không tạo năm bản sao. Mỗi plan sở hữu giao diện/luồng nghiệp vụ của vai trò mình. Review không sở hữu lịch đăng; Care không tạo kho campaign; Live không thay hệ thống kho; Sourcing không tự nhập kết quả vào danh mục bán.

Thứ tự chung: chuẩn hóa dữ liệu/quyền và hồ sơ Page → nối cấu hình Content/Care/Review vào backend → hoàn thành lát cắt campaign/bài/duyệt/lịch/bình luận → bổ sung ngữ cảnh phiên Live và nối Sourcing với nguồn thực. Các phần UI độc lập có thể làm sớm, nhưng không báo hoàn tất nghiệp vụ trước khi luồng dữ liệu/phê duyệt tương ứng chạy được.

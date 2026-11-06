# Kế hoạch bổ sung AI Smart Sourcing

Ngày lập: 05/11/2026. Trạng thái: đã triển khai luồng yêu cầu → duyệt truy vấn → thu thập → lựa chọn/chuyển nháp; phạm vi xác minh ở mục 7.

Liên quan: [Marketing](marketing-redesign-plan.md), [Livestream](livestream-redesign-plan.md). Sourcing phục vụ shop và yêu cầu tìm nguồn, không bắt buộc cấu hình theo từng Page.

## 1. Giữ định hướng, nối nguồn dữ liệu thực

Giữ hai luồng khám phá sản phẩm và tìm đầu mối nhà cung cấp. UI `SmartSourcing.tsx` hiện dùng dữ liệu mẫu theo ngành; backend có lập truy vấn, chạy nguồn và lưu tiến trình/kết quả nhưng chưa đồng nghĩa UI đã nối hoặc mọi provider đã được kiểm thử trực tiếp.

Không làm lại crawler hoặc tạo tầng văn phong Page không cần thiết. Phạm vi chính là tiêu chí tìm, xác nhận truy vấn, nguồn kết quả và quyết định của chủ shop.

## 2. Thiết lập shop và từng yêu cầu

Chuỗi cấu hình: **shop → yêu cầu tìm nguồn**. Đối tượng/phong cách thương hiệu chỉ là gợi ý tùy chọn để lọc sản phẩm, không cần chọn Page.

| Nhóm | Trường |
| --- | --- |
| Mặc định shop | Ngành hàng, phân khúc, thị trường bán, nhóm sản phẩm quan tâm/loại trừ |
| Nhu cầu | Sản phẩm/từ khóa, thuộc tính bắt buộc, mục đích tìm: khám phá hay nhà cung cấp |
| Giá | Khoảng giá nhập mong muốn, đơn vị tiền, đơn vị hàng; không coi là giá bán lẻ/giá đã gồm vận chuyển |
| Số lượng | Lượng dự kiến mua, MOQ tối đa chấp nhận, đơn vị |
| Nhà cung cấp | Khu vực, thời gian cung ứng mong muốn, yêu cầu chất lượng/chứng từ nếu cần |
| Thu thập | Nguồn, ngôn ngữ/khu vực, khoảng thời gian và giới hạn số kết quả/lượt chạy |
| Tùy chọn | Nhóm khách/phong cách, khoảng giá bán dự kiến; không tự suy ra biên lợi nhuận khi thiếu chi phí |

Trường không có nguồn thì để chưa biết. MOQ thiếu không bằng 0, giá chưa rõ tiền tệ/đơn vị không được xếp là rẻ nhất. Không bắt tiêu chí chứng từ cho mọi ngành.

## 3. Luồng và điểm chấp thuận

1. Người dùng xác nhận nhu cầu. AI/hệ thống đề xuất từ khóa và nguồn, phân biệt seed query với tín hiệu đã đo.
2. Hiển thị truy vấn, phạm vi, giới hạn lượt/kết quả và ảnh hưởng chi phí nếu biết; chủ shop chọn/sửa và xác nhận chạy. Lưu mặc định không tự khởi chạy thu thập.
3. Nối UI với API tiến trình hiện có; giữ chạy nền và đọc lại kết quả khi tải trang. Timeout client không đồng nghĩa provider đã dừng; không tự chạy lại công việc chưa rõ trạng thái.
4. Tổng hợp kết quả có URL, nguồn, ngày thu thập, thuộc tính đọc được và thông tin còn thiếu. AI chỉ giải thích mức phù hợp theo tiêu chí.
5. Chủ shop chọn danh sách ngắn, đánh dấu đã kiểm tra hoặc loại bỏ. Tìm kiếm mới/chỉnh tiêu chí tốn lượt chạy cần xác nhận lại, không tự mở rộng nguồn vô hạn.
6. Khi chuyển sang danh mục hoặc brief Marketing, hiển thị mapping và phần thiếu để shop xác nhận. Không tự coi giá nhà cung cấp là giá bán, nguồn hàng là hàng shop đang có hoặc tồn kho đã xác nhận.

Không tự liên hệ nhà cung cấp, gửi tin, đặt hàng, thanh toán hoặc thay danh mục đang bán.

## 4. Kết quả và bằng chứng

Hai kiểu kết quả tách rõ: bài/sản phẩm được quan sát và đầu mối nhà cung cấp. Chống trùng bằng nguồn + external ID/URL phù hợp; không nhập chung mọi nguồn chỉ theo tên.

Mỗi kết quả gồm tên, URL, nguồn, thời điểm, giá/tiền tệ/đơn vị nếu có, MOQ/khu vực/thời gian giao nếu có, tiêu chí khớp/không khớp/chưa rõ, bằng chứng hỗ trợ và trạng thái chủ shop đã kiểm tra.

Một lần thu thập không chứng minh đang tăng trưởng. Chỉ báo xu hướng tăng khi có dữ liệu nhiều mốc so sánh được; tương tác TikTok không tự chứng minh doanh số. Kết quả Google không chứng minh có bán sỉ, uy tín hoặc chứng nhận. Không tạo số tăng trưởng, giá, MOQ hay điểm xác minh không có căn cứ.

## 5. Giao diện và lưu trữ

Giữ form tìm kiếm → đề xuất truy vấn chờ xác nhận → tiến trình → kết quả → danh sách ngắn. Thêm lọc phù hợp với dữ liệu thực; mục thiếu thông tin được hiển thị thay vì loại âm thầm.

Lưu yêu cầu, tiêu chí và chấp thuận, tham chiếu run/dataset đang có, kết quả chuẩn hóa và quyết định của shop theo phạm vi shop được cấp quyền. Token provider giữ ở server. Không tạo nguồn “tri thức shop đã xác nhận” từ kết quả chưa duyệt.

Chuyển sang Marketing tạo ý tưởng/brief nháp để người dùng duyệt, không tạo campaign hoạt động hoặc lịch đăng. Nhập sản phẩm là hành động riêng có xem trước, phát hiện SKU trùng và không ghi đè sản phẩm hiện có âm thầm.

## 6. Thứ tự và kiểm tra

1. Form tiêu chí và bản xem trước truy vấn, dùng quy tắc Sourcing mặc định làm gợi ý cho yêu cầu.
2. Nối `sourcingSearch.ts`, `sourcingApi.ts`, `sourcingRuns.ts`, API runs/provider vào UI hiện có; xử lý pending/failed/unknown và giới hạn sử dụng.
3. Chuẩn hóa kết quả có nguồn, lọc theo thuộc tính biết được, shortlist và xác nhận chuyển dữ liệu.
4. Chỉ thêm phân tích lịch sử xu hướng khi đủ dữ liệu và có phép đo xác định; không chặn lát cắt cơ bản vì thiếu lịch sử.

Test tiền tệ/đơn vị/MOQ thiếu, khoảng giá sai, keyword rỗng, truy vấn ngoài phạm vi, quyền xem run, kết quả trùng, schema nguồn đổi, rate limit, provider timeout chưa rõ, tải lại trang và người dùng bấm chạy hai lần. Kiểm tra mapping sang sản phẩm/brief và không tự kích hoạt hành động ngoài phạm vi đã duyệt.

Chưa mở bộ tùy chỉnh Page, tự đặt hàng, xác minh uy tín tự động, tính lợi nhuận đầy đủ hoặc tự động tìm định kỳ. Chưa được mô tả dữ liệu mẫu là nguồn thực hoặc xu hướng đo được.

## 7. Phạm vi đã triển khai

- UI thay dữ liệu mẫu bằng yêu cầu tìm nguồn có tiêu chí; giá/MOQ/khu vực mặc định lấy từ quy tắc Sourcing đã lưu của tài khoản. Có xem trước truy vấn chính xác, nguồn, cửa sổ 7 ngày cho TikTok, giới hạn kết quả giữ lại, timeout và trần phí provider 0,5 USD trước khi xác nhận chạy.
- Yêu cầu, phiên bản, chấp thuận và run lưu ở Postgres qua `019-sourcing-workflow.sql`. Tải lại trang đọc tiếp run; double click/retry cùng yêu cầu trả cùng ID, trạng thái `unknown` không tự khởi chạy lại. Chủ yêu cầu được kiểm tra trước khi đọc run/kết quả hoặc lưu lựa chọn. Token chỉ ở server.
- Hiển thị URL/nguồn/ngày thu thập, tương tác TikTok có thật trong dataset, tiêu chí khớp/không khớp/chưa rõ, ghi chú và danh sách ngắn/đã kiểm tra/đã loại. Google hiện chỉ cung cấp đầu mối tìm kiếm: giá, tiền tệ, đơn vị và MOQ vẫn `null`; không trích số từ đoạn mô tả để giả thành báo giá.
- Chuyển sang sản phẩm có xem trước SKU mới, tên và **giá bán do shop nhập riêng**; lượng khởi tạo 0, tồn chưa xác nhận, giữ URL nguồn, chặn SKU trùng và không ghi đè. Tái sử dụng danh mục hiện có (lưu trong trình duyệt).
- Chuyển sang Marketing đọc lại kết quả thuộc đúng chủ yêu cầu, tạo brief ý tưởng nháp có URL nguồn, chưa chọn sản phẩm đang bán/ưu đãi, không duyệt hoặc lập lịch/đăng bài. Cùng kết quả không tạo brief trùng.
- API workspace `GET/POST /api/sourcing/requests`, kế thừa các API run/provider cũ. POST provider trực tiếp cũng yêu cầu `confirmed: true`. Bộ demo cũ còn trong fixture, không dùng làm kết quả trên UI.

Chưa có lịch sử nhiều mốc để tính tăng trưởng, tự xác minh/liên hệ nhà cung cấp hay đặt hàng. Test backend dùng provider giả lập; kiểm tra trình duyệt dùng phản hồi API giả lập, chưa chạy Actor có phí hoặc xác minh nguồn cung trực tiếp trong lần triển khai này.

Nghiệm thu local 06/11/2026: toàn bộ 218 test và production build/TypeScript qua; lint các file thay đổi qua. Trình duyệt 1440px/390px đã kiểm tra duyệt truy vấn, thu thập với API giả lập, shortlist giữ sau reload và nhập sản phẩm có giá bán riêng, lượng 0/tồn chưa xác nhận. Test backend kiểm tra quyền, retry run `unknown`, dữ liệu thiếu và chuyển brief nháp không tự duyệt/đăng. Migration 019 đã áp dụng lên Postgres cấu hình hiện tại. Lint toàn checkout còn lỗi từ công cụ cục bộ ngoài phạm vi.

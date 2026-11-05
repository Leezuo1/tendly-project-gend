# Kế hoạch bổ sung AI Smart Sourcing

Ngày lập: 05/11/2026. Trạng thái: kế hoạch, chưa triển khai.

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

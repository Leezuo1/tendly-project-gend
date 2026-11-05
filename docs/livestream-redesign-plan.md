# Kế hoạch bổ sung AI Livestream

Ngày lập: 05/11/2026. Trạng thái: kế hoạch, chưa triển khai.

Liên quan: [Marketing](marketing-redesign-plan.md), [Customer Care](customer-care-redesign-plan.md), [API Live hiện có](livestream-api.md).

## 1. Định hướng: bổ sung theo phiên, giữ lõi hiện có

Không thiết kế lại toàn bộ Live hoặc bắt khai hồ sơ Page sâu như Content. Giữ nhận bình luận, phân loại/gom nhóm, chọn mẫu lên sóng, đơn nháp, giữ lượng theo SKU, flash price và tổng kết hiện có.

Ngữ cảnh chính: **shop → kênh/Page → phiên Live**. Chỉ kế thừa xưng hô/giọng và chính sách phù hợp từ Page; sản phẩm, deal và quyền hành động lấy từ phiên có xác nhận.

Giới hạn hiện tại: Facebook là kênh Live đang có; tồn kho là bản chụp và lượng giữ trong phiên, chưa phải kho đa kênh thời gian thực; thiếu bảng size, ánh xạ mã host, thông tin giao nhận/thanh toán hoàn chỉnh.

## 2. Thiết lập phiên cần bổ sung

| Nhóm | Trường |
| --- | --- |
| Phiên | Page được phép, tiêu đề, thời gian dự kiến, campaign nếu có, người/host phụ trách |
| Danh mục | SKU/biến thể xác định, mã host gọi/ghim như A1 hoặc 03, tên gọi khác, ảnh và thông số |
| Tư vấn | Size chart và form dáng có nguồn; chất liệu, hướng dẫn, giới hạn; thiếu bảng size thì không hứa vừa |
| Giá/deal | Giá gốc, giá phiên, ưu đãi xác nhận, điều kiện combo/quà nếu có nguồn; thời gian áp dụng/giữ giá |
| Giữ hàng | Lượng khả dụng đã xác nhận, thời hạn giữ, điều kiện hết hạn/hủy và phương án hết hàng |
| Vận hành | Cú pháp chốt, trường nhận hàng cần hỏi, người nhận chuyển giao và phạm vi gửi được duyệt |

Tái sử dụng ưu đãi/chính sách và dữ liệu sản phẩm dùng chung. Phần combo/voucher chỉ xuất hiện khi có dữ liệu chương trình được xác nhận; chưa có engine áp dụng thì không tính tiền như đã áp được.

## 3. Luồng và chấp thuận

1. Tạo phiên nháp, kiểm tra sản phẩm/tồn/giá/chính sách; chủ shop duyệt dữ liệu và phạm vi hành động trước bắt đầu.
2. AI gợi ý kịch bản/giới thiệu/gom câu hỏi; host duyệt hoặc chọn áp dụng. Chọn mẫu lên sóng là thao tác người phụ trách hoặc sự kiện provider đã kiểm chứng, không suy diễn từ câu nói mơ hồ.
3. Mặc định phản hồi chờ duyệt. Gửi theo nhóm phải cho xem nội dung, nhóm nhận và phiên bản; tự gửi chỉ khi người dùng đã chủ động bật phạm vi cụ thể. Không gộp quyền gửi công khai với private reply.
4. Comment chốt tạo đơn nháp và giữ lượng theo quy tắc đã xác nhận; giữ nguyên cơ chế hiện có, không coi là giao dịch thanh toán hoàn tất. Xác nhận đơn, thay giá, hủy hoặc điều chỉnh giữ hàng cần thao tác/duyệt đúng quyền.
5. Khiếu nại, đổi trả, thanh toán lỗi, thiếu tồn biến thể hoặc ngoài chính sách chuyển người phụ trách; hồ sơ hỗ trợ dùng chung Care.
6. Kết thúc phiên: chủ shop xem tổng kết/đơn và quyết định chăm sóc tiếp. AI không tự gửi nhắc hàng loạt hoặc giữ deal quá hạn.

## 4. Ngữ cảnh và tồn kho

- Lưu thời điểm chuyển mẫu lên sóng để hiểu comment theo lúc phát sinh; không gán mọi comment thu thập trễ cho SKU đang chọn hiện tại.
- Giữ tham chiếu phiên/comment/đơn nháp khi sang Inbox nếu xác định được nguồn. Không chắc mẫu nào thì hỏi lại; không lấy deal phiên khác.
- Khi chưa có connector kho, thể hiện đúng lượng trong phiên; không báo đồng bộ tồn đa kênh. Tách SKU/biến thể trước khi hứa còn size/màu.
- Nếu thêm thời hạn giữ, lưu thời điểm hết hạn ở server, giải phóng lượng theo transaction và xử lý đua giữa xác nhận/hết hạn; không dùng timer trình duyệt làm nguồn quyết định.
- Deep-link checkout, thông tin nhận hàng, phí ship, COD/QR và đối soát là phụ thuộc fulfillment riêng; chỉ nối khi có nguồn/API xác định, không dựng link hoặc xác nhận thanh toán giả.

## 5. Giao diện và báo cáo

Thêm bước chuẩn bị phiên gọn, bản tóm tắt dữ liệu chủ shop duyệt, bảng mã Live → SKU, người phụ trách và trạng thái chấp thuận. Trong phiên giữ cockpit hiện tại, bổ sung thời hạn deal/giữ hàng và lý do cần người xử lý.

Báo cáo giữ số liệu đơn nháp, doanh thu dự kiến, top hỏi/chốt và tồn trong phiên. Bổ sung danh sách chưa hoàn tất có lý do và câu hỏi phổ biến; chỉ tính đơn giao thành công, COD/chuyển khoản hoặc doanh thu thanh toán khi có dữ liệu giao dịch. Marketing được chọn phiên để lập bài/lịch mời Live; không tự thay lịch khi đổi phiên.

## 6. Triển khai và nghiệm thu

| Bước | Phạm vi |
| --- | --- |
| 1 | Thiết lập/duyệt phiên, mapping mã host, kế thừa giọng Page, nguồn size/chính sách |
| 2 | Timeline mẫu lên sóng, liên kết comment/Inbox và handoff; giữ chống gửi trùng với bình luận bài |
| 3 | Thời hạn giữ/deal nếu cần; kết nối nguồn kho một cách xác định trước khi tuyên bố real-time |
| 4 | Pending leads và tổng kết nối campaign/Care; fulfillment triển khai riêng |

Code liên quan: `lib/types/live.ts`, `lib/services/live/{engine,classify,templates,reply}.ts`, `liveClient.ts`, API Live, giao diện Livestream và migration tương ứng. Mở rộng service hiện có, không tạo Live engine thứ hai.

Test trùng mã host, sai SKU, thiếu bảng size, comment đến trễ, tồn không biết/không đủ, giữ đồng thời/hết hạn, đổi giá sau chốt, hết deal, tắt gửi/chuyển người thật, quyền kênh và kết quả gửi chưa rõ. Duyệt lại khi thay đổi phần dữ liệu/hành động đã được xác nhận; không tự kích hoạt gửi do nâng cấp giao diện.

Không mở thêm adapter TikTok/Shopee, hệ thanh toán hoặc kho toàn diện chỉ để làm cấu hình Page. Các chức năng đó cần phạm vi và xác minh riêng.

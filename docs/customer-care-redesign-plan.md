# Kế hoạch chỉnh sửa AI Customer Care / AI Chat

Ngày lập: 05/11/2026. Trạng thái: kế hoạch, chưa triển khai. Đây là vai trò `chat` hiện có, không tạo thêm AI thứ sáu.

Kế hoạch liên quan: [Marketing/Content](marketing-redesign-plan.md), [Review](review-redesign-plan.md), [Livestream](livestream-redesign-plan.md), [Smart Sourcing](smart-sourcing-redesign-plan.md).

## 1. Mục tiêu và hiện trạng

Giải đáp theo đúng shop/Page, nhu cầu khách và dữ liệu có nguồn; chuyển người thật khi vượt quyền. Giữ Inbox Messenger, phân tích cảm xúc/ưu tiên, lịch sử phân tích, hàng chờ và kiểm tra điều kiện gửi đang có.

Hiện có lịch sử hội thoại và cờ `needsHuman`/`canAutoReply`; chưa có CRM giao dịch, tích hợp vận đơn, hồ sơ đổi trả/hoàn tiền hoặc quy trình giao việc đầy đủ. Nhãn VIP và trường hiển thị số đơn không chứng minh có dữ liệu mua hàng thật. Quy tắc Chat theo nền tảng đang lưu chưa đồng nghĩa backend đã thực thi.

## 2. Cấu hình cần bổ sung

| Nhóm | Trường và nguồn |
| --- | --- |
| Giọng giao tiếp | Kế thừa hồ sơ Page: xưng hô, giọng, emoji, ví dụ trả lời đã duyệt; cho tùy chỉnh theo nhu cầu hỗ trợ |
| Nhiệm vụ | Tư vấn sản phẩm, hỏi chính sách, tra cứu đơn khi có nguồn; chỉ bật loại yêu cầu có dữ liệu/công cụ phù hợp |
| Chính sách | Thời hạn đổi trả và mốc tính; tình trạng đủ điều kiện; danh mục loại trừ; bên chịu phí; phương thức/thời gian hoàn; quy định bằng chứng |
| Sản phẩm | Đặc điểm, giới hạn, bảo quản, hướng dẫn xử lý lỗi; bảng size/thông số khi shop đã cung cấp |
| Hỗ trợ | Giờ làm việc, người/nhóm phụ trách, thông tin cần thu thập, trạng thái ngoài giờ và mẫu phản hồi |
| Chuyển giao | Khiếu nại, yêu cầu người thật, thanh toán/hoàn tiền, dọa kiện/bóc phốt, thiếu căn cứ hoặc yêu cầu ngoài chính sách |
| Quyền hành động | Chỉ đề xuất, cần duyệt hoặc tự trả lời trong phạm vi người dùng đã bật; mặc định không có quyền cấp voucher/đổi hàng/hoàn tiền |

Chính sách có phiên bản, nguồn, phạm vi shop/Page và xác nhận. FAQ tự do vẫn dùng được; bổ sung trường cấu trúc cho điều kiện cần kiểm tra, không ép nhập lại cùng chính sách ở hai nơi.

## 3. Ngữ cảnh và dữ liệu vận hành

Chuỗi áp dụng: **shop/chính sách → kênh/Page → hội thoại → đơn/yêu cầu liên quan**. Văn phong Page không thay quyền hoặc điều kiện nghiệp vụ.

- Khi xác định được nguồn, nối campaign/bài/comment/phiên Live vào hội thoại; giữ sản phẩm, deal và thời điểm hiệu lực đúng nguồn.
- Không chắc khách nói về bài/đơn nào thì hỏi lại. Không ghép danh tính đa kênh chỉ bằng tên, không dùng đơn của khách khác.
- Tra cứu đơn/vận đơn cần nguồn backend được cấp quyền: mã đơn, SKU, ngày nhận, hãng/tracking, trạng thái cập nhật và thời điểm đồng bộ. Chưa có connector thì xin mã và chuyển người kiểm tra; không giả lập trạng thái thật.
- Lưu tệp bằng chứng gắn yêu cầu, người gửi và thời điểm. Nhận ảnh/video không đồng nghĩa xác minh được video unbox; chưa có khả năng kiểm tra thì để nhân viên đánh giá.
- CRM chỉ bổ sung tổng đơn, chi tiêu, hạng và đặc quyền khi có dữ liệu giao dịch được xác nhận. Phân nhóm theo hoạt động nhắn tin không phải loyalty. Nhận xét rủi ro cần sự kiện có nguồn, quyền truy cập và khả năng sửa, không tự gán khách “boom hàng”.

## 4. Giao diện và hồ sơ xử lý

Giữ Inbox ba vùng; bổ sung nguồn ngữ cảnh và dữ kiện còn thiếu cạnh câu trả lời đề xuất. Hồ sơ khách tách thông tin xác nhận với suy luận AI.

Thêm hồ sơ yêu cầu hỗ trợ tối thiểu: loại yêu cầu, hội thoại, đơn nếu có, bằng chứng, tóm tắt, người phụ trách, ưu tiên, trạng thái, các hành động đã duyệt và nhật ký. Trạng thái: Mới → Chờ thông tin/Chờ nhân viên → Đang xử lý → Đã giải quyết/Đóng; có thể mở lại với lý do.

Quy tắc chăm sóc đặt trong Thiết lập AI; người nhận ca/giờ hỗ trợ đặt trong vận hành shop. Không tạo màn hình prompt lớn trùng hồ sơ Page. Cho thử tình huống và xem bộ quy tắc hiệu lực trước khi xác nhận áp dụng.

## 5. Chấp thuận và chuyển giao

1. Shop xác nhận tri thức/chính sách và bộ quy tắc Page trước khi kích hoạt.
2. Mặc định AI soạn, nhân viên sửa/duyệt/gửi. Tự trả lời phải được bật chủ động với Page, loại yêu cầu và phạm vi rõ ràng; comment private reply và Inbox có công tắc/phạm vi riêng.
3. Cảm xúc ưu tiên không tự chứng minh sự cố. Khi ngưỡng khẩn cấp hoặc cần người thật được kích hoạt, chặn tự gửi cho yêu cầu liên quan và giao hàng chờ; không chỉ gắn nhãn rồi tiếp tục tự trả lời.
4. Người phụ trách nhận xử lý; ghi nhận đã giao chỉ sau khi thao tác giao việc thành công. Không để AI tuyên bố đã chuyển nhân viên hoặc đã hoàn tiền khi mới đề xuất.
5. Đổi địa chỉ, hối giao, gửi bù, đổi hàng, cấp voucher và hoàn tiền luôn cần công cụ/quyền/duyệt riêng. Bản đầu chỉ lập yêu cầu và xin duyệt, không tự thực hiện.
6. Thay đổi phạm vi tự động hoặc chính sách cần duyệt lại; giữ nút tắt/chuyển thủ công, ghi người duyệt và phiên bản. Bật lại không tự gửi hồi tố tin cũ.

## 6. Triển khai theo bước

| Bước | Kết quả |
| --- | --- |
| 1 | Dùng hồ sơ Page/chính sách và quy tắc Chat xác nhận trên server; xem trước và thử tình huống |
| 2 | Nối campaign/bài/comment/Live có bằng chứng vào Inbox; không mất lịch sử và nguồn tri thức |
| 3 | Hồ sơ hỗ trợ, nhận/giao việc và cơ chế dừng tự trả lời/chờ người thật |
| 4 | Tích hợp một nguồn đơn/vận đơn có API, quyền và mapping đã xác định; sau đó mới cân nhắc nghiệp vụ đổi trả |

Phạm vi code: `InboxShell.tsx`, `CustomerProfilePane.tsx`, `inboxAi.ts`, `aiAnalysis.ts`, `messengerAi.ts`, `messengerView.ts`, `conversationMemory.ts`, `facebookComments.ts`, cấu hình AI và API/database hồ sơ hỗ trợ. Tái sử dụng luồng gửi và kiểm tra phiên hiện có.

## 7. Nghiệm thu và ngoài phạm vi

- Test đúng Page/khách/đơn, chính sách có điều kiện, ngữ cảnh campaign hết hiệu lực, phủ định và yêu cầu khẩn cấp; dữ liệu thiếu không thành câu trả lời chắc chắn.
- Test giao việc thật, lỗi giao việc, nhân viên đã tiếp quản, tắt tự gửi sát thời điểm gửi, phiên bản chính sách thay đổi và gửi trùng giữa comment/Live/Inbox.
- Kiểm tra tệp chưa được xác minh, giờ hỗ trợ, trạng thái tải/lỗi, lịch sử và thao tác mobile; xác nhận lại điều kiện nhà cung cấp trước khi kiểm thử gửi thật.
- Không xây toàn bộ ERP/CRM, chấm điểm khách hoặc tự hoàn tiền/cấp voucher trong đợt đầu. Các connector và hành động hậu mãi là bước có phạm vi riêng, không được coi đã tồn tại chỉ vì có form chính sách.

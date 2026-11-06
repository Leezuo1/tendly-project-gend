# Kế hoạch chỉnh sửa AI Customer Care / AI Chat

Ngày lập: 05/11/2026. Trạng thái: đã triển khai cấu hình Chat trên server, công tắc từng hội thoại và bước nối nguồn Marketing/comment/Live có bằng chứng; các bước còn lại theo kế hoạch bên dưới. Đây là vai trò `chat` hiện có, không tạo thêm AI thứ sáu.

Kế hoạch liên quan: [Marketing/Content](marketing-redesign-plan.md), [Review](review-redesign-plan.md), [Livestream](livestream-redesign-plan.md), [Smart Sourcing](smart-sourcing-redesign-plan.md).

## 1. Mục tiêu và hiện trạng

Giải đáp theo đúng shop/Page, nhu cầu khách và dữ liệu có nguồn; chuyển người thật khi vượt quyền. Giữ Inbox Messenger, phân tích cảm xúc/ưu tiên, lịch sử phân tích, hàng chờ và kiểm tra điều kiện gửi đang có.

Hiện có lịch sử hội thoại và cờ `needsHuman`/`canAutoReply`; chưa có CRM giao dịch, tích hợp vận đơn, hồ sơ đổi trả/hoàn tiền hoặc quy trình giao việc đầy đủ. Nhãn VIP và trường hiển thị số đơn không chứng minh có dữ liệu mua hàng thật. Quy tắc Chat mặc định/Facebook đã được nối vào backend sau khi shop xác nhận áp dụng; chưa tích hợp thực thi Chat cho Instagram/Zalo.

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

Trong Inbox, công tắc **AI tự động trả lời** đặt ở từng hội thoại và chỉ tác động hội thoại đó. Muốn tắt chung, shop tắt AI Chat trong **Cấu hình AI**; khi đó mọi hội thoại thuộc phạm vi cấu hình đều bị chặn tự trả lời, kể cả hội thoại đang bật. Bật lại AI trong cấu hình không thay đổi lựa chọn bật/tắt riêng của từng hội thoại và không tự gửi bù tin cũ. Công tắc hai cấp này đã được triển khai trong đợt đầu.

## 5. Chấp thuận và chuyển giao

1. Shop xác nhận tri thức/chính sách và bộ quy tắc Page trước khi kích hoạt.
2. Mặc định AI soạn, nhân viên sửa/duyệt/gửi. Tự trả lời phải được bật chủ động ở từng hội thoại, trong phạm vi Page/loại yêu cầu được cấu hình cho phép. Công tắc tắt chung nằm trong Cấu hình AI và có ưu tiên cao hơn công tắc hội thoại; comment private reply có công tắc/phạm vi riêng.
3. Cảm xúc ưu tiên không tự chứng minh sự cố. Khi ngưỡng khẩn cấp hoặc cần người thật được kích hoạt, chặn tự gửi cho yêu cầu liên quan và giao hàng chờ; không chỉ gắn nhãn rồi tiếp tục tự trả lời.
4. Người phụ trách nhận xử lý; ghi nhận đã giao chỉ sau khi thao tác giao việc thành công. Không để AI tuyên bố đã chuyển nhân viên hoặc đã hoàn tiền khi mới đề xuất.
5. Đổi địa chỉ, hối giao, gửi bù, đổi hàng, cấp voucher và hoàn tiền luôn cần công cụ/quyền/duyệt riêng. Bản đầu chỉ lập yêu cầu và xin duyệt, không tự thực hiện.
6. Thay đổi phạm vi tự động hoặc chính sách cần duyệt lại; giữ nút tắt/chuyển thủ công, ghi người duyệt và phiên bản. Bật lại không tự gửi hồi tố tin cũ.

## 6. Triển khai theo bước

| Bước | Kết quả |
| --- | --- |
| 1 | Dùng hồ sơ Page/chính sách và quy tắc Chat xác nhận trên server; xem trước và thử tình huống |
| 2 | Nối campaign/bài/comment/Live có bằng chứng vào Inbox; không mất lịch sử và nguồn tri thức |
| 3 | Công tắc tự trả lời từng hội thoại, tắt chung trong Cấu hình AI; hồ sơ hỗ trợ, nhận/giao việc và cơ chế dừng tự trả lời/chờ người thật |
| 4 | Tích hợp một nguồn đơn/vận đơn có API, quyền và mapping đã xác định; sau đó mới cân nhắc nghiệp vụ đổi trả |

Phạm vi code: `InboxShell.tsx`, `CustomerProfilePane.tsx`, `inboxAi.ts`, `aiAnalysis.ts`, `messengerAi.ts`, `messengerView.ts`, `conversationMemory.ts`, `facebookComments.ts`, cấu hình AI và API/database hồ sơ hỗ trợ. Tái sử dụng luồng gửi và kiểm tra phiên hiện có.

## 7. Nghiệm thu và ngoài phạm vi

- Test đúng Page/khách/đơn, chính sách có điều kiện, ngữ cảnh campaign hết hiệu lực, phủ định và yêu cầu khẩn cấp; dữ liệu thiếu không thành câu trả lời chắc chắn.
- Test giao việc thật, lỗi giao việc, nhân viên đã tiếp quản, tắt tự gửi sát thời điểm gửi, phiên bản chính sách thay đổi và gửi trùng giữa comment/Live/Inbox.
- Test tắt một hội thoại không ảnh hưởng hội thoại khác; tắt chung trong Cấu hình AI chặn mọi hội thoại thuộc phạm vi cấu hình ngay trước gửi; bật lại không bật các hội thoại đã tắt riêng hoặc gửi bù tin cũ.
- Kiểm tra tệp chưa được xác minh, giờ hỗ trợ, trạng thái tải/lỗi, lịch sử và thao tác mobile; xác nhận lại điều kiện nhà cung cấp trước khi kiểm thử gửi thật.
- Không xây toàn bộ ERP/CRM, chấm điểm khách hoặc tự hoàn tiền/cấp voucher trong đợt đầu. Các connector và hành động hậu mãi là bước có phạm vi riêng, không được coi đã tồn tại chỉ vì có form chính sách.

## 8. Tiến độ triển khai 05/11/2026

- Đã thêm migration `016-customer-care.sql`: lưu profile Chat, bản tri thức/chính sách và văn phong Page đã xác nhận, người xác nhận, phiên bản và công tắc riêng mỗi hội thoại. Hội thoại mặc định tắt tự trả lời; cấu hình cũ cần xác nhận lại trước khi chạy tự động.
- Cấu hình AI có xem tri thức, cập nhật từ Sản phẩm/FAQ, kế thừa xưng hô/giọng/ví dụ Page và tùy chỉnh Facebook. Thử tình huống chỉ tạo bản xem trước; xác nhận mới lưu và áp dụng. Sửa Sản phẩm/FAQ hoặc hồ sơ Page cần cập nhật/xác nhận lại bản tri thức dùng cho Chat; chưa phải đồng bộ tri thức liên tục.
- Inbox tạo gợi ý thủ công, phân tích lịch sử và tự trả lời qua cùng bộ quy tắc đã xác nhận trên server. Giữ lịch sử, hàng chờ thiếu căn cứ và luồng gửi hiện có. Nguồn gợi ý ghi phiên bản Chat; yêu cầu ưu tiên cao được giữ để nhân viên kiểm tra.
- Tắt chung trong Cấu hình AI có hiệu lực ngay. Backend kiểm tra lại cấu hình/hội thoại, phiên bản, tin mới nhất, phản hồi thủ công và hàng chờ trước khi gọi gửi; thay đổi khi AI đang chạy sẽ chặn đầu ra cũ. Bật lại không gửi bù.
- Kiểm thử: 197 test đạt; build production, TypeScript và ESLint các file sửa đạt. Test nghiệp vụ dùng PostgreSQL nhúng và provider mô phỏng; kiểm tra giao diện production bằng API mô phỏng tại 1440/768/390px, thao tác bàn phím, xem trước/xác nhận, lỗi tải và cấu hình trình duyệt hỏng. Migration `016` đã áp dụng thành công lên database cấu hình hiện tại. Chưa xác minh chất lượng Gemini hoặc gửi thật Meta trong đợt này.
- Đợt đầu chưa có nối nguồn campaign/comment/Live; phần này đã được bổ sung ở đợt tiếp theo trong mục 9. Hồ sơ hỗ trợ/nhận-giao việc, giờ hỗ trợ, chính sách điều kiện dạng cấu trúc và connector đơn/vận đơn vẫn chưa triển khai. `needsHuman` vẫn là trạng thái chờ xác nhận, chưa phải thao tác giao việc thật.

## 9. Bước 2: nguồn Marketing/comment/Live trong Inbox

- Nối nguồn bằng đúng Page và `message_id` của tin nhắn riêng đã được xác nhận gửi, đối chiếu với tin Messenger lưu cho đúng PSID. Không dùng tên hoặc ID tác giả bình luận làm PSID. Trạng thái `unknown`/`sending` không tạo bằng chứng nguồn.
- Bài thuộc campaign được nối bằng Facebook post ID đã lưu khi đăng. Inbox giữ phiên bản campaign/bản chụp bài, sản phẩm liên quan, nội dung/điều kiện ưu đãi và thời hạn. Giá/tồn kho/chính sách của bản catalog cũ không ghi đè tri thức Chat hiện hành.
- Khi nhắn riêng từ Live, lưu bản chụp bình luận, đúng SKU/sản phẩm và giá flash sale lúc gửi. Giá này chỉ được dùng khi phiên vẫn live và giá flash chưa đổi; kết thúc phiên/tắt hoặc đổi flash sale sẽ chặn xác nhận deal cũ. Tin chung giữa màn bình luận và màn Live chỉ tạo một nguồn.
- Nếu có `message.reply_to.mid`, đối chiếu với private message của chính hội thoại để chọn đúng nguồn. Khi có nhiều nguồn hoặc tham chiếu không khớp, không tự chọn nguồn gần nhất: AI hỏi lại và chờ nhân viên. Chưa có nút gán nguồn thủ công hoặc tự xác định nguồn từ tên/từ khóa. Khách có thể reply trực tiếp tin nguồn; nhân viên vẫn có thể kiểm tra và trả lời thủ công.
- Bản phân tích AI lưu kèm nguồn đã dùng trong lịch sử PostgreSQL. Khu vực **Nguồn hội thoại** cạnh gợi ý cho xem bài gốc, bình luận, sản phẩm, campaign/phiên và ưu đãi; **Cần xác nhận** nêu dữ kiện còn thiếu. Polling ẩn gợi ý khi dữ kiện nguồn đã đổi, tránh gửi lại gợi ý cũ như thể còn hiệu lực.
- Gợi ý thủ công, phân tích lịch sử và webhook dùng cùng bộ đọc nguồn. Backend đối chiếu lại nguồn sau khi tạo câu trả lời và ngay trước gọi gửi, cùng với các kiểm tra bật/tắt/quyền/hàng chờ đang có. Hết hạn campaign/ưu đãi hoặc thay đổi nguồn lúc AI đang chạy đều chặn tự gửi.
- Migration `017-customer-care-sources.sql` bổ sung tham chiếu reply, bản chụp nguồn và index; đã áp dụng lên database cấu hình hiện tại, không xóa lịch sử. Với tin Live cũ không có bản chụp lúc gửi, hiển thị nguồn đã biết nhưng giữ chờ nhân viên; không tự dựng lại deal lịch sử từ giá hiện tại.
- Phạm vi liên kết hiện tại là private reply từ luồng bình luận/Live đã có. Chưa triển khai referral quảng cáo/m.me, gộp danh tính đa kênh, giao việc hoặc tra cứu đơn. Chưa kiểm thử sự kiện reply và gửi thật với Meta/Gemini trong đợt này.
- Kiểm chứng: 206 test đạt; build production/TypeScript và ESLint các file sửa đạt. Test PostgreSQL nhúng kiểm tra đúng Page/khách, nhiều nguồn, reply nguồn cũ ngoài danh sách gần đây, campaign/flash hết hiệu lực, nguồn đổi lúc tạo hoặc sát gọi gửi, bảo toàn lịch sử và ẩn gợi ý cũ. Kiểm tra giao diện production dùng API mô phỏng cho nguồn hợp lệ/nhiều nguồn/deal hết hiệu lực ở 1440/768/390px; mở chi tiết được bằng bàn phím và không tràn ngang.

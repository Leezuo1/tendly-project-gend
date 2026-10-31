# Tendly

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Chủ shop nhỏ tại Việt Nam và nhân viên chăm sóc khách hàng, cần phối hợp nhiều công việc trong quá trình bán hàng online.

## Product Purpose

Tendly là trợ lý AI đa năng cho shop online, bao gồm customer support, livestream assistant, marketing và sales assistant. Các mảng này cùng tạo nên phạm vi sản phẩm; không định vị Tendly chỉ là chatbot chăm sóc khách hàng.

Giúp shop xử lý hội thoại, hỗ trợ bán hàng trong livestream, chuẩn bị nội dung marketing và tư vấn dựa trên sản phẩm/FAQ. Thành công cần được đánh giá qua khả năng hoàn thành công việc, chất lượng hỗ trợ và quyền kiểm soát của người bán. Chưa có bằng chứng để cam kết tăng doanh thu, tiết kiệm thời gian cụ thể hay AI luôn chính xác.

## Positioning

Một trợ lý AI phục vụ nhiều công việc của cùng shop, sử dụng ngữ cảnh hội thoại và nguồn tri thức sản phẩm/FAQ để hỗ trợ người bán. Đây là định hướng sản phẩm được xác nhận, chưa phải bằng chứng về ưu thế độc quyền so với đối thủ.

## Operating Context

- Giao diện tiếng Việt; tên shop, tên khách và danh tính Fanpage cần rõ ràng trong các thao tác giao tiếp.
- Luồng thiết lập hiện có: `/dang-nhap` → `/tao-shop` → `/ket-noi` → `/tong-quan`. Thiết lập shop và lựa chọn kết nối mẫu có dữ liệu lưu trong trình duyệt.
- Công việc chính nằm ở Hội thoại (`/hop-thoai`), Cấu hình AI (`/cau-hinh-ai`), Marketing (`/marketing`) và Livestream (`/livestream`); các màn hình Tổng quan, Khách hàng và Cài đặt hỗ trợ vận hành.
- Shop cung cấp sản phẩm/FAQ để AI tham chiếu; trường hợp thiếu căn cứ hoặc cần người thật phải được chuyển cho shop xử lý.

## Capabilities and Constraints

Các trạng thái dưới đây mô tả bằng chứng trong code/tài liệu tại thời điểm init, không xác nhận dịch vụ bên ngoài đang hoạt động hay bản deploy đã được kiểm thử.

- **Customer support:** có backend cho webhook/lưu trữ/hộp thư/gửi tin Messenger, phân tích và gợi ý AI, cùng cơ chế tự trả lời riêng. Tự trả lời mặc định tắt; trạng thái chờ xác nhận chặn tự gửi đến khi shop trả lời thủ công. AI vẫn có thể sai.
- **Marketing:** có API cho soạn nội dung, đăng bài, xử lý bình luận Facebook và remarketing Messenger. Việc gửi/đăng thành công phụ thuộc cấu hình, quyền và phản hồi của provider; có API không đồng nghĩa đã xác minh gửi thật.
- **Livestream assistant:** có luồng phiên, gom câu hỏi, gợi ý/phê duyệt phản hồi, đơn nháp, sản phẩm/flash sale và cửa sổ hỗ trợ. Đơn nháp cần người bán xác nhận; không coi đây là hệ thống thanh toán, vận chuyển hay quản lý đơn hoàn chỉnh. TikTok/Shopee Live chưa được xác nhận triển khai.
- **Sales assistant:** hỗ trợ tư vấn theo sản phẩm/FAQ và công việc bán hàng trong các luồng trên. Phạm vi tự động hóa bán hàng độc lập ngoài các luồng hiện có còn để ngỏ.
- **Nguồn sản phẩm:** có backend OAuth/đồng bộ Shopee cho một shop được cấu hình. Kết nối Shopee trong onboarding vẫn là mô phỏng; OAuth và đồng bộ thực tế cần được xác minh riêng.
- **Demo/chưa hoàn thiện:** Smart Sourcing dùng dữ liệu mẫu; các kết nối mẫu Zalo/TikTok không chứng minh nhắn tin thật. Đăng ký, đăng nhập Google/Facebook, mời nhân viên, gửi email, thanh toán và áp hạn mức gói chưa được xác nhận hoạt động đầy đủ. Giá/hạn mức hiển thị không chứng minh có billing hoặc cơ chế thực thi quota.
- **Truy cập và dữ liệu:** code hiện có phiên đăng nhập server và cơ chế admin khóa dữ liệu/thao tác thật; chưa phải phân quyền SaaS nhiều shop. Bảo toàn kiểm tra quyền trên API và giữ token provider phía server. Không mô tả trạng thái bảo mật/deploy là đã kiểm chứng chỉ từ tài liệu.
- **Chạy nền:** tự động hóa Messenger hiện dùng `after()` trong giới hạn vòng đời webhook, chưa có worker/scheduler bền vững riêng; không hứa xử lý nền liên tục khi chưa có kiểm chứng tương ứng.

## Brand Commitments

- Giữ tên Tendly và tài sản logo hiện có tại `public/tendly-logo.png`.
- Nội dung sản phẩm dùng tiếng Việt rõ ràng, thể hiện vai trò hỗ trợ của AI và quyền quyết định của shop.
- Không tự bổ sung khách hàng, lời chứng thực, số liệu hiệu quả hoặc tuyên bố tích hợp đã hoạt động thật. Copy marketing hay dữ liệu mẫu trong repo không phải bằng chứng cho các tuyên bố này.

## Evidence on Hand

- `README.md`: thiết lập app, bảo vệ dữ liệu, onboarding mẫu, nguồn tri thức AI, Messenger và các giới hạn triển khai. Một số đoạn onboarding còn mô tả xác thực cũ; đối chiếu phần bảo vệ dữ liệu và code hiện hành trước khi tái sử dụng.
- `docs/livestream-api.md`: luồng và API Livestream, cửa sổ hỗ trợ và các thao tác người bán.
- `docs/shopee-demo.md`: luồng cấp quyền/đồng bộ một shop Shopee và giới hạn demo.
- `app/api/`, `lib/services/`, `components/features/` và `tests/`: bằng chứng triển khai và kiểm thử cục bộ; không thay thế kiểm thử provider, production hoặc nghiên cứu người dùng.
- `lib/data/pricing.ts`: các gói hiển thị; `lib/data/landing.ts` có dữ liệu/copy minh họa, không dùng các số liệu ở đó làm bằng chứng thị trường.
- Init không xác minh live provider, doanh thu, số shop sử dụng, mức tiết kiệm thời gian hay độ chính xác AI.

## Product Principles

1. Phục vụ toàn bộ công việc của shop qua bốn mảng: CSKH, livestream, marketing và hỗ trợ bán hàng.
2. AI bám nguồn tri thức của shop; thiếu dữ liệu hoặc cần người thật thì giữ lại để người bán xử lý.
3. Giữ danh tính người gửi/người nhận rõ ràng và quyền kiểm soát thực chất của người bán đối với tự động hóa.
4. Phân biệt dữ liệu mẫu, tính năng có backend và tích hợp đã được xác minh thực tế trong nội dung và thiết kế.
5. Bảo toàn dữ liệu, kiểm tra quyền và khả năng truy cập khi thay đổi các luồng hiện có.

## Open Decisions

Chưa chốt chỉ số/đích thành công định lượng, thứ tự ưu tiên giữa bốn mảng và phạm vi sales assistant ngoài chức năng hiện có. Không tự biến các điểm này thành cam kết sản phẩm.

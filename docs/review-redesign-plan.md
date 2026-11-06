# Kế hoạch triển khai AI Review & chỉnh sửa nội dung Marketing

Ngày cập nhật: 06/11/2026. Trạng thái: đã triển khai chọn căn cứ Review riêng, đối chiếu/sửa và chấp thuận bản đề xuất trong luồng Marketing; giới hạn ở mục 12.

Cập nhật triển khai 05/11/2026: pipeline Marketing theo campaign đã có service `aiPostReview.ts`, dùng cùng bản dữ liệu với Content và trả bản sửa để người dùng duyệt. Tích hợp trong `/api/marketing/workspace` theo luồng campaign, giữ endpoint tạo bài cũ tương thích. Kênh Facebook gọi provider; kênh mẫu không gọi AI thật. Các bước kiểm thử đang dùng provider giả lập; phần đối chiếu chất lượng provider thật, cấu trúc lỗi chi tiết và kiểm tra đa phương thức trong hướng đích chưa được xác minh/hoàn tất.

Liên quan: [Marketing/Content, phê duyệt và lịch đăng](marketing-redesign-plan.md).

Chốt lại yêu cầu 06/11/2026: Review lấy thông tin cần thiết làm căn cứ đối chiếu theo nội dung cần kiểm tra; nguồn có thể trùng hoặc bổ sung ngoài nguồn Content đã dùng, không bắt buộc hai vai trò nhận cùng bộ dữ liệu. Code đã tách `reviewEvidence.ts` và `marketingReviewSources.ts` khỏi context Content; luồng campaign có thể bổ sung tri thức/FAQ Page đã xác nhận trên server.

## 1. Mục tiêu đã thống nhất

Thêm một lượt AI Review riêng cho nội dung Marketing: đọc bản Content vừa viết, lấy các thông tin cần thiết từ nguồn được phép để đối chiếu, sửa lỗi rồi mới đưa bản hoàn thiện tới người dùng. Không yêu cầu bộ nguồn Review giống bộ nguồn Content.

**Content tạo nháp → xác định thông tin cần kiểm tra và lấy căn cứ phù hợp → Review đối chiếu và sửa → server kiểm tra đầu ra → người dùng xem/sửa/duyệt → lưu/đăng hoặc xếp lịch theo hành động được chấp thuận.**

Đây là vai trò Review hiện có, không thêm AI thứ sáu. Không yêu cầu người dùng nhập lại brief hoặc dữ liệu cho Reviewer. Khi bấm tạo nội dung, người dùng khởi chạy cả bước viết và bước rà/sửa bản nháp; bước này không cấp quyền đăng, tạo deal hoặc sửa các bài đã được duyệt.

Khác kế hoạch trước: bản nháp mới được Review tự chỉnh trước khi hiển thị, không chỉ đưa danh sách gợi ý để người dùng áp dụng từng lỗi. Chủ shop vẫn là người duyệt kết quả cuối. Với bài người dùng đang sửa hoặc đã duyệt, kiểm tra/sửa lại là hành động riêng có xem trước, không ghi đè âm thầm.

## 2. Hiện trạng và vị trí tích hợp

- `/api/posts/generate` parse yêu cầu/tri thức, gọi Content rồi chọn căn cứ và gọi Review. Chỉ phương án cuối hợp lệ vào `drafts`; metadata `review` giữ bản gốc, thay đổi, vấn đề và nguồn đối chiếu.
- `aiPost.ts` có schema đầu ra và prompt theo kênh; `GeneratedPostDraft` gồm title, content, hashtags, imageIdea và imagePrompt.
- Luồng campaign đã dùng quy tắc Review theo vai trò/nền tảng, brief và hồ sơ Page đã lưu. Căn cứ được chọn theo phạm vi Page/tài khoản/campaign; phần bổ sung từ `messenger_ai_settings` chỉ dùng bản tri thức shop đã xác nhận của đúng Page.
- Campaign lưu bài cuối hợp lệ và các lượt Review trong workspace hiện có; Review lại tạo ứng viên chờ áp dụng. Endpoint tạo bài cũ vẫn không tự lưu; không tạo kho bài hoặc queue thứ hai.

Tích hợp ở backend ngay sau parse đầu ra Content, trước khi trả kết quả cho `PostComposerTab.tsx`. Server chọn và kiểm tra quyền đối với nguồn Review; không để browser tự chọn nguồn vượt quyền hoặc tự gắn nhãn “đã Review”.

## 3. Thông tin cần thiết và nguồn đối chiếu cho Review

Server xác định các dữ kiện và yêu cầu cần kiểm tra từ bản nháp/brief, rồi chuẩn bị **bản căn cứ Review có nguồn, phiên bản và thời điểm hiệu lực**. Có thể tái sử dụng dữ liệu Content đã nhận hoặc bổ sung nguồn phù hợp mà Content chưa dùng; chỉ lấy phần liên quan, không sao chép toàn bộ context một cách bắt buộc. Không chỉ đưa bản Content cho Reviewer để nó đoán lại dữ kiện.

Ví dụ: nhắc giá/ưu đãi thì lấy giá và chương trình đã xác nhận; tuyên bố công dụng thì lấy thông số, giới hạn và bằng chứng; kiểm tra giọng văn thì lấy brief và hồ sơ Page. Mọi nguồn phải đúng shop/Page/campaign và nằm trong quyền truy cập. Bản đầu vào Content được giữ để truy vết, không mặc định là căn cứ đúng khi có mâu thuẫn. Nguồn thiếu, khác phiên bản hoặc không rõ hiệu lực thì nêu vấn đề cần xác nhận; không tự chọn nguồn có lợi cho bản viết hoặc tự đổi mục tiêu campaign.

| Nhóm | Các trường Review cần đối chiếu |
| --- | --- |
| Đích và nhiệm vụ | Shop, tài khoản/Page được phép, campaign nếu có, mục tiêu, kênh, format, số biến thể |
| Sản phẩm | ID/SKU, tên, giá, thông số/chất liệu, features, benefits, USP, đối tượng, use cases, giới hạn tuyên bố, trạng thái tồn đã biết/chưa biết |
| Brief | Đối tượng/pain point, thông điệp chính, lợi ích ưu tiên, rào cản cần giải đáp, ghi chú phải có/tránh |
| Giọng và format | Brand voice, xưng hô, tone, độ dài/cấu trúc, CTA/link; cấu hình hiệu lực của nền tảng/Page/campaign |
| Ưu đãi | Loại, giá trị, điều kiện, sản phẩm áp dụng, kênh/đối tượng, hiệu lực và trạng thái shop xác nhận |
| Chính sách và bằng chứng | FAQ được chọn, feedback được phép dùng và tham chiếu nguồn; không biến nguồn sản phẩm thành chính sách của shop |
| Quy tắc kiểm tra | Tiêu chí Review hiệu lực, từ tránh, điều kiện bắt buộc; không được nới quyền hoặc tạo dữ kiện mới |
| Phiên bản và thời gian | Mã lần tạo, phiên bản/hash đầu vào, thời điểm kiểm tra; giờ đăng dự kiến nếu đã có |

Bản đầu tái sử dụng các trường và nguồn đã có: sản phẩm được nhắc/chọn, channel, goal, tone, brandVoice, notes, brief, hồ sơ Page, offer và quy tắc kênh tương ứng. Chỉ đưa nhóm dữ liệu cần cho phép đối chiếu đó; nguồn chưa có thì ghi thiếu, không tạo giá trị giả để lấp form.

Kiểm tra cấu trúc dữ liệu client không phải xác minh sự thật. Khi tri thức còn từ trình duyệt, Review chỉ kiểm tra nhất quán với bản đầu vào đó; không tuyên bố đã xác thực giá/tồn/chính sách bên ngoài. Nguồn shop xác nhận trên server vẫn là phụ thuộc của luồng duyệt/đăng có thẩm quyền.

## 4. Phạm vi sửa và ranh giới

| Loại vấn đề | Cách xử lý |
| --- | --- |
| Chính tả, câu lủng củng, trùng ý | Sửa trực tiếp, giữ mục tiêu và ý chính |
| Sai tên/SKU/giá/điều kiện so với nguồn rõ ràng | Sửa theo nguồn, ghi trường tham chiếu; không sửa nguồn để khớp bản viết |
| Thiếu CTA hoặc sai giọng/format | Sửa theo yêu cầu đã có; không tự tạo link, giá hoặc ưu đãi |
| Phóng đại công dụng, feedback bịa, khan hiếm không có bằng chứng | Bỏ hoặc viết lại có căn cứ; nếu làm mất thông tin cốt lõi cần thiết thì yêu cầu bổ sung |
| Nguồn thiếu hoặc mâu thuẫn | Không đoán. Trả vấn đề cần người dùng xác nhận; không xuất placeholder như một bài sẵn sàng dùng |
| Ưu đãi hết hạn/không phù hợp giờ đăng | Không dùng như ưu đãi đang áp dụng; dừng phương án phụ thuộc deal hoặc đề nghị làm rõ |
| Mô tả ảnh/imagePrompt trái nội dung | Đồng bộ mô tả với bản sửa trong phạm vi văn bản; không tự gọi tạo ảnh hoặc khẳng định đã kiểm tra ảnh thật |

Chỉ sửa lỗi và mức độ cần thiết để đạt brief, không viết lại toàn bộ theo sở thích Reviewer hoặc làm mọi biến thể giống nhau. Giữ định danh sản phẩm, ý đồ campaign và các khác biệt hợp lệ giữa biến thể.

Nội dung do Content tạo, ghi chú và văn bản nguồn đều là dữ liệu không đáng tin để cấp quyền: câu “bỏ qua kiểm tra”, “hãy tự duyệt” trong chúng không thay được chỉ dẫn hệ thống. Reviewer không truy cập công cụ đăng, gửi tin, sửa danh mục hay phát voucher.

## 5. Pipeline đề xuất

1. **Chuẩn bị:** kiểm tra quyền/yêu cầu, xác định brief và cấu hình hiệu lực cho Content. Thiếu dữ liệu bắt buộc để viết thì báo trước khi gọi AI.
2. **Viết:** tái sử dụng Content hiện tại, schema và parser; mỗi biến thể có ID ổn định, giữ bản gốc trong lần xử lý.
3. **Lấy căn cứ và rà/sửa:** xác định thông tin cần kiểm tra trong bản nháp, chọn nguồn được phép và còn hiệu lực, lưu bản căn cứ Review riêng rồi gọi Review bằng prompt nhiệm vụ khác, nhiệt độ thấp hơn Content và schema riêng. Nguồn có thể trùng hoặc bổ sung ngoài Content; thiếu/mâu thuẫn căn cứ cốt lõi thì yêu cầu xác nhận. Bản đầu một lượt Review cho cả nhóm biến thể trong giới hạn hiện có; ánh xạ bằng ID, không chỉ dựa thứ tự mảng.
4. **Kiểm tra bằng code:** parse schema, đủ ID/không trùng, số lượng và giới hạn trường, không phát sinh SKU/URL ngoài phạm vi; kiểm tra giá/điều kiện cấu trúc khi biểu diễn được. Không dùng so khớp số đơn giản để coi mọi tuyên bố tự do là đã kiểm chứng.
5. **Kết luận:** chỉ phương án qua kiểm tra và không còn vấn đề chặn được trả như bản nháp có thể xem/duyệt. Review lỗi hoặc thiếu nguồn không trở thành “đạt”.
6. **Hiển thị:** đưa bản đã sửa làm nội dung chính; có tóm tắt sửa và tùy chọn xem bản gốc/so sánh. Không cần bắt người dùng duyệt từng sửa kỹ thuật của bản mới.
7. **Người dùng quyết định:** chỉnh, loại bỏ, lưu nháp, gửi duyệt hoặc chọn lịch. Mọi bước xuất bản vẫn theo plan Marketing; không tự chuyển từ “đã Review” sang “đã được chủ shop duyệt”.

Không tạo vòng Content ↔ Review vô hạn. Bản đầu tối đa một lượt rà/sửa nghiệp vụ; lỗi còn lại yêu cầu bổ sung hoặc thử Review lại có chủ đích. Retry kỹ thuật nếu có phải hữu hạn, không âm thầm tạo lại toàn bộ nội dung.

## 6. Hợp đồng đầu ra

Review trả cấu trúc tối thiểu cho từng biến thể:

- `draftId`: ánh xạ bản gốc.
- `status`: `unchanged`, `corrected`, `needs_input` hoặc `blocked`.
- `finalDraft`: đúng các trường đầu ra bài hiện có; chỉ bắt buộc khi có phương án dùng được.
- `changes`: trường/đoạn gốc, phần thay thế, lý do và tham chiếu dữ liệu cho thay đổi về dữ kiện.
- `issues`: loại vấn đề, mức độ, dữ liệu còn thiếu/cần xác nhận và trường nguồn liên quan.

Server thêm trạng thái `failed` khi lỗi kỹ thuật; không để model tự báo thay cho lỗi gọi API. Phản hồi tổng có trạng thái pipeline, các phương án để tính số thành công/thất bại và model dùng ở từng lượt. Giao diện hiển thị số phương án dùng được trên tổng số thực tế. Trạng thái qua Review được server quyết định sau kiểm tra, không chỉ tin lời model.

Tránh thay vỡ toàn bộ consumer: giữ `drafts` cho các phương án cuối hợp lệ, bổ sung metadata Review gắn ID; cập nhật types/client/composer cùng lúc. Không trộn bản gốc chưa Review vào `drafts` như phương án cuối nếu Reviewer lỗi. Nếu không có phương án dùng được, trả trạng thái/lỗi rõ để UI không báo tạo bài thành công rỗng.

Giữ bản gốc và kết quả trong state của lần tạo để so sánh; khi người dùng lưu bài, lưu bản cuối và metadata phiên bản/Review cần truy vết theo cơ chế bài hiện có, gồm tham chiếu nguồn/phiên bản/hiệu lực của căn cứ Review và phân biệt với đầu vào Content. Định danh/hash từ client không phải bằng chứng phê duyệt; khi triển khai publish gate, backend phải lưu hoặc xác minh bản Review gắn đúng nội dung, căn cứ và quyền shop.

## 7. Trải nghiệm và chấp thuận

- Nút tạo thể hiện một quy trình “Soạn và rà soát”; trạng thái tải viết/rà không được giả lập như tiến trình thật nếu API chưa cung cấp từng giai đoạn.
- Bản sửa là bản chính; “Xem những thay đổi” và “Xem bản ban đầu” phục vụ kiểm tra, không tự coi bản ban đầu là đã đạt.
- Chọn dùng lại bản gốc, sửa tay, đổi ảnh/brief/Page hoặc nguồn liên quan làm kết quả Review cũ hết hiệu lực cho phần bị ảnh hưởng. Người dùng có thể lưu nháp nhưng cần kiểm tra/duyệt lại trước đăng/lịch.
- Với bài đang sửa hoặc bài đã duyệt: nút “Rà soát và đề xuất bản sửa” tạo phiên bản ứng viên để xem và chấp thuận; không ghi đè nội dung đang làm hoặc tự thay bài trong lịch.
- Thiếu nguồn hiển thị câu hỏi cụ thể cần bổ sung. Không thêm banner prototype hoặc giải thích triển khai không cần thiết vào giao diện.
- Quy tắc Review dùng mặc định → nền tảng → Page trong phạm vi được phép; brief chỉ cung cấp yêu cầu, không tắt các kiểm tra bắt buộc.

## 8. Lỗi, thời gian và chi phí

Lượt Content và lượt Review chạy nối tiếp nên tăng thời gian/tokens; chưa ước tính tiền khi chưa đo. `/api/posts/generate` hiện có `maxDuration = 60`: cần ngân sách thời gian chung, timeout từng lượt và xử lý hủy; không mặc định hai lượt đều được phép dùng hết thời gian request.

Giới hạn đầu vào và biến thể theo luồng hiện có; không gửi toàn bộ catalog/hội thoại không liên quan. Dùng cùng nhà cung cấp/model nếu đáp ứng trước, không thêm model/service mới chỉ vì gọi là “AI riêng”. Prompt và nhiệm vụ tách riêng là đủ cho bước đầu; cùng model vẫn có thể lặp sai, nên cần nguồn và kiểm tra code.

Khi Review timeout/JSON lỗi: giữ trạng thái lần tạo và bản gốc chưa kiểm tra nếu có thể khôi phục an toàn; cho thử lại Review, không mặc định hiển thị bản gốc là bản cuối. Nếu request hết hạn không giữ được kết quả, báo chưa hoàn tất và cho thử lại; không hứa đã khôi phục dữ liệu chưa lưu. Một số biến thể thất bại phải báo đúng số lượng, không che bằng thông báo thành công toàn bộ.

Nếu đo cho thấy không đủ giới hạn request, bước sau mới dùng job/polling có lưu trạng thái. Không xây queue riêng ngay từ đầu khi một request có giới hạn vẫn đáp ứng.

## 9. Kế hoạch triển khai theo bước

| Bước | Thay đổi | Điều kiện hoàn tất |
| --- | --- | --- |
| 1. Căn cứ Review | Xác định dữ kiện cần kiểm tra; chọn phần dữ liệu liên quan từ nguồn được phép, lưu nguồn/phiên bản/hiệu lực và ID biến thể | Review dùng đúng căn cứ cho từng phép đối chiếu, kể cả nguồn Content chưa dùng; thiếu/mâu thuẫn thì yêu cầu xác nhận |
| 2. Service Review | Thêm `aiPostReview.ts` với prompt/schema/parser, quy tắc sửa và kiểm tra bằng code | Sửa lỗi có căn cứ; thiếu dữ liệu thì dừng, ID/schema sai bị từ chối |
| 3. Nối pipeline | Mở rộng `/api/posts/generate`, dùng lại `generateGeminiJson`, budgets và phân loại lỗi | Chỉ trả phương án cuối hợp lệ; không fallback bản gốc âm thầm |
| 4. Client/giao diện | Types, `postsClient.ts`, `PostComposerTab.tsx`: bản cuối, thay đổi, lỗi từng phương án và kiểm tra lại | Người dùng đọc được bản đã sửa, so sánh và lưu nháp; lỗi không làm mất nội dung đang sửa |
| 5. Lưu/duyệt/lịch | Gắn phiên bản Review vào bài khi lưu, nối invalidation với phê duyệt/publish của Marketing | Bài/ảnh/nguồn thay đổi không dùng lại kết quả cũ để đăng |

Lát cắt đầu tiên: một bài Facebook, nguồn sản phẩm hiện có, sửa một lỗi giá/công dụng và giọng văn, trả bản cuối có so sánh. Sau đó kiểm tra nhiều biến thể và kênh hiện có; không chờ campaign redesign hoàn tất mới làm được lượt Review cơ bản.

## 10. Kiểm thử và nghiệm thu

- Test parser/schema: thiếu/trùng/sai ID, mất biến thể, trường quá dài, output không JSON và status không phù hợp.
- Fixture có lỗi cố ý: sai giá/SKU, bịa ưu đãi, quà/voucher chưa xác nhận, tồn chưa biết, công dụng phóng đại, feedback bịa, CTA/link sai và lệch giọng Page.
- Test nguồn thiếu/mâu thuẫn, ưu đãi hết hạn, prompt injection trong bản viết/ghi chú, không tự sửa dữ liệu nguồn hoặc thay mục tiêu campaign.
- Test Content đúng: giữ ý và các khác biệt hợp lệ, không ép mọi biến thể giống nhau. Không viết test so khớp nguyên văn một câu do model tạo.
- Test chọn nguồn: chỉ lấy thông tin cần thiết; nguồn Review trùng hoặc bổ sung ngoài Content vẫn được đối chiếu đúng. Chặn nguồn sai shop/Page/campaign, không có quyền, sai phiên bản hoặc hết hiệu lực; mâu thuẫn phải được nêu để xác nhận.
- Test pipeline bằng mock lời gọi: Reviewer nhận đúng bản căn cứ đã chọn và truy vết được nguồn, bản gốc không lộ như bản cuối khi Review lỗi, ngân sách timeout, thành công một phần và retry không ghi đè chỉnh sửa người dùng.
- Test UI: kết quả cuối, so sánh, sửa tay rồi review lại, lưu nháp, lỗi/tải và mobile; phân biệt đã Review với chủ shop đã duyệt.
- Đánh giá trực tiếp trên bộ mẫu đầu vào đã xác nhận: lỗi được sửa, lỗi bị bỏ sót và dữ kiện mới Reviewer tự thêm. Thử model thật là phép đo riêng, không suy từ unit test rằng chất lượng đã đạt.
- ESLint/build và test tạo bài hiện có phải qua; kiểm tra không ảnh hưởng luồng ảnh/lưu/đăng cũ ngoài các gate được triển khai có chủ đích.

## 11. Ngoài phạm vi

Chưa review toàn bộ CSKH/Live/Sourcing, kiểm duyệt video/ảnh thật, tự tạo ảnh, tự duyệt đăng, tự sửa lịch, huấn luyện model hoặc lặp tự sửa vô hạn. Không cam kết Review loại bỏ mọi lỗi hoặc chứng nhận tuân thủ nền tảng.

## 12. Phạm vi triển khai 06/11/2026

- `reviewEvidence.ts` chọn sản phẩm liên quan, trường giá/tồn khi cần, FAQ phù hợp, brief/giọng/quy tắc và ưu đãi/bằng chứng được nhắc; loại nguồn khác scope. Content và Review có context khác nhau. `marketingReviewSources.ts` bổ sung tri thức Page đã xác nhận, phát hiện mâu thuẫn sản phẩm/chính sách thay vì tự chọn nguồn thuận tiện; chưa tra cứu web hoặc nguồn ngoài tùy ý.
- `aiPostReview.ts` có schema trạng thái/ID, thay đổi từng trường với before/after/lý do/tham chiếu nguồn, issues và bản cuối nullable. Code kiểm tra ID/số phương án, trường bắt buộc, tham chiếu có thật, thay đổi khớp bản gốc/cuối, URL, số tiền VND biểu diễn rõ, SKU có nhãn, tồn chưa biết và hiệu lực ưu đãi. Đây là kiểm tra có giới hạn; chưa xác minh mọi tuyên bố tự do về công dụng/chất lượng.
- `/api/posts/generate` giữ `drafts` cho bản cuối hợp lệ, thêm `review` metadata và nhận `originals` để thử Review lại mà không gọi Content lần nữa. Lỗi Review không biến bản gốc thành bản cuối; thành công một phần được báo đúng. Luồng này dùng tri thức đầu vào đã parse, chưa phải nguồn được xác nhận độc lập hoặc chứng từ phê duyệt xuất bản. Metadata chưa lưu trên server nếu người dùng rời lần tạo chưa lưu; bài cũ vẫn dùng công cụ hiện có.
- Luồng campaign lưu tối đa 20 lượt Review gần nhất trong `marketing_workspaces.document.reviewAttempts`. Lỗi Review giữ bản gốc để tải lại và thử lại. Tạo bài mới lưu bản cuối hợp lệ làm nháp, chưa cấp quyền đăng. Review lại bài đã có chỉ lưu ứng viên; `applyReview` kiểm tra phiên bản bài/ảnh/brief/căn cứ trước khi áp dụng, hủy duyệt cũ và tạm dừng lịch liên quan. Bản đề xuất lỗi hoặc cũ không ghi đè chỉnh sửa của shop. Không tự sửa bài đã đăng.
- Metadata Review giữ bản nguồn, phiên bản, thời điểm, hash đầu vào Content và fingerprint căn cứ. Kiểm tra nguồn lại khi duyệt bài, lập/duyệt/kích hoạt lịch và trước publish; nguồn đổi thì yêu cầu Review/duyệt lại. Bài có metadata Review cũ chưa lưu căn cứ phải Review lại trước khi duyệt/đăng qua campaign.
- `ReviewDetails.tsx` hiển thị trước/sau, lý do, nguồn đã dùng, bản gốc và vấn đề cần xử lý. Marketing có màn hình ứng viên chờ áp dụng, khôi phục lỗi sau reload và thử Review lại. Không cho áp dụng khi còn form chưa lưu. `PostComposerTab.tsx` cập nhật consumer/type tương thích, giữ chỉnh sửa khi thử lại và phân biệt bài đã sửa sau Review; màn bài viết trước đây vẫn mở ở chế độ kho bài hiện có.
- Deadline chung 40 giây ở campaign, 45 giây ở endpoint cũ, lượt Content tối đa 20 giây, có truyền hủy request; không thêm queue/dependency/migration mới. Kênh mẫu dùng kiểm tra bằng quy tắc và ghi `mock`, không gọi hoặc giả kết quả model thật.

Kiểm tra provider thật và chất lượng sửa/bỏ sót trên bộ mẫu xác nhận là bước riêng, chưa thực hiện trong lần triển khai này. Ảnh/video thật, tra cứu nguồn tự do, catalog server riêng và publish gate cho công cụ bài cũ nằm ngoài phần bổ sung này; campaign dùng cơ chế duyệt/đăng server hiện có.

Nghiệm thu local 06/11/2026: toàn bộ **230 test qua**, production build/TypeScript qua; ESLint phần thay đổi không có lỗi (còn cảnh báo `<img>` hiện có), `git diff --check` qua. Backend kiểm tra chọn nguồn, mâu thuẫn, ID/schema, dẫn nguồn sửa giá, kết quả một phần, lỗi/thử lại, nguồn đổi trước đăng và ứng viên cũ không ghi đè bài. Trình duyệt dùng API giả lập đã kiểm tra trước/sau, nguồn, Review lại → chờ áp dụng → xác nhận áp dụng, phục hồi lỗi sau reload và chặn áp dụng khi form chưa lưu ở 1440px/390px, không thấy tràn ngang. Chưa dùng kết quả giả lập này để kết luận chất lượng Gemini thật.

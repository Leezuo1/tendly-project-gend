# Smart Sourcing — phương án đã chốt

Tài liệu chốt hướng phát triển Smart Sourcing cho Tendly. Đây là phương án triển khai; màn Smart Sourcing hiện tại vẫn dùng dữ liệu demo, chưa thu thập và phân tích thị trường thật.

## Tiến độ triển khai

Phần nền tảng đầu tiên đã được viết, chưa kết nối nhà cung cấp:

- `POST /api/sourcing/plan`: nhận `{ "industry": "Thời trang & phụ kiện" }`, kiểm tra phiên/quyền truy cập, cùng nguồn truy cập và kích thước JSON bằng cơ chế bảo vệ hiện có.
- Trả kế hoạch tìm trong 7 ngày gần nhất, thị trường VN và bộ từ khóa đầu vào theo ngành. Trạng thái `prepared`, `collectionReady: false` có nghĩa chỉ chuẩn bị yêu cầu, chưa tạo lượt chạy hoặc gọi Apify.
- Có bộ từ khóa cho năm ngành sản phẩm; `Dịch vụ`, `Khác` và ngành không hợp lệ bị từ chối. Bộ từ khóa là dữ liệu khởi đầu cần đánh giá, không phải từ khóa đã đo là hot.
- `lib/services/sourcingSearch.ts` định nghĩa cấu trúc bài đầu vào cho adapter Actor sau này, chuẩn hóa các trường, kiểm tra link HTTP/HTTPS không chứa thông tin đăng nhập, giữ số liệu/ngày thiếu là `null`, đếm bản ghi bị loại và bỏ trùng theo nguồn + ID trong một batch (giữ bản hợp lệ đầu tiên).
- Chưa có adapter đọc output Actor thực tế. Hàm chuẩn hóa nhận dữ liệu đã được adapter ánh xạ về cấu trúc chung; thiếu ID hoặc nội dung thì bỏ qua. Chưa gộp các link/ID khác nhau chỉ vì nội dung giống nhau.
- Chưa nối nút demo sang API mới; chưa có lưu trữ, polling, lịch thu thập, phân tích AI, lọc theo kỳ hay xếp hạng thật. API kế hoạch không gọi nhà cung cấp nên chưa phát sinh phí thu thập.

Bước tiếp theo: chọn một nguồn/Actor, kiểm tra input và output mẫu → viết adapter và kết nối backend → lưu lượt chạy, dữ liệu → nối giao diện → phân tích AI và tính tín hiệu.

## 1. Mục tiêu và giao diện

Giúp shop tìm sản phẩm đang nổi bật trong ngành hàng và tìm nơi nhập sản phẩm đó. Chia thành hai tab:

| Tab | Đầu vào | Kết quả |
| --- | --- | --- |
| **Tìm sản phẩm hot** | Ngành hàng lấy sẵn từ hồ sơ shop, có thể đổi | Danh sách sản phẩm nổi bật, tín hiệu xu hướng và link bằng chứng |
| **Tìm nguồn hàng** | Tên sản phẩm và điều kiện nhập | Danh sách nguồn cung liên quan cùng thông tin được công bố |

- Mỗi sản phẩm hot có nút **Tìm nguồn hàng**: chuyển sang tab nguồn hàng và điền sẵn tên sản phẩm.
- Người đã biết sản phẩm cần nhập có thể vào thẳng tab nguồn hàng.
- Ngành hàng là bộ lọc, không cần nút riêng “Tìm kiếm ngành hàng”.

## 2. Flow tìm sản phẩm hot

```text
Người dùng chọn ngành → bấm Tìm sản phẩm hot
    ↓
Backend lấy ngành hàng → chọn bộ từ khóa theo ngành
    ↓
Backend gọi Apify Actor đã cấu hình để thu thập dữ liệu
    ↓
Code chuẩn hóa, bỏ trùng và lọc theo thời gian
    ↓
AI nhận diện sản phẩm, gom các cách gọi và loại nội dung sai ngữ cảnh
    ↓
Code tổng hợp tín hiệu, tính số liệu và xếp hạng
    ↓
AI giải thích sản phẩm đáng chú ý dựa trên dữ liệu đã có
    ↓
Hiển thị sản phẩm, số liệu, thời gian cập nhật và link bằng chứng
```

### Scraper thu thập

- Nội dung bài viết, caption, hashtag; tên và mô tả sản phẩm nếu có.
- Link gốc, tài khoản/nguồn đăng, ngày đăng và thời điểm thu thập.
- Lượt xem, thích, bình luận, chia sẻ nếu nguồn cung cấp.
- Nội dung bình luận nếu có thể lấy; không cần thu thập hồ sơ cá nhân người bình luận.
- Số bán và đánh giá nếu nguồn thương mại điện tử cung cấp; không suy ra doanh số từ tương tác MXH.

Đây là các trường mong muốn. Phải kiểm tra khả năng cung cấp của từng nguồn và Actor, không mặc định nền tảng nào cũng có đủ.

### Code thường xử lý

- Chọn từ khóa từ bộ cấu hình sẵn theo ngành; bản đầu chưa cần AI sinh từ khóa.
- Gọi Apify, xử lý lỗi, chuẩn hóa và lưu dữ liệu.
- Bỏ trùng; tổng hợp số bài và số tài khoản khác nhau nhắc đến sản phẩm.
- Tính tương tác gần đây và mức thay đổi giữa các khoảng thời gian tương đương.
- Xếp hạng từ các tín hiệu đo được; công thức và ngưỡng sẽ chốt sau khi kiểm tra dữ liệu thật.

Không xếp hạng chỉ theo phần trăm tăng hoặc một bài viral. Ví dụ từ 1 lên 3 bài là tăng 200% nhưng vẫn có rất ít bằng chứng. Không cộng trực tiếp lượt xem/thích của các nền tảng thành một điểm khi chưa xét khác biệt dữ liệu.

### AI xử lý

- Nhận diện sản phẩm trong nội dung và lọc đúng ngành, đúng ngữ cảnh.
- Gom các tên cùng chỉ một sản phẩm, tránh gộp nhầm các biến thể khác nhau.
- Phân biệt nội dung quảng cáo, review và thảo luận để bổ sung ngữ cảnh.
- Giải thích vì sao sản phẩm đáng chú ý, kèm link bằng chứng và điểm còn chưa chắc chắn.

AI không tự bịa số liệu, doanh số hay mức tăng trưởng. Phân tích nhu cầu là thông tin bổ sung; trọng tâm là phát hiện sản phẩm đang nổi bật hoặc đang tăng mức độ quan tâm.

### Dữ liệu theo thời gian

Để xác định sản phẩm **đang tăng xu hướng**, cần thu thập lặp lại và lưu số liệu qua các kỳ. Nút tìm kiếm sử dụng dữ liệu đã tích lũy và cập nhật thêm khi cần; lịch thu thập sẽ chốt theo nguồn và chi phí thực tế.

Nếu chưa có dữ liệu so sánh, dùng nhãn **Sản phẩm nổi bật trong dữ liệu thu thập**, không khẳng định sản phẩm đang tăng xu hướng hoặc đại diện toàn thị trường.

## 3. Flow tìm nguồn hàng — code + scraper, chưa cần AI

```text
Nhập tên sản phẩm hoặc chuyển từ kết quả sản phẩm hot
    ↓
Nhập điều kiện cần thiết: khu vực nguồn cung, số lượng muốn nhập
    ↓
Code tạo truy vấn → gọi công cụ tìm kiếm/scraper nguồn cung
    ↓
Thu thập thông tin được công bố
    ↓
Code chuẩn hóa, bỏ trùng và lọc theo điều kiện có dữ liệu
    ↓
Hiển thị nguồn hàng để shop kiểm tra và liên hệ
```

### Thông tin nguồn hàng

- Tên đơn vị và link website/gian hàng.
- Tên, mô tả, chất liệu và thông số sản phẩm nếu có.
- Giá công bố, đơn vị tính, điều kiện giá và MOQ nếu có.
- Khu vực, thông tin liên hệ, thời gian giao và chính sách nếu có.
- Thời điểm thu thập để người dùng biết độ mới của thông tin.

Ví dụ shop muốn nhập 50 áo, nguồn ghi MOQ 100 áo thì code có thể loại khỏi nhóm đáp ứng số lượng. Nguồn không công bố MOQ phải ghi **Chưa rõ**, không tự coi là đạt hoặc không đạt. Chỉ so sánh giá khi biết đơn vị và điều kiện tương ứng.

**Bản đầu không dùng AI cho tìm nguồn hàng.** Có thể bổ sung sau nếu cần hiểu yêu cầu bằng ngôn ngữ tự nhiên, đối chiếu mô tả phức tạp hoặc tóm tắt khác biệt giữa các nguồn.

## 4. Phân chia vai trò

| Thành phần | Trách nhiệm |
| --- | --- |
| Frontend Tendly | Nhận yêu cầu, hiển thị tiến trình, kết quả và lỗi |
| Backend | Điều phối luồng, giữ API token, gọi công cụ, kiểm tra và lưu dữ liệu |
| Apify / scraper | Thu thập dữ liệu từ nguồn đã chọn; kết quả phụ thuộc Actor và input |
| Code thường | Chuẩn hóa, bỏ trùng, lọc điều kiện, tính số liệu và xếp hạng |
| AI | Nhận diện/gom sản phẩm và giải thích tín hiệu trong luồng tìm sản phẩm hot |

Không cần AI agent tự quyết định toàn bộ quy trình. Telegram bot chưa cần cho bản đầu vì đã có giao diện Tendly; có thể thêm sau nếu cần gửi báo cáo hoặc thông báo.

## 5. Phạm vi bản đầu và các giới hạn

- Bắt đầu với một ngành, một nguồn tín hiệu thị trường và một nguồn tìm nhà cung cấp; chưa triển khai đồng loạt mọi nền tảng.
- Dùng nội dung chữ và metadata; chưa cần phân tích hình ảnh/video bằng AI.
- Chọn và thử Actor trên dữ liệu thật trước khi chốt nguồn, chi phí, lịch thu thập và công thức xếp hạng.
- Giữ token ở backend. Kiểm tra quyền truy cập và điều kiện sử dụng của nguồn dữ liệu.
- Phân biệt rõ đang xử lý, không có kết quả và lỗi thu thập; không biến lỗi scraper thành thông báo “0 kết quả”.
- Shop bán lẻ hoặc tài khoản đăng video không mặc định là nguồn sỉ/xưởng. Chỉ ghi loại nguồn khi có bằng chứng.
- Kết quả nhiều tương tác không chứng minh bán chạy; nguồn cung tìm thấy chưa được xác minh uy tín hoặc chất lượng.
- Không tự liên hệ, đặt hàng hay thanh toán. Shop xem thông tin và tự quyết định.


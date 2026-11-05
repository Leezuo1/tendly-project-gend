# Smart Sourcing — phương án đã chốt

Tài liệu chốt hướng phát triển Smart Sourcing cho Tendly. Đây là phương án triển khai; màn Smart Sourcing hiện tại vẫn dùng dữ liệu demo, chưa thu thập và phân tích thị trường thật.

## Tiến độ triển khai

Backend thu thập cho hai Actor đã được viết và kiểm tra bằng provider mock; chưa chạy Apify thật:

- `POST /api/sourcing/plan`: nhận `{ "industry": "Thời trang & phụ kiện" }`, kiểm tra phiên/quyền truy cập, cùng nguồn truy cập và kích thước JSON bằng cơ chế bảo vệ hiện có.
- Trả kế hoạch tìm trong 7 ngày gần nhất, thị trường VN và bộ từ khóa đầu vào theo ngành. Trạng thái `prepared`, `collectionStarted: false` có nghĩa chỉ chuẩn bị yêu cầu, chưa tạo lượt chạy hoặc gọi Apify.
- Có bộ từ khóa cho năm ngành sản phẩm; `Dịch vụ`, `Khác` và ngành không hợp lệ bị từ chối. Bộ từ khóa là dữ liệu khởi đầu cần đánh giá, không phải từ khóa đã đo là hot.
- `lib/services/sourcingSearch.ts` định nghĩa cấu trúc bài đầu vào cho adapter Actor sau này, chuẩn hóa các trường, kiểm tra link HTTP/HTTPS không chứa thông tin đăng nhập, giữ số liệu/ngày thiếu là `null`, đếm bản ghi bị loại và bỏ trùng theo nguồn + ID trong một batch (giữ bản hợp lệ đầu tiên).
- Adapter TikTok đọc output theo schema công bố của `clockworks/tiktok-scraper`: ID, caption, link, tác giả, ngày đăng và tương tác; lọc bài có ngày trong kỳ 7 ngày đã yêu cầu. Bài thiếu ngày hoặc ngoài kỳ bị loại khỏi kết quả phân tích, có số đếm riêng. Chưa gộp các link/ID khác nhau chỉ vì nội dung giống nhau.
- Adapter Google đọc `organicResults` của `apify/google-search-scraper`, bỏ trùng URL sau khi loại tham số theo dõi đã biết, giữ mô tả và truy vấn làm bằng chứng. Chỉ trả đầu mối tham khảo, chưa đọc website đích hoặc xác minh bán sỉ/giá/MOQ.
- Lượt tìm và kết quả chuẩn hóa lưu tại Postgres, gắn với tài khoản khởi tạo; có API kiểm tra tiến trình. Chưa nối nút demo sang API mới, chưa có lịch thu thập, phân tích AI hay xếp hạng sản phẩm thật.

Bước tiếp theo: cấu hình token, áp dụng migration, kiểm tra lượt chạy Apify thật → nối giao diện → phân tích AI và tính tín hiệu.

### Cấu hình backend Apify

1. Đặt `APIFY_API_TOKEN` trong `.env.local` và biến môi trường server khi deploy. Không dùng tiền tố `NEXT_PUBLIC_` và không gửi token trong body từ frontend.
2. Chạy `npm run db:migrate` để thêm `014-sourcing.sql` (hai bảng `sourcing_runs`, `sourcing_start_limits`), sau đó khởi động lại app. Migration được viết idempotent; chưa áp dụng lên DB thật trong bước triển khai này.
3. Gọi API trong phiên app có quyền sử dụng dữ liệu thật. Các POST phải có Origin cùng nguồn. Quyền hiện hành vẫn giới hạn admin/demo owner; tài khoản mới chưa hoàn tất setup không được dùng các API nghiệp vụ.

| API | Body | Kết quả |
| --- | --- | --- |
| `POST /api/sourcing/plan` | `{ "industry": "Thời trang & phụ kiện" }` | Chuẩn bị từ khóa, không phát sinh lượt Apify |
| `POST /api/sourcing/tiktok` | `{ "industry": "Thời trang & phụ kiện" }` | HTTP 202, ID nội bộ và trạng thái lượt thu thập TikTok |
| `POST /api/sourcing/suppliers` | `{ "product": "áo polo cotton" }` | HTTP 202, ID nội bộ và trạng thái lượt tìm nguồn trên Google |
| `GET /api/sourcing/runs/{id}` | Không có | Kiểm tra trạng thái, lấy dataset khi thành công, lưu/trả kết quả chuẩn hóa |

Frontend sau này lưu ID được trả về và gọi GET mỗi 3–5 giây khi trạng thái `running`; không POST lại để kiểm tra tiến trình. Dừng polling khi hoàn tất hoặc lỗi, có thể thử GET lại nếu lỗi mạng tạm thời. Backend hiện chỉ cập nhật/lấy kết quả khi có GET, chưa có worker tự đồng bộ nền. Kết quả đã hoàn tất được đọc lại từ DB.

- TikTok: tối đa ba truy vấn theo ngành, 20 video/truy vấn; yêu cầu proxy VN và `PAST_WEEK`. Bộ lọc ngày của Actor có thể tính thêm phí. Proxy VN và truy vấn tiếng Việt không chứng minh tác giả/người xem là người Việt; kết quả chỉ là mẫu thu thập.
- Google: hai truy vấn có cụm bán sỉ/nhà sản xuất/nhà phân phối, một trang/truy vấn; `countryCode: vn`, giao diện `vi`. Không gửi `searchLanguage: vi` vì schema Actor hiện không liệt kê lựa chọn đó. Các add-on đọc website, AI và tìm contact không được bật.
- Token chỉ gửi trong header Authorization tới API cố định của Apify. Không nhận Actor ID, dataset ID hoặc URL API từ người dùng. ID provider không trả cho frontend.
- Mỗi lượt yêu cầu timeout Actor 300 giây và trần chi phí USD 0.50 theo API Apify. Số lượng là giới hạn demo và không bảo đảm luôn nhận đủ kết quả. Cần kiểm tra giá/quy tắc tính phí thực tế trong Console.
- Mỗi tài khoản chỉ khởi tạo một lượt cùng loại trong 60 giây; đồng thời chặn lượt mới khi có lượt `starting/running/unknown` được tạo trong 6 phút gần nhất. Kiểm tra này lưu ở DB, không phụ thuộc bộ nhớ của một server.
- Trạng thái: `starting`, `running`, `succeeded`, `empty`, `failed`, `unknown`. `empty` là thu thập xong nhưng không còn bản ghi hợp lệ trong phạm vi; xem các số đếm bị loại. Lỗi HTTP/schema không chuyển thành kết quả rỗng.
- Nếu mất phản hồi lúc khởi chạy, lưu `unknown`, giữ ID nội bộ và không tự retry POST để tránh tạo hai lượt tính phí. Phải kiểm tra Console trước khi tìm lại. Nếu tiến trình server dừng khi đang `starting` cũng cần kiểm tra Console; chưa có chức năng tự khôi phục lượt mơ hồ.

Tài liệu schema đã đối chiếu: [TikTok input](https://apify.com/clockworks/tiktok-scraper/input-schema), [Google input](https://apify.com/apify/google-search-scraper/input-schema), [Run Actor](https://docs.apify.com/api/v2/actors-runs-post). Output mẫu trong test là fixture theo tài liệu, không phải bằng chứng đã chạy provider thật.

Kiểm tra: `node --test tests/sourcing-apify.test.mjs tests/sourcing-search.test.mjs tests/app-security.test.mjs`.

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


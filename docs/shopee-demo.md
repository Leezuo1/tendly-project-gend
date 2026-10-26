# Kết nối một shop Shopee thật cho Tendly

Phạm vi: một shop Việt Nam, giá VND, cấp quyền bằng tài khoản shop, bấm nút để lấy danh mục thật về Tendly. Không có đồng bộ đơn hàng, chat, webhook, lịch tự động hay cập nhật ngược lên Shopee.

## 1. Chuẩn bị trên Shopee

1. Vào [Shopee Open Platform](https://open.shopee.com/), đăng ký developer và hoàn tất hồ sơ theo yêu cầu Console. Quyền production còn phụ thuộc Shopee xét duyệt, dù chỉ dùng một shop demo.
2. Tạo app phục vụ shop của bạn. Nếu Console cho phép, chọn **Seller In House System** cho trường hợp tự tích hợp shop của chính mình. Kiểm tra quyền API `shop/get_shop_info`, `product/get_item_list`, `product/get_item_base_info`, `product/get_model_list` và các API token.
3. Khai báo **Live Redirect URL Domain** là domain HTTPS chạy Tendly. Callback là `https://<domain-tendly>/api/shopee/callback`. Nếu Console yêu cầu URL đầy đủ thì nhập callback; nếu yêu cầu domain thì chỉ nhập domain.
4. Lấy **Partner ID**, **Partner Key** và ID số của shop demo. Shop ID là phần số trong URL sản phẩm dạng `...-i.<shop_id>.<item_id>`, không phải tên đăng nhập.
5. Với shop thật, dùng thông tin **Live/Production**, app có quyền production và `SHOPEE_SANDBOX=false`. Nếu chưa được duyệt, thử shop test và credentials sandbox với `SHOPEE_SANDBOX=true`; sandbox không lấy danh mục shop thật. Khai báo IP whitelist nếu Console yêu cầu.

Tài liệu chính thức: [Authorization and Authentication](https://open.shopee.com/developer-guide/20), [Product list](https://open.shopee.com/documents/v2/v2.product.get_item_list?module=89&type=1), [Product details](https://open.shopee.com/documents/v2/v2.product.get_item_base_info?module=89&type=1), [Variants](https://open.shopee.com/documents/v2/v2.product.get_model_list?module=89&type=1).

## 2. Cấu hình Tendly

Thêm vào `.env.local` khi chạy local; trên Vercel thêm cùng các biến vào Environment Variables rồi deploy lại:

```dotenv
SHOPEE_PARTNER_ID=<Partner ID>
SHOPEE_PARTNER_KEY=<Partner Key>
SHOPEE_SHOP_ID=<ID số của shop demo>
SHOPEE_REDIRECT_URL=https://<domain-tendly>/api/shopee/callback
SHOPEE_SANDBOX=false
```

Không gửi Partner Key/token trong chat, không dùng `NEXT_PUBLIC_`, không commit `.env.local`. Code dùng lại `DATABASE_URL`, `INBOX_ACCESS_KEY` và phiên truy cập Facebook; endpoint mở phiên hiện tại cũng yêu cầu `PAGE_ID`. Giữ cấu hình Facebook đang hoạt động.

Trong PowerShell, chạy `npm.cmd run db:migrate` rồi `npm.cmd run dev`. Migration thêm bảng `shopee_connection`, giữ nguyên dữ liệu Facebook. Bảng lưu token server-side và danh mục đồng bộ thành công gần nhất. Tài khoản database và backup có quyền đọc bảng này cũng đọc được token.

Khi dùng tunnel, mở Tendly bằng chính URL HTTPS của tunnel, đăng ký domain đó với Shopee và đặt callback cùng domain. Đổi domain tunnel thì cập nhật cả Console và env rồi khởi động lại. Không bắt đầu từ `localhost` nhưng nhận callback ở domain khác: cookie bảo vệ kết nối sẽ không khớp.

## 3. Cấp quyền và đồng bộ

1. Mở **Cấu hình AI → Sản phẩm** (`/cau-hinh-ai?tab=products`) trên đúng domain đã cấu hình.
2. Bấm **Kết nối Shopee** để mở trang cấp quyền chính thức.
3. Đăng nhập **tài khoản của shop demo**, xác nhận quyền. Không dùng tài khoản chính nhiều shop: code chỉ nhận callback có `shop_id` đúng `SHOPEE_SHOP_ID`.
4. Trở về Tendly, thẻ nguồn hiển thị **Đã cấp quyền**. Bấm **Đồng bộ Shopee**.
5. Kiểm tra tên shop, giá/tồn kho, thời điểm đồng bộ. Mỗi phân loại đang bán là một dòng riêng, kể cả SKU trống/trùng. Hết hàng vẫn giữ với số lượng 0; sản phẩm ẩn/xóa/ngừng bán được bỏ khỏi danh mục Shopee sau lần đồng bộ đầy đủ thành công.
6. Sang **Hộp thoại**, hỏi AI về tên/phân loại vừa tải. Đổi giá/tồn kho ở Shopee, đồng bộ lại rồi hỏi lại để kiểm tra dữ liệu mới.

Token được tự làm mới khi bấm đồng bộ nếu sắp/hết hạn; token mới lưu ngay trước khi tải sản phẩm. Không cần copy access token/refresh token vào env. Nếu quyền bị thu hồi, refresh token hết hạn hoặc thời hạn cấp quyền kết thúc, bấm **Kết nối lại Shopee**.

## Giới hạn demo

- Tối đa 500 dòng sản phẩm/phân loại theo giới hạn nguồn AI hiện có. Chỉ shop VN, giá VND; không đoán giá/tồn kho khi Shopee trả thiếu.
- Danh mục được lưu ở Postgres; trang Sản phẩm tải lại vào nguồn AI của trình duyệt. Khi dùng trình duyệt/máy mới, mở trang Sản phẩm trước khi dùng AI. FAQ và CSV vẫn dùng kho trình duyệt hiện có.
- Đồng bộ thay dòng Shopee cũ, bỏ sản phẩm mẫu chưa chỉnh sửa và giữ sản phẩm CSV/đã sửa. CSV trùng SKU Shopee tạo dòng thủ công riêng; tránh hai dòng có thông tin mâu thuẫn. Giá/tồn kho là dữ liệu tại lần đồng bộ, không phải lúc AI trả lời.
- Lỗi tải/quyền, thiếu trang/biến thể hoặc vượt giới hạn giữ danh mục thành công trước đó. Token đã xoay vòng nhưng database ghi thất bại có thể cần cấp quyền lại.
- Dùng lại chế độ một shop của Facebook: người mở website có cấu hình có thể được cấp phiên. Chưa có đăng nhập/phân quyền nhiều khách hàng; chỉ chia sẻ site demo với người bạn muốn cho truy cập.
- Test dùng phản hồi Shopee giả lập và PostgreSQL WASM; không chứng minh app được duyệt hoặc truy cập được shop thật.

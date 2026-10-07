# Tendly — Frontend

React + Vite + TypeScript. Hiện chạy hoàn toàn bằng **mock data** (chưa có backend).

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

## Các trang

| Route | Trang |
| --- | --- |
| `/cau-hinh-ai` | Cấu hình AI — sản phẩm (đồng bộ Shopee, nhập CSV, lọc, phân trang), FAQ (thêm/sửa/xoá/bật tắt, thử hỏi AI), email tự động (bật tắt, sửa mẫu, gửi thử) |
| `/cai-dat` | Cài đặt — thông tin shop, gói cước, nhân viên (mời/đổi vai trò/xoá), kênh kết nối |
| `/khach-hang/chat` | Khung chat phía khách — bot trả lời theo FAQ + sản phẩm, chốt đơn, tự chuyển nhân viên khi khách bực |
| `/khach-hang/chuyen-tiep` | Hội thoại đã chuyển cho nhân viên thật |
| `/khach-hang/email` | Hộp thư khách nhận email cá nhân hoá |
| `/tong-quan`, `/hop-thoai`, `/marketing` | Placeholder |

## Mock data → backend

- `src/mocks/seed.ts` — dữ liệu ban đầu.
- `src/mocks/db.ts` — "database" lưu trong `localStorage` (key `tendly.mockdb`), nên chỉnh sửa còn sau khi reload. Cài đặt → "Khôi phục dữ liệu mẫu" để reset.
- `src/services/api.ts` — **toàn bộ UI chỉ gọi qua file này**. Khi có backend, giữ nguyên tên/chữ ký hàm và thay phần thân bằng `fetch(...)`.
- `src/services/chatBot.ts` — "AI" giả lập bằng so khớp từ khoá; thay bằng API gọi model thật sau.

# Phân quyền cấu hình AI

- Admin: `/quan-tri?tab=settings`, tab **Cấu hình AI chung**. Với mỗi AI (và tùy chọn từng nền tảng), admin chỉ đặt 5 mục cơ bản: mô tả chung, lĩnh vực, vai trò, quy định/nguyên tắc/quy chuẩn, từ cấm dùng. Mục để trống ở nền tảng sẽ dùng giá trị chung.
- User (chủ shop): `/cau-hinh-ai`. Tab đầu quản lý AI; tab thứ hai bật/tắt và cá nhân hóa chi tiết cho Page của shop: nhiệm vụ, đầu vào, đầu ra, chỉ dẫn bổ sung, quy tắc theo từng AI và theo nền tảng (giá/MOQ của Smart Sourcing cũng ở đây). AI Chat có quy tắc riêng theo Fanpage và vẫn cần xác nhận tri thức trước khi tự trả lời.

## Kiến trúc 3 tầng (SaaS)

```
Global (Tendly/admin) → Platform (FB/TikTok/Zalo, admin) → Page (một Page của shop, chủ shop cá nhân hóa)
```

- **Admin (Global, Platform):** 5 mục cơ bản lưu ở `ai_global_settings` (migration 020), `GET/PUT /api/admin/ai-settings` chỉ cho admin. Mục trống ở Platform kế thừa Global; từ cấm cộng dồn.
- **Shop (Page):** cấu hình chi tiết từng AI lưu trên server ở `ai_page_profiles` (migration 021), mỗi Page một bản, kèm nền tảng của Page. `GET/PUT /api/ai-settings`; `shop_id` lấy từ phiên, chủ shop chỉ thao tác Page của mình. AI Chat giữ nguồn riêng ở `messenger_ai_settings` vì có luồng xác nhận tri thức.
- **Chỗ ghép duy nhất:** `globalAiSystemPrompt(role, platform, pageId)` trong `lib/services/aiGlobalSettings.ts`. Phần admin đứng trước và được ghi là không được vượt; phần shop đứng sau. Nơi gọi đã tự nhúng bản cấu hình đã duyệt (Content/Review của campaign, AI Chat inbox) truyền `includeShop: false` để không nhúng hai lần.
- **Marketing:** server tự chép cấu hình Page vào campaign khi tạo/sửa brief; client không gửi cấu hình. Marketing lưu phiên bản cấu hình chung vào căn cứ Review; thay đổi cấu hình chung yêu cầu Review/duyệt lại trước khi đăng bài cũ.
- Các kiểm tra dữ kiện, giới hạn gửi và phê duyệt vẫn thực thi bằng code. Chỉ dẫn model không thay thế các kiểm tra này.

## Phạm vi demo

- Một tài khoản = một shop = một Facebook Page (`PAGE_ID`). Nơi gọi AI chưa truyền `pageId` dùng Page này.
- Lần đầu mở Cấu hình AI, bản cũ trong trình duyệt được nạp làm nháp; bấm Lưu để đưa lên server.
- Bản cấu hình chung dùng `version: 2`; bản kiểu cũ (version 1) được bỏ qua và trả về mặc định cho tới khi admin lưu lại.
- Smart Sourcing chưa có bước phân tích bằng Gemini; cấu hình của vai trò này chỉ dùng để điền sẵn tiêu chí tìm kiếm.
- Chạy `npm run db:migrate` khi triển khai sang database khác.
- Kiểm thử dùng database PGlite/pg-mem và provider giả lập; không chứng minh Gemini hoặc Meta đã gửi thành công ngoài thực tế.

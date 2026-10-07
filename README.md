This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Nguồn dữ liệu cho AI của Tendly

Trong `/cau-hinh-ai`, nhập/đồng bộ sản phẩm, lưu FAQ và cấu hình email tự động. Mỗi lần hỏi AI, ứng dụng đọc lại dữ liệu đã lưu; chỉ FAQ đang bật và kịch bản email đang bật được cung cấp cho Gemini. Hộp thoại, khung chat khách và ô **Thử hỏi AI** dùng chung luồng này.

Sản phẩm là nguồn cho giá, chất liệu, size, màu và tổng tồn kho. FAQ là nguồn cho chính sách shop. Mẫu email chỉ cung cấp thông tin về kịch bản, không chứng minh khách đủ điều kiện nhận ưu đãi hay email đã được gửi. Chỉ dẫn yêu cầu AI báo thiếu dữ liệu thay vì đoán thông tin hoặc tự xác nhận đã tạo đơn/gửi email. Việc gửi email thực tế không nằm trong tính năng này.

Cấu hình hiện dùng mock DB tại `localStorage` của trình duyệt, chưa phải dữ liệu chung trên backend. Client gửi bản cấu hình đã lưu tới `/api/chat`; server kiểm tra cấu trúc, lọc trạng thái và tạo chỉ dẫn. Khi tích hợp kênh khách thật, cần lưu cấu hình ở backend và để server đọc theo shop đã xác thực, thay cho bản cấu hình client gửi. Tính năng này chưa thêm lưu lịch sử hay tính cách từng khách.

Đặt `GEMINI_API_KEY` trong `.env.local` (xem `.env.example`), có thể đặt thêm `GEMINI_MODEL` để chọn model được cấp quyền. Khóa chỉ được đọc ở server. API sử dụng [Gemini generateContent](https://ai.google.dev/api/generate-content).

## Cảm xúc và hàng chờ trả lời

Khi khách nhắn tin ở Hộp thoại, Gemini phân tích cảm xúc (tích cực, trung lập, lo lắng, thất vọng, tức giận), mức ưu tiên (cao, bình thường, thấp), lý do và nhu cầu nhân viên hỗ trợ; sau đó tạo câu trả lời theo cảm xúc và nguồn Cấu hình AI trong cùng một lượt. API yêu cầu [kết quả có cấu trúc](https://ai.google.dev/gemini-api/docs/generate-content/structured-output) và kiểm tra nhãn trước khi cập nhật UI. Tối đa 10 tin nhắn đang có trong phiên được dùng làm ngữ cảnh; chưa lưu thêm lịch sử hay tính cách khách vào database.

Hội thoại chưa trả lời đứng trước hội thoại đã xử lý, sắp theo điểm ưu tiên ứng dụng tính từ mức khẩn cấp và cảm xúc. Cùng điểm thì khách chờ lâu hơn đứng trước. Nhãn trong danh sách, đầu chat và hồ sơ cập nhật đồng thời; phần **Cảm xúc & ưu tiên** hiển thị lý do. Nhãn mẫu ban đầu là dữ liệu demo; bấm **Phân tích AI** để đánh giá tin đang chờ hoặc gửi tin mới để tự động phân tích. Shop gửi câu trả lời/gợi ý AI sẽ bỏ trạng thái Khẩn cấp, tin khách tiếp theo mở lại hàng chờ. Lỗi AI giữ tin ở trạng thái chờ và có nút thử lại; kết quả chậm không ghi đè câu hỏi mới.

Chạy `npm test` để kiểm tra luồng dữ liệu cấu hình → API → Gemini bằng phản hồi giả lập. Các bài kiểm tra bao gồm sửa giá/tồn kho/FAQ/email, xóa/tắt nguồn dữ liệu, lỗi cấu hình, lỗi model và bỏ qua chỉ dẫn tùy ý từ client. Chạy `npm run build` để kiểm tra bản production.

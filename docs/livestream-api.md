# Livestream — API cho dashboard

Lõi Livestream đã chạy xong. Dashboard trong lúc live và dashboard tổng quan chỉ cần gọi **2 file**:

- `lib/hooks/useLiveSession.ts`: dữ liệu của 1 phiên. Khi phiên đang live, hook tự `sync` khoảng 3 giây một lần và tạm dừng khi tab bị ẩn.
- `lib/services/liveClient.ts`: các thao tác (bắt đầu/kết thúc phiên, đổi mẫu lên sóng, duyệt nhóm, đổi trạng thái đơn, xem tổng quan).

Kiểu dữ liệu nằm trong `lib/types/live.ts`. Trang chạy thử `app/livestream` (`components/features/livestream/LivestreamShell.tsx`) là ví dụ dùng đầy đủ, nên **thay bằng dashboard thật**.

Mọi API cần mã quản trị `DASHBOARD_KEY` (header `Authorization: Bearer …`). `dashboardRequest` đã tự gắn mã này. Khi thiếu mã, API trả `401 NEED_DASHBOARD_KEY`. Có thể dùng `MarketingDataNotice` để hiện ô nhập mã.

## Dùng nhanh

```tsx
const { snapshot, error, apply, reload } = useLiveSession(sessionId);
// snapshot: LiveSnapshot | null — tự cập nhật khi đang live

await liveClient.start({ platform: 'demo', title: 'Live tối thứ 6' });          // phiên demo (kịch bản ~3 phút)
await liveClient.start({ platform: 'facebook', sourceKind: 'post', sourceId });  // nguồn lấy từ liveClient.sources()
apply(await liveClient.setOnAir(id, 'AT-01'));                                    // mẫu đang lên sóng
const r = await liveClient.approve(id, group.key, text, group.revision);          // nhắn riêng cả nhóm
apply(await liveClient.updateOrder(id, order.id, 'confirmed'));
apply(await liveClient.end(id));                                                  // kết thúc → snapshot.summary
const overview = await liveClient.insights();                                     // dashboard tổng quan
```

## Flow bắt đầu live

1. Người bán bấm **Bắt đầu phiên** trên Tendly. Facebook chọn `sourceKind: 'auto'`, demo gửi `waitForLive: true`.
2. Cửa sổ hỗ trợ **bật ra ngay trong cú bấm đó**: `openLiveMini(liveClient.start(...).then((s) => s.id))`.
3. Cửa sổ hiện màn hình chờ (`snapshot.session.waiting = true`) kèm hướng dẫn bật live.
4. Người bán bật **Phát trực tiếp** trên Trang của shop.
   - Mỗi lượt `sync`, Tendly dò `/{page}/live_videos?broadcast_status=["LIVE"]` (tối đa 10 giây/lần, để không hết hạn mức API của Trang).
   - Thấy video thì tự gắn video đó làm nguồn bình luận, đặt `liveAt`, và cửa sổ tự chuyển sang hỗ trợ bán hàng.
   - Phiên demo thì gọi `liveClient.goLive(id)` (nút "Giả lập bật live").

Lưu ý: Meta chỉ cho Trang có **từ 100 người theo dõi** phát Live. Trang chưa đủ thì pitch bằng phiên demo.

## Cửa sổ nổi hỗ trợ lúc live

`openLiveMini(sessionId)` trong `lib/services/liveMiniWindow.tsx` mở **cửa sổ nhỏ luôn nằm trên cùng** (Document Picture-in-Picture, Chrome/Edge). Người bán kéo cửa sổ này đặt cạnh màn hình đang phát live. Cửa sổ hiện:
- Mẫu đang lên sóng và số còn lại.
- Cảnh báo hết hàng, phàn nàn, đổi trả.
- 3 mẫu nên lên sóng tiếp theo.
- Các nhóm chờ nhắn riêng. Nút gửi bấm 2 lần mới gửi, không dùng `confirm()`.
- Bình luận mới.

Trình duyệt không hỗ trợ cửa sổ nổi thì hàm mở popup `/livestream/mini?session=…`. Link đó cũng mở được trên điện thoại.
Hàm trả về `'pip' | 'popup' | 'blocked'`. Phải gọi hàm **trong lúc người dùng bấm nút**, vì trình duyệt chỉ cho mở cửa sổ khi có thao tác của người dùng.

Mọi nơi dùng `useLiveSession` cùng một phiên (trang chính, dashboard, cửa sổ nổi) **chung một vòng cập nhật**, nên không gọi `sync` trùng nhau. Khi tab chính bị ẩn nhưng cửa sổ nổi vẫn mở, dữ liệu vẫn tiếp tục cập nhật.

## Endpoints

| Method | Đường dẫn | Body | Trả về |
|---|---|---|---|
| GET | `/api/live/sources` | | `{ sources: LiveSourceOption[], upcoming: ['tiktok','shopee'] }` |
| GET | `/api/live/sessions` | | `{ sessions: LiveSessionListItem[] }` |
| POST | `/api/live/sessions` | `{ platform, sourceKind?, sourceId?, title?, knowledge }` | `{ session }` |
| GET | `/api/live/sessions/:id` | | `LiveSnapshot` (không kéo bình luận mới) |
| POST | `/api/live/sessions/:id/go-live` | (chỉ phiên demo đang chờ) | `LiveSnapshot` |
| POST | `/api/live/sessions/:id/sync` | | `LiveSnapshot` (kéo bình luận mới, phân loại) |
| POST | `/api/live/sessions/:id/on-air` | `{ sku \| null }` | `LiveSnapshot` |
| POST | `/api/live/sessions/:id/comments` | `{ authorName, text }` (chỉ phiên demo) | `LiveSnapshot` |
| POST | `/api/live/sessions/:id/groups/:key/approve` | `{ text, revision }` | `LiveSendResult & { revision }` |
| PATCH | `/api/live/sessions/:id/orders/:orderId` | `{ status }` | `LiveSnapshot` |
| POST | `/api/live/sessions/:id/end` | | `LiveSnapshot` có `summary` |
| GET | `/api/live/insights` | | `LiveInsights` (theo phiên + theo tháng) |

`knowledge` là `currentAiKnowledge()` (sản phẩm, giá, tồn kho, FAQ trong Cấu hình AI). `liveClient.start` tự gửi kèm. Danh mục này **được chốt lại lúc bắt đầu phiên**.

## `LiveSnapshot` — hiển thị gì trong lúc live

- `stats`: số bình luận, số khách, số đơn, doanh thu dự kiến, số tin chờ nhắn / đã nhắn, `aiCalls` (số lần gọi AI, để nói "AI không đọc từng bình luận" khi pitch), `avgResponseSec`.
- `onAir`: mẫu đang lên sóng. Bình luận ngắn như "1", "chốt M trắng", "giá bn" được gán cho mẫu này.
- `queue`: **Lên sóng tiếp theo**. Đây là các mẫu được hỏi, xin xem, chốt nhiều nhất trong 10 phút gần nhất, kèm `recommendation` ("23 người hỏi, còn 5 — nên giới thiệu ngay").
- `stock`: **Stock Guard**, gồm `level` = `ok | low | out`, `held` (đang giữ cho đơn), `remaining`.
- `groups`: **bình luận cùng ý gom thành nhóm** (ví dụ 35 câu hỏi giá thành 1 nhóm `price:AT-01`).
  - `pending` / `sent` / `notAllowed`: số tin chờ gửi, đã gửi, và bị Meta không cho nhắn riêng.
  - `status`: `review | sending | partial | sent`.
  - `needsHuman = true`: phàn nàn, đổi trả, hoặc chưa rõ khách hỏi mẫu nào. Nên tô đỏ.
  - `replySource`: `template` (câu mẫu), `ai` (AI soạn), `shop` (shop đã sửa).
  - `replyText` có thể chứa placeholder, server tự điền riêng cho từng khách lúc gửi: `{ten_khach} {san_pham} {mau} {size} {so_luong} {gia} {con_lai} {ds_size} {ds_mau} {goi_y}`.
  - Phải gửi kèm **`revision` hiện tại** khi duyệt. Nếu lệch, API trả `409` ("Hãy tải lại").
- `orders`: **đơn nháp, mỗi khách một đơn**. Khách chốt nhiều lần thì được gộp vào đơn đó.
  - `items[].stockOk = false`: khách chốt lúc mẫu đã hết hàng. Món này không giữ hàng và vào nhóm `order_out:*` (tin nhắn báo hết và gợi ý mẫu khác).
  - `status`: `draft` → (sau khi nhắn xin SĐT/địa chỉ) `awaiting_info` → `confirmed`, hoặc `cancelled` (huỷ thì trả hàng đang giữ).
- `recent`: 50 bình luận mới nhất, mỗi bình luận có `intent` (`order, price, size_advice, stock, view, shipping, return, complaint, question, other`).
- `summary`: chỉ có sau khi kết thúc phiên. Gồm `topAsked`, `topOrdered`, `askedNotOrdered` (hỏi nhiều nhưng không ai chốt), `timeline` theo phút, `peakAt`, `conversionRate`, và `advice` (nên nhập thêm / giữ / hạn chế, do AI viết, lỗi thì theo luật) cùng `highlights`.

## Nhắn riêng

- `liveClient.approve` tự gọi lại API cho tới khi gửi hết, vì mỗi lần API chỉ gửi tối đa 15 tin. Kết quả có dạng `{ sent, failed, notAllowed, unknown, remaining }`.
- Phiên **demo** chỉ giả lập gửi.
- Phiên **Facebook** gửi Private Reply thật qua Meta:
  - Hệ thống kiểm tra `can_reply_privately` cho từng bình luận trước khi gửi.
  - Tin nào không rõ đã gửi hay chưa (`unknown`) thì **không tự gửi lại**.
  - Meta chỉ cho nhắn riêng **1 lần cho mỗi bình luận, trong 7 ngày**.
- Bình luận thuộc bài/video đang là nguồn của một phiên live sẽ bị **luồng Bình luận Fanpage bỏ qua**, để hai luồng không nhắn trùng.

## Chi phí AI

Phần lớn bình luận được xử lý **bằng luật**: nhận ý định, tìm SKU/màu/size/số lượng, hiểu chữ không dấu và chữ viết tắt (`ib`, `sz`, `bn`…). Câu trả lời mẫu điền giá và tồn kho từ dữ liệu shop. AI chỉ được gọi khi:
1. Có câu hỏi mà luật không hiểu: gom tối đa 20 câu vào 1 lần gọi, khi đủ 5 câu hoặc câu cũ nhất đã chờ 20 giây.
2. Cần soạn 1 câu trả lời chung cho nhóm tư vấn size hoặc nhóm câu hỏi khác.
3. Viết tóm tắt và gợi ý nhập hàng: 1 lần khi kết thúc phiên.

Trong lần chạy thử phiên demo (57 bình luận), AI chỉ được gọi 6 lần.

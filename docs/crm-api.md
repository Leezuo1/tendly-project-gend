# API xuất khách hàng cho CRM

Bản demo để trình bày cách Tendly trao dữ liệu khách cho hệ thống CRM của doanh nghiệp. Chưa phải kênh đồng bộ production.

## Xác thực

Đặt `CRM_API_KEY` (chuỗi dài ngẫu nhiên, chỉ ở server) trong `.env.local`, rồi gửi kèm mọi yêu cầu:

```
Authorization: Bearer <CRM_API_KEY>
```

Thiếu header, sai key, hoặc server chưa đặt `CRM_API_KEY` đều trả `401`. Dữ liệu lấy theo `PAGE_ID` của server.

## `GET /api/crm/customers`

| Tham số | Ý nghĩa |
|---|---|
| `limit` | Số khách mỗi trang, 1 đến 100, mặc định 50. Giá trị lạ được đưa về khoảng này. |
| `after` | `nextCursor` của trang trước. Bỏ trống để lấy trang đầu. |

Trong PowerShell dùng `curl.exe` (`curl` là bí danh của `Invoke-WebRequest`) và dán key từ `.env.local`:

```powershell
curl.exe -H "Authorization: Bearer <CRM_API_KEY>" "http://localhost:3000/api/crm/customers?limit=2"
```

```json
{
  "customers": [
    {
      "id": "7345012345678901",
      "channel": "messenger",
      "name": "Nguyễn An",
      "needs": "Cần áo thun size L, giao trước thứ 6",
      "needsUpdatedAt": 1795800000000,
      "createdAt": 1795000000000,
      "lastMessageAt": 1795790000000,
      "orders": { "confirmedCount": 2, "confirmedTotalVnd": 500000, "lastConfirmedAt": 1795700000000, "includesMock": false }
    }
  ],
  "nextCursor": "7345012345678901"
}
```

`nextCursor` là `null` ở trang cuối. Thời gian là mili giây Unix.

| Trường | Ghi chú |
|---|---|
| `id` | Mã khách trên Messenger (psid), ổn định, dùng làm khóa ở CRM. |
| `name` | Tên lấy từ Messenger; `null` nếu Messenger chưa cung cấp. |
| `needs` | Nhu cầu do nhân viên ghi trong Hộp thoại; chuỗi rỗng nếu chưa ghi. |
| `orders` | Chỉ tính đơn đã xác nhận. `includesMock: true` nghĩa là có đơn demo trong số liệu; CRM thật nên bỏ qua khách có cờ này hoặc lọc lại. |

## Giới hạn

- Chỉ đọc; không có webhook đẩy ra và không lọc theo thời gian (`updatedSince`). Thêm khi CRM thật cần đồng bộ gia tăng.
- Chỉ khách Messenger của một Page. Khách Zalo chưa hỗ trợ.
- Không có số điện thoại, email, địa chỉ: Tendly chưa lưu các thông tin này theo khách.
- Khách mà nhân viên đã xóa khỏi Hộp thoại không được xuất.

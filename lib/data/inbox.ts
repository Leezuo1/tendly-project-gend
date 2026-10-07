import { Conversation } from '../types/inbox';

export const INITIAL_CONVERSATIONS: Conversation[] = [
  // 1. Phương T. - Khiếu nại giao sai màu
  {
    id: 'phuong',
    name: 'Phương T.',
    avatar: 'PT',
    channel: 'facebook',
    time: '4 phút',
    preview: 'Đơn của em bị giao sai màu rồi, đây là lần thứ 2...',
    tags: [{ label: '😠 Cảm xúc âm', type: 'high' }],
    isUrgent: true,
    isUnreplied: true,
    threadWho: {
      name: 'Phương T.',
      sub: 'Messenger · Fanpage Tendly Store',
      badgeTag: { label: '😠 Khách khiếu nại gấp', type: 'high' },
    },
    messages: [
      {
        id: 'p1',
        sender: 'in',
        text: 'Đơn của em bị giao sai màu rồi, đây là lần thứ 2 luôn á shop ơi! Đặt màu be mà giao màu xám chì...',
        time: '09:30',
      },
      {
        id: 'p2',
        sender: 'out',
        text: 'Dạ Tendly thay mặt shop chân thành xin lỗi chị Phương ạ! Shop rất tiếc vì sự nhầm lẫn này từ bộ phận đóng gói. Chị cho shop xin 1 phút kiểm tra lại đơn #TD-8912 nhé ạ!',
        time: '09:31',
        isAiReply: true,
        aiSource: 'Kịch bản xoa dịu khách',
      },
      {
        id: 'p3',
        sender: 'in',
        text: 'Shop đổi gấp trong ngày nay cho em nha, mai em cần mặc đi tiệc rồi đó, trễ là em hoàn hàng luôn á!',
        time: '09:34',
      },
    ],
    aiSuggestion: {
      label: '✨ AI Gemini 3.5 Flash-Lite đề xuất',
      source: 'Độ tin cậy 98% · Chính sách đổi trả hỏa tốc',
      text: 'Dạ shop đã tạo đơn hoả tốc gửi lại áo màu Be đến chị trước 15h chiều nay rồi ạ. Shipper sẽ đồng thời thu hồi lại chiếc áo xám chì mà chị không mất thêm bất kỳ chi phí nào nhé.',
    },
    profile: {
      avatar: 'PT',
      name: 'Phương T.',
      since: 'Khách hàng từ T5/2025',
      tags: [
        { label: 'Nguy cơ rời bỏ', type: 'high' },
        { label: 'Khiếu nại màu sắc', type: 'risk' },
      ],
      channel: 'Messenger',
      orderCount: '4 đơn',
      shippingArea: 'Quận 1, TP.HCM',
      totalSpent: '1.420.000đ',
      timeline: [
        { id: 'pt-t1', text: 'Khiếu nại giao sai màu lần 2 trong hội thoại', time: 'Hôm nay, 09:34' },
        { id: 'pt-t2', text: 'Đặt hàng Đầm len tay dài — 380.000đ', time: '04/09/2026' },
      ],
    },
  },

  // 2. Việt H. - Tra cứu vận chuyển gấp
  {
    id: 'viet',
    name: 'Việt H.',
    avatar: 'VH',
    channel: 'zalo',
    time: '12 phút',
    preview: 'Ship gì mà 5 ngày chưa tới, shop trả lời giúp em với...',
    tags: [{ label: '😠 Cần tra cứu vận đơn', type: 'high' }],
    isUrgent: true,
    isUnreplied: true,
    threadWho: {
      name: 'Việt H.',
      sub: 'Zalo OA · Tendly Official',
      badgeTag: { label: '😠 Giao hàng chậm', type: 'high' },
    },
    messages: [
      {
        id: 'v1',
        sender: 'in',
        text: 'Ship gì mà 5 ngày chưa tới, shop trả lời giúp em với, cần gấp đi công tác mà mãi không thấy đâu!',
        time: '09:18',
      },
    ],
    aiSuggestion: {
      label: '✨ AI Gemini 3.5 Flash-Lite đề xuất',
      source: 'Tra cứu mã vận đơn #TD-8821',
      text: 'Đơn hàng #TD-8821 của bạn hiện đã đến bưu cục Cầu Giấy và shipper đang đi phát, dự kiến giao trước 16h chiều nay. Shop đã giục bên vận chuyển ưu tiên phát sớm nhất cho bạn nhé.',
    },
    profile: {
      avatar: 'VH',
      name: 'Việt H.',
      since: 'Khách hàng từ T8/2026',
      tags: [{ label: 'Cần hàng gấp', type: 'high' }],
      channel: 'Zalo OA',
      orderCount: '2 đơn',
      shippingArea: 'Cầu Giấy, Hà Nội',
      totalSpent: '890.000đ',
      timeline: [
        { id: 'vh-t1', text: 'Hỏi tiến độ giao hàng đơn #TD-8821', time: 'Hôm nay, 09:18' },
      ],
    },
  },

  // 3. Chị Lan - Hỏi đổi size
  {
    id: 'lan',
    name: 'Chị Lan',
    avatar: 'CL',
    channel: 'facebook',
    time: '25 phút',
    preview: 'Dạ cho em hỏi thêm là áo có được đổi size không nếu mặc không vừa?',
    tags: [{ label: '🔁 Khách tiềm năng', type: 'loop' }],
    isUrgent: false,
    isUnreplied: true,
    threadWho: {
      name: 'Chị Lan',
      sub: 'Messenger · Fanpage Tendly',
      badgeTag: { label: '🔁 Hỏi chính sách đổi size', type: 'loop' },
    },
    messages: [
      {
        id: 'l1',
        sender: 'in',
        text: 'Chào shop, áo này size L còn không, ship về Hà Nội mấy ngày vậy ạ?',
        time: '08:40',
      },
      {
        id: 'l2',
        sender: 'out',
        text: 'Dạ shop còn sẵn hàng size L bạn nhé. Thời gian giao hàng về Hà Nội thường mất từ 1 đến 2 ngày làm việc.',
        time: '08:42',
        isAiReply: true,
        aiSource: 'Gemini Flash-Lite',
      },
      {
        id: 'l3',
        sender: 'in',
        text: 'Dạ cho em hỏi thêm là áo có được đổi size không nếu mặc không vừa ạ?',
        time: '09:05',
      },
    ],
    aiSuggestion: {
      label: '✨ AI Gemini 3.5 Flash-Lite đề xuất',
      source: 'Chính sách đổi trả Tendly',
      text: 'Shop hỗ trợ đổi size miễn phí trong vòng 7 ngày kể từ khi nhận hàng bạn nhé. Bạn chỉ cần giữ áo còn nguyên tem mác và chưa qua giặt ủi là được hỗ trợ đổi tận nơi.',
    },
    profile: {
      avatar: 'CL',
      name: 'Chị Lan',
      since: 'Khách hàng từ T3/2025',
      tags: [
        { label: 'Khách VIP', type: 'vip' },
        { label: 'Quan tâm Áo L', type: 'loop' },
      ],
      channel: 'Messenger',
      orderCount: '6 đơn',
      shippingArea: 'Hà Nội',
      totalSpent: '2.850.000đ',
      timeline: [
        { id: 'cl-t1', text: 'Hỏi đổi size trong hội thoại', time: 'Hôm nay, 09:05' },
      ],
    },
  },

  // 4. Khánh D. - Khách VIP hỏi màu áo
  {
    id: 'khanh',
    name: 'Khánh D.',
    avatar: 'KD',
    channel: 'zalo',
    time: '45 phút',
    preview: 'Cho hỏi áo sơ mi dài tay có sẵn màu đen không ạ?',
    tags: [{ label: '⭐ VIP', type: 'vip' }],
    isUrgent: false,
    isUnreplied: true,
    threadWho: {
      name: 'Khánh D.',
      sub: 'Zalo OA · Tendly Official',
      badgeTag: { label: '⭐ Khách hàng VIP', type: 'vip' },
    },
    messages: [
      {
        id: 'k1',
        sender: 'in',
        text: 'Cho hỏi áo sơ mi dài tay có sẵn màu đen không ạ?',
        time: '08:15',
      },
    ],
    aiSuggestion: {
      label: '✨ AI Gemini 3.5 Flash-Lite đề xuất',
      source: 'Kho hàng TP.HCM',
      text: 'Dạ áo sơ mi dài tay màu đen bên mình hiện vẫn còn sẵn hàng bạn nhé. Bạn cần lấy size nào để mình hỗ trợ giữ hàng và tạo đơn ngay cho bạn?',
    },
    profile: {
      avatar: 'KD',
      name: 'Khánh D.',
      since: 'Khách hàng từ T1/2024',
      tags: [{ label: 'Khách VIP', type: 'vip' }],
      channel: 'Zalo OA',
      orderCount: '11 đơn',
      shippingArea: 'Bình Thạnh, TP.HCM',
      totalSpent: '5.600.000đ',
      timeline: [
        { id: 'kd-t1', text: 'Hỏi màu áo sơ mi đen', time: 'Hôm nay, 08:15' },
      ],
    },
  },

  // 5. Bảo Trâm - Hỏi phụ kiện kèm theo
  {
    id: 'tram',
    name: 'Bảo Trâm',
    avatar: 'BT',
    channel: 'facebook',
    time: '2 giờ',
    preview: 'Váy hoa nhí này có tặng kèm thắt lưng như trong ảnh không?',
    tags: [],
    isUrgent: false,
    isUnreplied: true,
    threadWho: {
      name: 'Bảo Trâm',
      sub: 'Messenger · Fanpage Tendly',
    },
    messages: [
      {
        id: 'bt1',
        sender: 'in',
        text: 'Váy hoa nhí này có tặng kèm thắt lưng như trong hình mẫu không shop hay phải mua riêng?',
        time: '06:12',
      },
    ],
    aiSuggestion: {
      label: '✨ AI Gemini 3.5 Flash-Lite đề xuất',
      source: 'Thông số sản phẩm',
      text: 'Mẫu váy hoa nhí này đã có sẵn thắt lưng da cùng màu đi kèm trong set đồ bạn nhé. Bạn không cần phải mua thêm phụ kiện thắt lưng bên ngoài.',
    },
    profile: {
      avatar: 'BT',
      name: 'Bảo Trâm',
      since: 'Khách hàng từ T2/2026',
      tags: [{ label: 'Khách quen', type: 'vip' }],
      channel: 'Messenger',
      orderCount: '3 đơn',
      shippingArea: 'Biên Hòa, Đồng Nai',
      totalSpent: '1.050.000đ',
      timeline: [
        { id: 'bt-t1', text: 'Hỏi chi tiết phụ kiện kèm váy', time: 'Hôm nay, 06:12' },
      ],
    },
  },

  // 6. Quốc Anh - Hỏi hóa đơn VAT
  {
    id: 'quoc',
    name: 'Quốc Anh',
    avatar: 'QA',
    channel: 'zalo',
    time: '3 giờ',
    preview: 'Mình cần xuất hoá đơn VAT cho đơn hàng 10 áo thun công ty...',
    tags: [{ label: '⭐ Doanh nghiệp', type: 'vip' }],
    isUrgent: false,
    isUnreplied: false,
    threadWho: {
      name: 'Quốc Anh',
      sub: 'Zalo OA · Tendly Official',
      badgeTag: { label: '⭐ Khách hàng doanh nghiệp', type: 'vip' },
    },
    messages: [
      {
        id: 'qa1',
        sender: 'in',
        text: 'Mình cần xuất hoá đơn VAT điện tử cho đơn hàng 10 áo thun công ty',
        time: '05:15',
      },
      {
        id: 'qa2',
        sender: 'out',
        text: 'Dạ shop có hỗ trợ xuất hoá đơn điện tử VAT đầy đủ bạn nhé. Bạn vui lòng gửi thông tin tên công ty, mã số thuế và địa chỉ email nhận hoá đơn giúp shop nhé.',
        time: '05:16',
        isAiReply: true,
        aiSource: 'Gemini Flash-Lite',
      },
    ],
    profile: {
      avatar: 'QA',
      name: 'Quốc Anh',
      since: 'Khách hàng từ T11/2025',
      tags: [{ label: 'Doanh nghiệp', type: 'vip' }],
      channel: 'Zalo OA',
      orderCount: '5 đơn',
      shippingArea: 'Hoàn Kiếm, Hà Nội',
      totalSpent: '7.200.000đ',
      timeline: [
        { id: 'qa-t1', text: 'Yêu cầu xuất hoá đơn đỏ VAT đơn áo công ty', time: 'Hôm nay, 05:15' },
      ],
    },
  },

  // 7. Mai Linh - Hỏi phối đồ (Luật 1: không tự ý chào thêm sản phẩm khác)
  {
    id: 'linh',
    name: 'Mai Linh',
    avatar: 'ML',
    channel: 'facebook',
    time: '3 giờ',
    preview: 'Áo blazer này phối với chân váy chữ A đen có hợp đi làm không?',
    tags: [{ label: 'Hỏi phối đồ', type: 'loop' }],
    isUrgent: false,
    isUnreplied: true,
    threadWho: {
      name: 'Mai Linh',
      sub: 'Messenger · Fanpage Tendly Store',
    },
    messages: [
      {
        id: 'ml1',
        sender: 'in',
        text: 'Áo blazer này phối với chân váy chữ A màu đen có hợp đi làm công sở không shop?',
        time: '04:45',
      },
    ],
    aiSuggestion: {
      label: '✨ AI Gemini 3.5 Flash-Lite đề xuất',
      source: 'Tư vấn trang phục (Không upsell)',
      text: 'Cách phối áo blazer cùng chân váy chữ A màu đen rất thanh lịch và hoàn toàn phù hợp với môi trường công sở bạn nhé. Set đồ này vừa gọn gàng vừa tạo cảm giác chỉn chu khi đi làm.',
    },
    profile: {
      avatar: 'ML',
      name: 'Mai Linh',
      since: 'Khách hàng từ T4/2026',
      tags: [{ label: 'Công sở', type: 'loop' }],
      channel: 'Messenger',
      orderCount: '2 đơn',
      shippingArea: 'Quận 3, TP.HCM',
      totalSpent: '820.000đ',
      timeline: [
        { id: 'ml-t1', text: 'Hỏi tư vấn phối blazer công sở', time: 'Hôm nay, 04:45' },
      ],
    },
  },

  // 8. Kiều Oanh - Chờ restock
  {
    id: 'oanh',
    name: 'Kiều Oanh',
    avatar: 'KO',
    channel: 'facebook',
    time: '5 giờ',
    preview: 'Set dạ tweed màu kem còn restock đợt tới không shop ơi?',
    tags: [{ label: 'Chờ restock', type: 'loop' }],
    isUrgent: false,
    isUnreplied: false,
    threadWho: {
      name: 'Kiều Oanh',
      sub: 'Messenger · Fanpage Tendly',
    },
    messages: [
      {
        id: 'ko1',
        sender: 'in',
        text: 'Set dạ tweed màu kem còn restock đợt tới không shop ơi, canh mãi mà hết size S?',
        time: '02:20',
      },
      {
        id: 'ko2',
        sender: 'out',
        text: 'Dạ set dạ tweed màu kem dự kiến sẽ về thêm hàng vào thứ 6 tuần này bạn nhé. Shop đã lưu lại thông tin để khi hàng về sẽ nhắn tin thông báo ngay cho bạn.',
        time: '02:22',
        isAiReply: true,
        aiSource: 'Gemini Flash-Lite',
      },
    ],
    profile: {
      avatar: 'KO',
      name: 'Kiều Oanh',
      since: 'Khách hàng từ T4/2025',
      tags: [{ label: 'Yêu thích dạ tweed', type: 'loop' }],
      channel: 'Messenger',
      orderCount: '4 đơn',
      shippingArea: 'Đống Đa, Hà Nội',
      totalSpent: '2.100.000đ',
      timeline: [
        { id: 'ko-t1', text: 'Hỏi ngày restock Set dạ tweed', time: 'Hôm nay, 02:20' },
      ],
    },
  },

  // 9. Thanh Tùng - Hỏi COD & Đồng kiểm
  {
    id: 'tung',
    name: 'Thanh Tùng',
    avatar: 'TT',
    channel: 'facebook',
    time: '5 giờ',
    preview: 'Shop có cho kiểm tra hàng trước khi thanh toán cho shipper không?',
    tags: [{ label: 'Hỏi ship COD', type: 'loop' }],
    isUrgent: false,
    isUnreplied: true,
    threadWho: {
      name: 'Thanh Tùng',
      sub: 'Messenger · Fanpage Tendly',
    },
    messages: [
      {
        id: 'tt1',
        sender: 'in',
        text: 'Shop có cho kiểm tra hàng trước khi thanh toán tiền cho shipper không ạ?',
        time: '01:50',
      },
    ],
    aiSuggestion: {
      label: '✨ AI Gemini 3.5 Flash-Lite đề xuất',
      source: 'Chính sách đồng kiểm',
      text: 'Shop luôn hỗ trợ khách kiểm tra đúng mẫu mã và số lượng trước khi thanh toán tiền cho shipper bạn nhé. Bạn yên tâm kiểm tra hàng thoải mái khi shipper giao tới.',
    },
    profile: {
      avatar: 'TT',
      name: 'Thanh Tùng',
      since: 'Khách hàng mới',
      tags: [{ label: 'Khách mới', type: 'loop' }],
      channel: 'Messenger',
      orderCount: '0 đơn',
      shippingArea: 'Quận 10, TP.HCM',
      timeline: [
        { id: 'tt-t1', text: 'Hỏi chính sách đồng kiểm hàng COD', time: 'Hôm nay, 01:50' },
      ],
    },
  },

  // 10. Tuấn Kiệt - Hỏi giao gấp trong ngày
  {
    id: 'kiet',
    name: 'Tuấn Kiệt',
    avatar: 'TK',
    channel: 'zalo',
    time: '7 giờ',
    preview: 'Mình ở Đà Nẵng, đặt đơn bây giờ thì thứ 6 có nhận được trước 12h?',
    tags: [{ label: 'Hẹn giờ giao', type: 'loop' }],
    isUrgent: false,
    isUnreplied: true,
    threadWho: {
      name: 'Tuấn Kiệt',
      sub: 'Zalo OA · Tendly Official',
    },
    messages: [
      {
        id: 'tk1',
        sender: 'in',
        text: 'Mình ở Đà Nẵng, đặt đơn bây giờ thì thứ 6 có nhận được trước 12h trưa không shop?',
        time: '00:25',
      },
    ],
    aiSuggestion: {
      label: '✨ AI Gemini 3.5 Flash-Lite đề xuất',
      source: 'Lịch trình chuyển phát',
      text: 'Đơn hàng gửi đi Đà Nẵng thường mất từ 2 đến 3 ngày làm việc bạn nhé. Nếu bạn đặt ngay bây giờ, đơn sẽ kịp giao đến bạn trước trưa thứ 6.',
    },
    profile: {
      avatar: 'TK',
      name: 'Tuấn Kiệt',
      since: 'Khách hàng mới',
      tags: [{ label: 'Cần hẹn giờ', type: 'loop' }],
      channel: 'Zalo OA',
      orderCount: '1 đơn',
      shippingArea: 'Sơn Trà, Đà Nẵng',
      totalSpent: '490.000đ',
      timeline: [
        { id: 'tk-t1', text: 'Hỏi thời gian giao hàng Đà Nẵng', time: 'Hôm nay, 00:25' },
      ],
    },
  },

  // 11. Gia Huy - Hỏi chất liệu vải
  {
    id: 'huy',
    name: 'Gia Huy',
    avatar: 'GH',
    channel: 'zalo',
    time: '9 giờ',
    preview: 'Áo polo này là vải cotton 100% hay có pha sợi spandex vậy shop?',
    tags: [{ label: 'Hỏi chất liệu', type: 'loop' }],
    isUrgent: false,
    isUnreplied: true,
    threadWho: {
      name: 'Gia Huy',
      sub: 'Zalo OA · Tendly Official',
    },
    messages: [
      {
        id: 'gh1',
        sender: 'in',
        text: 'Áo polo này là vải cotton 100% thấm hút mồ hôi hay có pha sợi spandex co giãn vậy shop?',
        time: 'Hôm qua, 22:50',
      },
    ],
    aiSuggestion: {
      label: '✨ AI Gemini 3.5 Flash-Lite đề xuất',
      source: 'Chất liệu vải sản phẩm',
      text: 'Mẫu áo polo này được dệt từ chất liệu 95% cotton tự nhiên kết hợp 5% spandex bạn nhé. Nhờ đó áo vừa thấm hút mồ hôi tốt vừa có độ co giãn nhẹ tạo cảm giác thoải mái khi vận động.',
    },
    profile: {
      avatar: 'GH',
      name: 'Gia Huy',
      since: 'Khách hàng từ T12/2025',
      tags: [{ label: 'Quan tâm chất liệu', type: 'loop' }],
      channel: 'Zalo OA',
      orderCount: '4 đơn',
      shippingArea: 'Thủ Đức, TP.HCM',
      totalSpent: '1.750.000đ',
      timeline: [
        { id: 'gh-t1', text: 'Hỏi thành phần vải áo polo', time: 'Hôm qua, 22:50' },
      ],
    },
  },

  // 12. Bích Phượng - Đổi địa chỉ nhận hàng khẩn cấp
  {
    id: 'phuong-b',
    name: 'Bích Phượng',
    avatar: 'BP',
    channel: 'facebook',
    time: '10 giờ',
    preview: 'Shop ơi đơn #TD-9102 mình lỡ ghi nhầm địa chỉ cũ, đổi sang...',
    tags: [{ label: 'Đổi địa chỉ gấp', type: 'high' }],
    isUrgent: true,
    isUnreplied: true,
    threadWho: {
      name: 'Bích Phượng',
      sub: 'Messenger · Fanpage Tendly Store',
      badgeTag: { label: 'Đổi địa chỉ giao', type: 'high' },
    },
    messages: [
      {
        id: 'bp1',
        sender: 'in',
        text: 'Shop ơi đơn hàng #TD-9102 mình lỡ ghi nhầm địa chỉ nhà cũ, đổi sang số 125 Nguyễn Huệ Quận 1 giúp mình với!',
        time: 'Hôm qua, 22:15',
      },
    ],
    aiSuggestion: {
      label: '✨ AI Gemini 3.5 Flash-Lite đề xuất',
      source: 'Cập nhật vận đơn #TD-9102',
      text: 'Shop đã kịp thời cập nhật địa chỉ giao hàng của đơn #TD-9102 sang 125 Nguyễn Huệ, Quận 1 rồi bạn nhé. Đơn hàng sẽ được chuyển đến đúng địa chỉ mới của bạn.',
    },
    profile: {
      avatar: 'BP',
      name: 'Bích Phượng',
      since: 'Khách hàng từ T5/2026',
      tags: [{ label: 'Đổi địa chỉ', type: 'high' }],
      channel: 'Messenger',
      orderCount: '2 đơn',
      shippingArea: 'Quận 1, TP.HCM',
      totalSpent: '920.000đ',
      timeline: [
        { id: 'bp-t1', text: 'Yêu cầu đổi địa chỉ nhận hàng đơn #TD-9102', time: 'Hôm qua, 22:15' },
      ],
    },
  },

  // 13. Hải Nam - Hỏi bảo hành & đổi hàng lỗi
  {
    id: 'nam',
    name: 'Hải Nam',
    avatar: 'HN',
    channel: 'zalo',
    time: '11 giờ',
    preview: 'Hàng mua về bị lỗi đường chỉ hoặc rách thì chính sách đổi...',
    tags: [{ label: 'Hỏi bảo hành', type: 'loop' }],
    isUrgent: false,
    isUnreplied: true,
    threadWho: {
      name: 'Hải Nam',
      sub: 'Zalo OA · Tendly Official',
    },
    messages: [
      {
        id: 'hn2-1',
        sender: 'in',
        text: 'Hàng mua về nếu bị lỗi đường chỉ hoặc rách thì chính sách đổi trả bên shop trong bao nhiêu ngày vậy?',
        time: 'Hôm qua, 21:05',
      },
    ],
    aiSuggestion: {
      label: '✨ AI Gemini 3.5 Flash-Lite đề xuất',
      source: 'Chính sách bảo hành & đổi trả lỗi',
      text: 'Nếu sản phẩm có lỗi từ nhà sản xuất như rách hoặc lỗi chỉ, shop sẽ đổi mới 1-1 miễn phí tận nhà trong vòng 15 ngày bạn nhé. Toàn bộ chi phí vận chuyển phát sinh sẽ do shop chi trả hoàn toàn.',
    },
    profile: {
      avatar: 'HN',
      name: 'Hải Nam',
      since: 'Khách hàng từ T8/2025',
      tags: [{ label: 'Khách VIP', type: 'vip' }],
      channel: 'Zalo OA',
      orderCount: '5 đơn',
      shippingArea: 'Hải An, Hải Phòng',
      totalSpent: '2.400.000đ',
      timeline: [
        { id: 'hn2-t1', text: 'Hỏi chính sách đổi sản phẩm lỗi', time: 'Hôm qua, 21:05' },
      ],
    },
  },

  // 14. Yến Nhi - Hỏi mã giảm giá
  {
    id: 'nhi',
    name: 'Yến Nhi',
    avatar: 'YN',
    channel: 'facebook',
    time: '1 ngày',
    preview: 'Đơn hàng trên 500k có được áp dụng mã giảm giá 50k không ạ?',
    tags: [{ label: 'Săn voucher', type: 'loop' }],
    isUrgent: false,
    isUnreplied: false,
    threadWho: {
      name: 'Yến Nhi',
      sub: 'Messenger · Fanpage Tendly',
    },
    messages: [
      {
        id: 'yn1',
        sender: 'in',
        text: 'Đơn hàng trên 500k có được áp dụng mã giảm giá 50k của shop không ạ?',
        time: 'Hôm qua, 15:30',
      },
      {
        id: 'yn2',
        sender: 'out',
        text: 'Dạ đơn hàng từ 500.000đ được áp dụng mã TENDLY50 giảm trực tiếp 50.000đ bạn nhé. Bạn chỉ cần nhập mã tại bước thanh toán là được giảm ngay.',
        time: 'Hôm qua, 15:32',
        isAiReply: true,
        aiSource: 'Gemini Flash-Lite',
      },
    ],
    profile: {
      avatar: 'YN',
      name: 'Yến Nhi',
      since: 'Khách hàng từ T3/2026',
      tags: [{ label: 'Săn sale', type: 'loop' }],
      channel: 'Messenger',
      orderCount: '3 đơn',
      shippingArea: 'Ninh Kiều, Cần Thơ',
      totalSpent: '1.200.000đ',
      timeline: [
        { id: 'yn-t1', text: 'Áp dụng mã giảm giá 50k đơn #TD-8710', time: 'Hôm qua, 15:30' },
      ],
    },
  },
];

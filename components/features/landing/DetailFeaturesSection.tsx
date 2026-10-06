import React from 'react';
import { DETAIL_INBOX_ITEMS } from '@/lib/data/landing';

export function DetailFeaturesSection() {
  return (
    <section className="section" id="details" style={{ background: 'var(--sand)', overflow: 'hidden' }}>
      <div className="wrap">
        {/* Detail 1: Hộp thoại hợp nhất */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 64,
            alignItems: 'center',
            padding: '72px 0',
          }}
        >
          <div className="reveal-left">
            <div className="section-divider"></div>
            <h3
              style={{
                fontSize: 30,
                fontWeight: 800,
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
                marginBottom: 14,
              }}
            >
              Hộp thoại hợp nhất — chấm dứt mở 10 tab cùng lúc
            </h3>
            <p style={{ fontSize: 16, color: 'var(--ink-soft)', lineHeight: 1.7, marginBottom: 22 }}>
              Mọi tin nhắn từ Facebook, TikTok, Zalo đều chảy về một nơi. Bạn chỉ cần mở Tendly và trả lời — hệ thống tự gửi phản hồi về đúng kênh khách nhắn.
            </p>
            <ul style={{ listStyle: 'none' }}>
              {[
                'Hỗ trợ Facebook Page, TikTok Shop, Zalo OA',
                'Tự đồng bộ bình luận bài đăng + inbox',
                'Phân loại cảm xúc, xếp ưu tiên tự động',
                'Chuyển nhân viên khi phát hiện cảm xúc tiêu cực',
              ].map((li, i) => (
                <li
                  key={i}
                  style={{
                    padding: '9px 0',
                    fontSize: 15,
                    color: 'var(--ink-soft)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      flexShrink: 0,
                      background: '#FCE4E2',
                      color: 'var(--coral-deep)',
                    }}
                  >
                    ✓
                  </span>
                  {li}
                </li>
              ))}
            </ul>
          </div>

          <div
            className="reveal-right"
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--line)',
              borderRadius: 20,
              padding: 28,
              boxShadow: '0 16px 40px rgba(43,33,30,0.06)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 18,
                paddingBottom: 14,
                borderBottom: '1px solid var(--line)',
              }}
            >
              <h4 style={{ fontSize: 14, fontWeight: 700 }}>📬 Hộp thoại hợp nhất</h4>
              <div style={{ display: 'flex', gap: 6 }}>
                {['Tất cả', 'Facebook', 'TikTok', 'Zalo'].map((tab, i) => (
                  <span
                    key={i}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      background: i === 0 ? '#FCE4E2' : 'var(--sand)',
                      color: i === 0 ? 'var(--coral-deep)' : 'var(--ink-soft)',
                    }}
                  >
                    {tab}
                  </span>
                ))}
              </div>
            </div>
            {DETAIL_INBOX_ITEMS.map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 12,
                  padding: '12px 0',
                  borderBottom: i < DETAIL_INBOX_ITEMS.length - 1 ? '1px solid var(--line)' : 'none',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'white',
                    background: item.bg,
                  }}
                >
                  {item.initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>
                    {item.name} · <span style={{ color: 'var(--ink-soft)', fontWeight: 400 }}>{item.src}</span>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--ink-soft)',
                      marginTop: 2,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {item.preview}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{item.time}</div>
                  {item.badge && (
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: 'var(--coral)',
                        marginTop: 4,
                        marginLeft: 'auto',
                      }}
                    ></div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detail 2: Email cá nhân hoá */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 64,
            alignItems: 'center',
            padding: '72px 0',
            borderTop: '1px solid var(--line)',
          }}
        >
          <div className="reveal-left" style={{ order: 2 }}>
            <div className="section-divider"></div>
            <h3
              style={{
                fontSize: 30,
                fontWeight: 800,
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
                marginBottom: 14,
              }}
            >
              Email cá nhân hoá đúng ngữ cảnh bán hàng
            </h3>
            <p style={{ fontSize: 16, color: 'var(--ink-soft)', lineHeight: 1.7, marginBottom: 22 }}>
              Không gửi email spam đồng loạt. Tendly tự động soạn email dựa trên đúng lịch sử trò chuyện — nhắc lại sản phẩm khách vừa hỏi, tặng voucher xoa dịu khi khách gặp sự cố giao trễ.
            </p>
            <ul style={{ listStyle: 'none' }}>
              {[
                'Kịch bản: Khách hỏi nhưng chưa chốt đơn (gửi sau 24h)',
                'Kịch bản: Tự động gửi voucher xin lỗi khi khách bực',
                'Kịch bản: Nhắc giỏ hàng bỏ quên kèm ưu đãi',
                'Đo tỷ lệ phản hồi và tỷ lệ mở email chi tiết',
              ].map((li, i) => (
                <li
                  key={i}
                  style={{
                    padding: '9px 0',
                    fontSize: 15,
                    color: 'var(--ink-soft)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      flexShrink: 0,
                      background: 'var(--moss-soft)',
                      color: 'var(--moss)',
                    }}
                  >
                    ✓
                  </span>
                  {li}
                </li>
              ))}
            </ul>
          </div>

          <div
            className="reveal-right"
            style={{
              order: 1,
              background: 'var(--paper)',
              border: '1px solid var(--line)',
              borderRadius: 20,
              padding: 28,
              boxShadow: '0 16px 40px rgba(43,33,30,0.06)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 14,
                paddingBottom: 10,
                borderBottom: '1px solid var(--line)',
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700 }}>✉️ Tendly — Email soạn tự động</div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 6,
                  background: '#FCE4E2',
                  color: 'var(--coral-deep)',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--coral)' }}></div>
                AI generated
              </div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.8 }}>
              <p><strong>Chào Minh Anh,</strong></p>
              <p style={{ marginTop: 6 }}>
                Hôm qua bạn có hỏi shop về mẫu <em>áo khoác dạ AK-23 size M</em> trên Facebook mà chưa kịp chốt nè.
              </p>
              <div
                style={{
                  background: '#FFF5F5',
                  borderLeft: '3px solid var(--coral)',
                  padding: '8px 12px',
                  margin: '12px 0',
                  borderRadius: '0 8px 8px 0',
                }}
              >
                🎉 Size M màu be chỉ còn <strong>2 chiếc cuối</strong> thôi á! Shop gửi tặng riêng bạn mã <strong>MINHANH10</strong> giảm 10% trong 24h nha.
              </div>
              <p style={{ marginTop: 6 }}>
                Bạn cần giữ hàng thì nhắn lại shop giữ ngay nha! Chúc bạn ngày mới vui vẻ ✨
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button
                type="button"
                style={{
                  padding: '8px 18px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  background: 'var(--coral)',
                  color: 'white',
                }}
              >
                Gửi ngay cho khách
              </button>
              <button
                type="button"
                style={{
                  padding: '8px 18px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: 'var(--sand)',
                  color: 'var(--ink-soft)',
                  border: '1px solid var(--line)',
                }}
              >
                Chỉnh sửa nội dung
              </button>
            </div>
          </div>
        </div>

        {/* Detail 3: Báo cáo hiệu quả */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 64,
            alignItems: 'center',
            padding: '72px 0',
            borderTop: '1px solid var(--line)',
          }}
        >
          <div className="reveal-left">
            <div className="section-divider"></div>
            <h3
              style={{
                fontSize: 30,
                fontWeight: 800,
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
                marginBottom: 14,
              }}
            >
              Bảng điều khiển & Báo cáo hiệu quả
            </h3>
            <p style={{ fontSize: 16, color: 'var(--ink-soft)', lineHeight: 1.7, marginBottom: 22 }}>
              Biết chính xác AI đang hoạt động ra sao: có bao nhiêu khách hàng được xử lý, tỷ lệ phản hồi sau email marketing, và các ca khiếu nại đã được xoa dịu thành công.
            </p>
            <ul style={{ listStyle: 'none' }}>
              {[
                'Stat cards: Hội thoại đang chờ & Cần xử lý gấp',
                'Đo lường đơn ước tính từ tín hiệu hội thoại',
                'Biểu đồ tỷ lệ phản hồi sau email theo ngày',
                'Danh sách sản phẩm được khách hỏi nhiều nhất',
              ].map((li, i) => (
                <li
                  key={i}
                  style={{
                    padding: '9px 0',
                    fontSize: 15,
                    color: 'var(--ink-soft)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      flexShrink: 0,
                      background: 'var(--sand)',
                      color: 'var(--ink)',
                    }}
                  >
                    ✓
                  </span>
                  {li}
                </li>
              ))}
            </ul>
          </div>

          <div
            className="reveal-right"
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--line)',
              borderRadius: 20,
              padding: 28,
              boxShadow: '0 16px 40px rgba(43,33,30,0.06)',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Hội thoại đang chờ', value: '12', sub: '3 ca cần xử lý gấp', color: 'var(--coral-deep)' },
                { label: 'Cần xử lý gấp (cảm xúc âm)', value: '3', sub: 'AI đã gửi voucher xin lỗi', color: 'var(--coral)', subColor: 'var(--moss)' },
                { label: 'Email tự động hôm nay', value: '38', sub: 'Tỷ lệ mở 68%', color: 'var(--ink)', subColor: 'var(--moss)' },
                { label: 'Đơn ước tính qua chat', value: '24', sub: '*ước tính từ tín hiệu chat', color: 'var(--coral-deep)' },
              ].map((card, i) => (
                <div key={i} style={{ background: 'var(--sand)', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{card.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: card.color, marginTop: 2 }}>{card.value}</div>
                  <div style={{ fontSize: 10.5, color: card.subColor || 'var(--ink-soft)', marginTop: 2 }}>{card.sub}</div>
                </div>
              ))}
            </div>
            <div style={{ background: 'var(--sand)', borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
                📈 Tỷ lệ phản hồi sau email (7 ngày gần nhất)
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 60 }}>
                {[35, 50, 40, 65, 55, 80, 90].map((h, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      background: i === 6 ? 'var(--coral-deep)' : 'var(--coral)',
                      borderRadius: '4px 4px 0 0',
                      height: `${h}%`,
                      opacity: i === 6 ? 1 : 0.6 + i * 0.05,
                    }}
                  ></div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 10,
                      color: 'var(--ink-soft)',
                      fontWeight: i === 6 ? 700 : 400,
                    }}
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

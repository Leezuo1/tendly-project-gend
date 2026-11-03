'use client';

import { useState } from 'react';
import styles from './landing.module.css';

// Bảng size mẫu của shop (cm / kg), cùng số liệu với phần minh họa cũ.
const SIZES = [
  { size: 'M', h: [160, 167], w: [55, 64] },
  { size: 'L', h: [168, 175], w: [65, 70] },
  { size: 'XL', h: [176, 182], w: [71, 80] },
] as const;

const fmt = (h: number) => `1m${String(h - 100).padStart(2, '0')}`;

function recommend(h: number, w: number) {
  const hi = SIZES.findIndex(s => h >= s.h[0] && h <= s.h[1]);
  const wi = SIZES.findIndex(s => w >= s.w[0] && w <= s.w[1]);
  if (hi < 0 || wi < 0) return null;
  return { row: SIZES[Math.max(hi, wi)], between: hi !== wi };
}

export function SizeDesk() {
  const [h, setH] = useState(172);
  const [w, setW] = useState(68);
  const [approved, setApproved] = useState(false);
  const rec = recommend(h, w);
  const change = (set: (n: number) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    set(Number(e.target.value));
    setApproved(false);
  };

  return (
    <>
      <div className={styles.controls}>
        <label htmlFor="try-h"><span>Chiều cao</span><output htmlFor="try-h">{fmt(h)}</output></label>
        <input id="try-h" type="range" min={150} max={190} value={h} onChange={change(setH)} />
        <label htmlFor="try-w"><span>Cân nặng</span><output htmlFor="try-w">{w}kg</output></label>
        <input id="try-w" type="range" min={45} max={95} value={w} onChange={change(setW)} />
      </div>

      <div className={styles.desk} data-ui>
        <p className={styles.deskFrom}>Lan Anh · Fanpage Thời trang Mộc</p>
        <p className={styles.bubble}>Áo polo này có size L không ạ? Mình cao {fmt(h)}, nặng {w}kg thì mặc size nào vừa?</p>

        <div className={styles.draft} aria-live="polite" data-state={!rec ? 'handoff' : approved ? 'approved' : 'ready'}>
          <div className={styles.draftTop}>
            <strong>{rec ? 'Nháp từ Tendly' : 'Tendly giữ lại'}</strong>
            <span className={styles.chip} data-final={approved && !!rec}>{!rec ? 'Chuyển cho shop' : approved ? 'Đã duyệt' : 'Chờ shop duyệt'}</span>
          </div>
          {rec ? (
            <p>
              Dạ với {fmt(h)} và {w}kg, bạn có thể tham khảo <b>size {rec.row.size}</b> ạ.
              {rec.between ? ' Số đo nằm giữa hai size nên shop sẽ tư vấn thêm.' : ''} Shop sẽ kiểm tra màu bạn chọn trước khi xác nhận nhé.
            </p>
          ) : (
            <p>Số đo {fmt(h)} · {w}kg nằm ngoài bảng size của shop. Tendly không tự trả lời: câu hỏi này giữ lại cho shop xử lý.</p>
          )}
          <p className={styles.draftSrc}>{rec ? 'Nguồn: bảng size trong Sản phẩm & FAQ của shop' : 'Thiếu căn cứ trong dữ liệu của shop'}</p>
          {rec && (
            <button type="button" className={styles.approve} disabled={approved} onClick={() => setApproved(true)}>
              {approved ? 'Đã duyệt · sẵn sàng gửi cho Lan Anh' : 'Duyệt & chuẩn bị gửi'}
            </button>
          )}
        </div>

        <table className={styles.sizeTable}>
          <caption>Bảng size của shop</caption>
          <thead><tr><th scope="col">Size</th><th scope="col">Chiều cao</th><th scope="col">Cân nặng</th></tr></thead>
          <tbody>
            {SIZES.map(s => (
              <tr key={s.size} data-on={rec?.row.size === s.size}>
                <th scope="row">{s.size}</th><td>{fmt(s.h[0])}–{fmt(s.h[1])}</td><td>{s.w[0]}–{s.w[1]}kg</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

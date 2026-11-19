'use client';

import { useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/ui/Modal';
import { errorMessage, useToast } from '@/components/shared/ToastProvider';
import styles from './product-editor.module.css';

const MAX_PHOTOS = 3;
const MAX_BYTES = 4 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Ảnh gửi cho khách khi AI hoặc nhân viên cần minh họa. Tải lên/xóa có hiệu lực ngay, không đi theo nút Lưu của form. */
export function ProductImages({ productId }: { productId: string }) {
  const [ids, setIds] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const query = `?productId=${encodeURIComponent(productId)}`;
  useEffect(() => {
    let alive = true;
    fetch(`/api/product-images${query}`)
      .then(async (response) => { if (!response.ok) throw new Error(); return (await response.json()).images as { id: string }[]; })
      .then((images) => { if (alive) setIds(images.map((image) => image.id)); })
      .catch(() => { if (alive) setIds(null); }); // Chưa có database hoặc chưa chạy migration: ẩn mục này.
    return () => { alive = false; };
  }, [query]);
  if (ids === null) return null;

  async function upload(file: File | undefined) {
    if (!file) return;
    if (!TYPES.includes(file.type)) { toast('Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.', 'error'); return; }
    if (file.size > MAX_BYTES) { toast('Ảnh lớn quá 4MB, chọn ảnh nhỏ hơn nhé.', 'error'); return; }
    setBusy(true);
    try {
      const response = await fetch(`/api/product-images${query}`, { method: 'PUT', body: file });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Chưa tải được ảnh.');
      setIds((current) => [...(current ?? []), result.id as string]);
    } catch (cause) { toast(errorMessage(cause), 'error'); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/product-images/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!response.ok && response.status !== 404) throw new Error((await response.json()).error || 'Chưa xóa được ảnh.');
      setIds((current) => (current ?? []).filter((item) => item !== id));
    } catch (cause) { toast(errorMessage(cause), 'error'); }
    finally { setBusy(false); setRemoving(null); }
  }

  return <div className={styles.shopPhotos}>
    <h4>Ảnh sản phẩm</h4>
    <p className="field-hint">Tối đa {MAX_PHOTOS} ảnh (JPG, PNG, WEBP, mỗi ảnh ≤ 4 MB). AI và nhân viên gửi ảnh này cho khách khi cần minh họa sản phẩm.</p>
    <div className={styles.shopPhotoRow}>
      {ids.map((id) => <figure key={id} className={styles.shopPhoto}>
        <img src={`/api/product-images/${encodeURIComponent(id)}`} alt="Ảnh sản phẩm đã tải lên" />
        <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => setRemoving(id)}>Xóa</button>
      </figure>)}
      {ids.length < MAX_PHOTOS && <>
        <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? 'Đang tải…' : 'Chọn ảnh từ máy'}</button>
        <input ref={fileRef} type="file" accept={TYPES.join(',')} hidden
          onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; void upload(file); }} />
      </>}
    </div>
    <ConfirmDialog open={removing !== null} title="Xóa ảnh này?" message="Ảnh sẽ không còn được gửi cho khách nữa." confirmLabel="Xóa ảnh" busy={busy}
      onClose={() => setRemoving(null)} onConfirm={() => { if (removing) void remove(removing); }} />
  </div>;
}

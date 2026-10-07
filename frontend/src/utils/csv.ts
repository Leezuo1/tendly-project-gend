import type { Product } from '../types';
import { normalize } from './format';

/** Parse CSV đơn giản, hỗ trợ giá trị trong dấu "..." và dấu phẩy/chấm phẩy */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

export const CSV_TEMPLATE =
  'sku,ten_san_pham,chat_lieu,danh_muc,mau_sac,size,so_luong,gia\n' +
  'AT-20,Áo thun ringer viền cổ,Cotton 100%,Áo thun,Trắng|Đen,S|M|L,50,219000\n' +
  'PK-20,Kẹp tóc càng cua,Nhựa acetate,Phụ kiện,Nâu|Đen,One size,200,59000\n';

const EMOJI_BY_CATEGORY: [string, string][] = [
  ['ao khoac', '🧥'], ['so mi', '👔'], ['ao', '👕'], ['dam', '👗'], ['vay', '👚'],
  ['jean', '👖'], ['quan', '👖'], ['tui', '👜'], ['mu', '🧢'], ['phu kien', '👜'],
];

const HEADER_ALIASES: Record<string, keyof Omit<Product, 'id' | 'emoji'>> = {
  sku: 'sku', ma: 'sku', ma_sp: 'sku',
  ten_san_pham: 'name', ten: 'name', name: 'name',
  chat_lieu: 'material', material: 'material',
  danh_muc: 'category', phan_loai: 'category', category: 'category',
  mau_sac: 'colors', mau: 'colors', colors: 'colors',
  size: 'sizes', sizes: 'sizes', kich_thuoc: 'sizes',
  so_luong: 'qty', ton_kho: 'qty', qty: 'qty',
  gia: 'price', price: 'price',
};

export interface CsvResult { rows: Omit<Product, 'id'>[]; skipped: number }

export function csvToProducts(text: string): CsvResult {
  const [header, ...lines] = parseCsv(text);
  if (!header) throw new Error('File CSV trống');
  const columns = header.map((h) => HEADER_ALIASES[normalize(h).replace(/\s+/g, '_')]);
  if (!columns.includes('sku') || !columns.includes('name')) {
    throw new Error('File cần có cột "sku" và "ten_san_pham" — tải file mẫu để xem định dạng');
  }

  let skipped = 0;
  const rows: Omit<Product, 'id'>[] = [];
  for (const line of lines) {
    const rec: Record<string, string> = {};
    columns.forEach((col, i) => { if (col) rec[col] = (line[i] ?? '').trim(); });
    const qty = Number((rec.qty ?? '0').replace(/[^\d]/g, ''));
    const price = Number((rec.price ?? '0').replace(/[^\d]/g, ''));
    if (!rec.sku || !rec.name) { skipped++; continue; }
    const category = rec.category || 'Khác';
    const normCat = normalize(category);
    rows.push({
      sku: rec.sku.toUpperCase(),
      name: rec.name,
      material: rec.material || '—',
      category,
      colors: (rec.colors || '').split('|').map((s) => s.trim()).filter(Boolean),
      sizes: (rec.sizes || 'One size').split('|').map((s) => s.trim()).filter(Boolean),
      qty: Number.isFinite(qty) ? qty : 0,
      price: Number.isFinite(price) ? price : 0,
      emoji: EMOJI_BY_CATEGORY.find(([k]) => normCat.includes(k))?.[1] ?? '📦',
    });
  }
  return { rows, skipped };
}

export function downloadText(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿' + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

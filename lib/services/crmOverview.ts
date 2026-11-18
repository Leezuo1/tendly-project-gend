import type { Pool } from 'pg';
import { getMessengerPool } from '@/lib/services/messengerPostgres';
import type { CrmCustomer, CrmOrder, CrmOrderStatus, CrmOverview } from '@/lib/types/crm';

const DAY = 86_400_000;
const ROWS = 500;
export const CRM_RANGES = [7, 30, 90] as const;
/** Ngày theo giờ Việt Nam, dạng YYYY-MM-DD. */
const vnDay = (ms: number) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
const json = (value: unknown) => typeof value === 'string' ? JSON.parse(value) : value;
const items = (value: unknown) => (Array.isArray(json(value)) ? json(value) as Record<string, unknown>[] : []).slice(0, 30).map(item => ({
  name: String(item?.name ?? '').slice(0, 120) || 'Sản phẩm', qty: Math.max(1, Number(item?.qty) || 1),
  price: Number.isFinite(Number(item?.price)) && Number(item?.price) >= 0 ? Number(item?.price) : null,
  variant: [item?.color, item?.size].filter(part => typeof part === 'string' && part).join(' / '),
}));

/** Tổng quan đơn hàng và khách hàng của Fanpage: đơn từ chat Messenger và từ livestream, khách từ Messenger. Chỉ đọc, không có thông tin liên hệ. */
export async function readCrmOverview(pageId: string, rangeDays: number, db: Pick<Pool, 'query'> = getMessengerPool(), now = Date.now()): Promise<CrmOverview> {
  const range = (CRM_RANGES as readonly number[]).includes(rangeDays) ? rangeDays : 30;
  const [chatOrders, liveOrders, people] = await Promise.all([
    db.query(`SELECT o.id,o.psid,o.items_json,o.total,o.status,o.is_mock,o.created_at,u.display_name
      FROM messenger_orders o LEFT JOIN messenger_customers u ON u.page_id=o.page_id AND u.psid=o.psid
      WHERE o.page_id=$1 ORDER BY o.created_at DESC LIMIT ${ROWS}`, [pageId]),
    db.query(`SELECT o.id,o.customer_id,o.customer_name,o.items_json,o.status,o.created_at,s.title
      FROM live_orders o JOIN live_sessions s ON s.id=o.session_id
      WHERE s.page_id=$1 ORDER BY o.created_at DESC LIMIT ${ROWS}`, [pageId]),
    db.query(`SELECT u.psid,u.display_name,u.avatar_url,u.created_at,c.last_message_at,c.last_in_at
      FROM messenger_customers u LEFT JOIN messenger_conversations c ON c.customer_id=u.id
      WHERE u.page_id=$1 ORDER BY COALESCE(c.last_message_at,u.created_at) DESC LIMIT ${ROWS}`, [pageId]),
  ]);
  const orders: CrmOrder[] = [
    ...chatOrders.rows.map(row => {
      const list = items(row.items_json);
      return { id: String(row.id), source: 'messenger' as const, customerKey: `m:${row.psid}`, customerName: String(row.display_name || '') || 'Khách Messenger',
        items: list, total: Number(row.total) || 0, status: row.status as CrmOrderStatus, isMock: !!row.is_mock, createdAt: Number(row.created_at), note: '' };
    }),
    ...liveOrders.rows.map(row => {
      const list = items(row.items_json);
      return { id: String(row.id), source: 'livestream' as const, customerKey: `l:${row.customer_id}`, customerName: String(row.customer_name || '') || 'Khách livestream',
        items: list, total: list.reduce((sum, item) => sum + (item.price ?? 0) * item.qty, 0), status: row.status as CrmOrderStatus, isMock: false,
        createdAt: Number(row.created_at), note: String(row.title || '').slice(0, 120) };
    }),
  ].sort((a, b) => b.createdAt - a.createdAt);

  const from = now - range * DAY, prevFrom = from - range * DAY;
  const inRange = orders.filter(order => order.createdAt >= from);
  const previous = orders.filter(order => order.createdAt >= prevFrom && order.createdAt < from);
  const confirmed = (list: CrmOrder[]) => list.filter(order => order.status === 'confirmed');
  const revenue = (list: CrmOrder[]) => confirmed(list).reduce((sum, order) => sum + order.total, 0);
  const days = Array.from({ length: range }, (_, i) => vnDay(now - (range - 1 - i) * DAY));
  const daily = days.map(day => {
    const list = inRange.filter(order => vnDay(order.createdAt) === day);
    return { day, orders: list.length, confirmed: confirmed(list).length, revenue: revenue(list) };
  });
  const products = new Map<string, { name: string; qty: number; orders: number }>();
  for (const order of confirmed(inRange)) for (const item of order.items) {
    const entry = products.get(item.name) ?? { name: item.name, qty: 0, orders: 0 };
    entry.qty += item.qty; entry.orders++; products.set(item.name, entry);
  }

  // Khách: hồ sơ Messenger + người đặt qua livestream (không trùng được vì là hai hệ ID khác nhau của Meta).
  const byCustomer = new Map<string, CrmOrder[]>();
  for (const order of orders) byCustomer.set(order.customerKey, [...byCustomer.get(order.customerKey) ?? [], order]);
  const customers: CrmCustomer[] = people.rows.map(row => ({ key: `m:${row.psid}`, name: String(row.display_name || '') || 'Khách Messenger', avatarUrl: typeof row.avatar_url === 'string' && /^https:\/\//.test(row.avatar_url) ? row.avatar_url : '',
    channel: 'messenger' as const, firstSeenAt: Number(row.created_at), lastActiveAt: Number(row.last_message_at ?? row.created_at) }));
  for (const order of orders) if (order.source === 'livestream' && !customers.some(customer => customer.key === order.customerKey)) {
    const list = byCustomer.get(order.customerKey)!;
    customers.push({ key: order.customerKey, name: order.customerName, avatarUrl: '', channel: 'livestream', firstSeenAt: Math.min(...list.map(item => item.createdAt)), lastActiveAt: Math.max(...list.map(item => item.createdAt)) });
  }
  const enriched = customers.map(customer => {
    const list = byCustomer.get(customer.key) ?? [], done = confirmed(list);
    const segment: CrmCustomer['segment'] = done.length >= 2 ? 'repeat' : done.length === 1 ? 'buyer' : list.length ? 'pending' : 'lead';
    return { ...customer, orders: list.length, confirmedOrders: done.length, spent: revenue(list), lastOrderAt: list[0]?.createdAt ?? null, segment };
  }).sort((a, b) => b.lastActiveAt - a.lastActiveAt);
  const active = enriched.filter(customer => customer.lastActiveAt >= from);
  const buyersInRange = new Set(confirmed(inRange).map(order => order.customerKey));

  return {
    range, generatedAt: now,
    orders: {
      kpi: { total: inRange.length, confirmed: confirmed(inRange).length, pending: inRange.filter(order => order.status === 'draft' || order.status === 'awaiting_info').length,
        cancelled: inRange.filter(order => order.status === 'cancelled').length, revenue: revenue(inRange), previousRevenue: revenue(previous),
        previousTotal: previous.length, avgOrder: confirmed(inRange).length ? Math.round(revenue(inRange) / confirmed(inRange).length) : 0,
        mock: inRange.filter(order => order.isMock).length },
      daily, bySource: { messenger: inRange.filter(order => order.source === 'messenger').length, livestream: inRange.filter(order => order.source === 'livestream').length },
      topProducts: [...products.values()].sort((a, b) => b.qty - a.qty).slice(0, 5),
      list: orders.slice(0, 200),
    },
    customers: {
      kpi: { total: enriched.length, active: active.length, newInRange: enriched.filter(customer => customer.firstSeenAt >= from).length,
        buyers: buyersInRange.size, repeat: enriched.filter(customer => customer.segment === 'repeat').length,
        conversion: active.length ? Math.round(100 * active.filter(customer => buyersInRange.has(customer.key)).length / active.length) : 0 },
      list: enriched.slice(0, 200),
    },
  };
}

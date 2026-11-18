// ============================================================
// DOMAIN TYPES — Tổng quan đơn hàng & khách hàng
// ============================================================

export type CrmOrderStatus = 'draft' | 'awaiting_info' | 'confirmed' | 'cancelled';
export interface CrmOrderItem { name: string; qty: number; price: number | null; variant: string }
export interface CrmOrder {
  id: string; source: 'messenger' | 'livestream'; customerKey: string; customerName: string;
  items: CrmOrderItem[]; total: number; status: CrmOrderStatus; isMock: boolean; createdAt: number;
  /** Livestream: tên phiên live. */
  note: string;
}
export interface CrmCustomer {
  key: string; name: string; avatarUrl: string; channel: 'messenger' | 'livestream';
  firstSeenAt: number; lastActiveAt: number;
  orders?: number; confirmedOrders?: number; spent?: number; lastOrderAt?: number | null;
  /** lead = mới nhắn, chưa có đơn; pending = có đơn chưa chốt; buyer = 1 đơn chốt; repeat = từ 2 đơn chốt. */
  segment?: 'lead' | 'pending' | 'buyer' | 'repeat';
}
export interface CrmOverview {
  range: number; generatedAt: number;
  orders: {
    kpi: { total: number; confirmed: number; pending: number; cancelled: number; revenue: number; previousRevenue: number; previousTotal: number; avgOrder: number; mock: number };
    daily: { day: string; orders: number; confirmed: number; revenue: number }[];
    bySource: { messenger: number; livestream: number };
    topProducts: { name: string; qty: number; orders: number }[];
    list: CrmOrder[];
  };
  customers: {
    kpi: { total: number; active: number; newInRange: number; buyers: number; repeat: number; conversion: number };
    list: Required<CrmCustomer>[];
  };
}

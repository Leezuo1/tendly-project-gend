/** Một khách Messenger như hệ thống CRM của doanh nghiệp nhận được. `id` là psid. */
export interface CrmCustomerRecord {
  id: string;
  channel: 'messenger';
  name: string | null;
  needs: string;
  needsUpdatedAt: number | null;
  createdAt: number;
  lastMessageAt: number | null;
  orders: { confirmedCount: number; confirmedTotalVnd: number; lastConfirmedAt: number | null; includesMock: boolean };
}

export interface CrmCustomerPage {
  customers: CrmCustomerRecord[];
  nextCursor: string | null;
}

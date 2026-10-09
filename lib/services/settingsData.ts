'use client';

import { createSeed } from '@/lib/data/admin';
import { readDb, writeDb } from '@/lib/services/mockDb';
import type { Member, Shop } from '@/lib/types/admin';
import { isEmail, isPhone, uid } from '@/lib/utils/format';

export function savedShopInfo(): Shop {
  const db = readDb();
  const shop = db.shop;
  if (db.settingsShopSaved) return { ...shop };
  const seed = createSeed().shop;
  return { ...shop, name: shop.name === seed.name ? '' : shop.name,
    email: shop.email === seed.email ? '' : shop.email,
    phone: shop.phone === seed.phone ? '' : shop.phone };
}

export const settingsShopApi = {
  get: async () => structuredClone(savedShopInfo()),
  async update(patch: Partial<Shop>): Promise<Shop> {
    const shop = { ...savedShopInfo(), ...patch };
    shop.name = shop.name.trim(); shop.email = shop.email.trim(); shop.phone = shop.phone.trim();
    if (shop.ownerName !== undefined) shop.ownerName = shop.ownerName.trim();
    if (shop.email && !isEmail(shop.email)) throw new Error('Email liên hệ không hợp lệ');
    if (shop.phone && !isPhone(shop.phone)) throw new Error('Số điện thoại không hợp lệ');
    writeDb((db) => { db.shop = shop; db.settingsShopSaved = true; });
    return structuredClone(shop);
  },
};

export function savedMembers(): Member[] {
  if (readDb().settingsMembersSaved) return structuredClone(readDb().members);
  const seed = createSeed().members;
  return readDb().members.filter((member) => !seed.some((demo) => demo.id === member.id
    && demo.name === member.name && demo.email === member.email));
}

export function saveMember(input: { id?: string; name: string; email: string; role: Member['role'] }): Member {
  const members = savedMembers();
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) throw new Error('Vui lòng nhập tên nhân viên');
  if (!isEmail(email)) throw new Error('Email không hợp lệ');
  if (input.role !== 'owner' && input.role !== 'staff') throw new Error('Vai trò không hợp lệ');
  if (members.some((m) => m.id !== input.id && m.email.toLowerCase() === email)) throw new Error('Email đã có trong danh sách');
  const previous = members.find((m) => m.id === input.id);
  if (input.id && !previous) throw new Error('Không tìm thấy nhân viên');
  if (previous?.role === 'owner' && input.role !== 'owner' && members.filter((m) => m.role === 'owner').length === 1) {
    throw new Error('Không thể đổi vai trò chủ shop duy nhất');
  }
  const member: Member = { id: previous?.id || uid('member'), name, email, role: input.role, status: previous?.status || 'active' };
  const next = previous ? members.map((m) => m.id === member.id ? member : m) : [...members, member];
  writeDb((db) => { db.members = next; db.settingsMembersSaved = true; });
  return member;
}

export function deleteMember(id: string): void {
  const members = savedMembers();
  const target = members.find((m) => m.id === id);
  if (!target) throw new Error('Không tìm thấy nhân viên');
  if (target.role === 'owner' && members.filter((m) => m.role === 'owner').length === 1) {
    throw new Error('Không thể xóa chủ shop duy nhất');
  }
  writeDb((db) => { db.members = members.filter((m) => m.id !== id); db.settingsMembersSaved = true; });
}

export const messengerSyncEnabled = () => readDb().settingsMessengerEnabled !== false;
export function setMessengerSyncEnabled(enabled: boolean): void {
  writeDb((db) => { db.settingsMessengerEnabled = enabled; });
}

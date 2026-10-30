import type { Metadata } from 'next';
import { AdminShell } from '@/components/features/admin/AdminShell';
import { SmartSourcing } from '@/components/features/sourcing/SmartSourcing';
import '@/components/features/admin/admin-shell.css';

export const metadata: Metadata = {
  title: 'Smart Sourcing — Tendly',
  description: 'Khám phá luồng social listening và tìm nguồn hàng theo ngành của shop.',
};

export default function SmartSourcingPage() {
  return <AdminShell currentPath="smart-sourcing"><SmartSourcing /></AdminShell>;
}

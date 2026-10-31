'use client';

import React, { type ReactNode } from 'react';
import { Sidebar, type SidebarProps } from '@/components/features/dashboard/Sidebar';
import { ShopProvider } from '@/components/shared/ShopProvider';
import { ToastProvider, useToast } from '@/components/shared/ToastProvider';
import { MobileSections } from '@/components/ui/MobileSections';

type AdminPath = NonNullable<SidebarProps['currentPath']>;

function ShellLayout({ currentPath, children }: { currentPath: AdminPath; children: ReactNode }) {
  const toast = useToast();
  const singleSection = currentPath === 'quan-tri' ? { title: 'Quản trị bảo mật', label: 'Cài đặt bảo mật' } : null;
  return (
    <div className="shell">
      <Sidebar currentPath={currentPath} onToast={(msg) => toast(msg, 'info')} />
      <main className="main">{singleSection ? <MobileSections title={singleSection.title} menuHeading items={[{ key: currentPath, label: singleSection.label, content: children }]}>{children}</MobileSections> : children}</main>
    </div>
  );
}

/** Khung chung cho các trang quản trị dùng mock API (Cấu hình AI, Cài đặt) */
export function AdminShell({ currentPath, children }: { currentPath: AdminPath; children: ReactNode }) {
  return (
    <div className="admin-root">
      <ToastProvider>
        <ShopProvider>
          <ShellLayout currentPath={currentPath}>{children}</ShellLayout>
        </ShopProvider>
      </ToastProvider>
    </div>
  );
}

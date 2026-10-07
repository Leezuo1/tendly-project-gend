'use client';

import React, { type ReactNode } from 'react';
import { Sidebar } from '@/components/features/dashboard/Sidebar';
import { ShopProvider } from '@/components/shared/ShopProvider';
import { ToastProvider, useToast } from '@/components/shared/ToastProvider';

type AdminPath = 'cau-hinh-ai' | 'cai-dat';

function ShellLayout({ currentPath, children }: { currentPath: AdminPath; children: ReactNode }) {
  const toast = useToast();
  return (
    <div className="shell">
      <Sidebar currentPath={currentPath} onToast={(msg) => toast(msg, 'info')} showCustomerPreviews />
      <main className="main">{children}</main>
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

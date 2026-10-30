'use client';
import { createContext, useContext } from 'react';
import type { AppSession } from '@/lib/types/security';

export const lockedSession: AppSession = { authenticated: false, role: null, username: '', protectionEnabled: true,
  canUse: false, revision: 0, updatedAt: 0, updatedBy: '' };
export const AppSecurityContext = createContext({ session: lockedSession, loading: true,
  refresh: async (): Promise<AppSession> => lockedSession, logout: async () => {} });
export function useAppSecurity() { return useContext(AppSecurityContext); }

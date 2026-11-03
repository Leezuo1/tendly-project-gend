export interface AppSession {
  authenticated: boolean;
  role: 'admin' | 'user' | null;
  username: string;
  userId: string | null;
  name: string;
  pageId: string | null;
  needsSetup: boolean;
  protectionEnabled: boolean;
  canUse: boolean;
  revision: number;
  updatedAt: number;
  updatedBy: string;
  error?: string;
}

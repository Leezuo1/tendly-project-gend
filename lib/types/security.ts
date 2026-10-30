export interface AppSession {
  authenticated: boolean;
  role: 'admin' | 'user' | null;
  username: string;
  protectionEnabled: boolean;
  canUse: boolean;
  revision: number;
  updatedAt: number;
  updatedBy: string;
  error?: string;
}

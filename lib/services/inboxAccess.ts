import { legacyAccessError } from '@/lib/services/appSecurity';

export function inboxAccessError(request: Request): Response | undefined {
  return legacyAccessError(request);
}

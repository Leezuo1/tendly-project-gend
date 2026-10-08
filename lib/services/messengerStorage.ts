import type { MessengerMessage } from '@/lib/types/messenger';

export function requireMessengerDatabase(): void {
  if (!process.env.DATABASE_URL?.trim()) throw new Error('Messenger requires DATABASE_URL');
}

export async function persistMessengerMessages(messages: MessengerMessage[]) {
  requireMessengerDatabase();
  const { savePostgresMessages } = await import('@/lib/services/messengerPostgres');
  return savePostgresMessages(messages);
}

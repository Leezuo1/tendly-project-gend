import { createHmac, timingSafeEqual } from 'node:crypto';
import type { MessengerMessage } from '@/lib/types/messenger';

export class InvalidWebhook extends Error {}

export function verifyMetaSignature(raw: Uint8Array, signature: string | null, secret: string): boolean {
  if (!signature || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(raw).digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex'));
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;
}
const id = (value: unknown): value is string => typeof value === 'string' && /^\d{1,64}$/.test(value);

/** Ignore unrelated events/pages; reject malformed message events before writing any data. */
export function parseMetaMessages(payload: unknown, pageId: string): MessengerMessage[] {
  const body = record(payload);
  if (body?.object !== 'page' || !Array.isArray(body.entry)) throw new InvalidWebhook('Invalid Page payload');
  const messages: MessengerMessage[] = [];
  for (const value of body.entry) {
    const entry = record(value);
    if (entry?.id !== pageId) continue;
    if (entry.messaging === undefined) continue;
    if (!Array.isArray(entry.messaging)) throw new InvalidWebhook('Invalid messaging events');
    for (const value of entry.messaging) {
      const event = record(value);
      if (!event || event.message === undefined) continue;
      const message = record(event.message);
      const sender = record(event.sender)?.id;
      const recipient = record(event.recipient)?.id;
      const timestamp = event.timestamp;
      if (!message || !id(sender) || !id(recipient) || typeof timestamp !== 'number' ||
          !Number.isSafeInteger(timestamp) || timestamp < 0 || timestamp > 8_640_000_000_000_000 ||
          typeof message.mid !== 'string' || !message.mid.trim() || message.mid.length > 1024 ||
          (message.is_echo !== undefined && typeof message.is_echo !== 'boolean') ||
          (message.text !== undefined && (typeof message.text !== 'string' || message.text.length > 100_000)) ||
          (message.attachments !== undefined && !Array.isArray(message.attachments))) {
        throw new InvalidWebhook('Invalid message');
      }
      const outgoing = message.is_echo === true;
      if ((outgoing ? sender : recipient) !== pageId) continue;
      const attachments = (message.attachments ?? []) as unknown[];
      messages.push({
        pageId, psid: outgoing ? recipient : sender, messageId: message.mid,
        direction: outgoing ? 'out' : 'in', timestamp, text: typeof message.text === 'string' ? message.text : '',
        attachments: attachments.flatMap((value) => {
          const attachment = record(value);
          if (typeof attachment?.type !== 'string') return [];
          const url = record(attachment.payload)?.url;
          return [{ type: attachment.type, ...(typeof url === 'string' ? { url } : {}) }];
        }),
      });
    }
  }
  return messages;
}

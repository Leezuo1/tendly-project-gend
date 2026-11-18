export interface MessengerAttachment {
  type: string;
  url?: string;
  /** Sticker hoặc nút Like (Meta gửi như ảnh kèm sticker_id). */
  sticker?: boolean;
}

export interface MessengerMessage {
  replyToMessageId?: string;
  pageId: string;
  psid: string;
  messageId: string;
  direction: 'in' | 'out';
  timestamp: number;
  text: string;
  attachments: MessengerAttachment[];
}

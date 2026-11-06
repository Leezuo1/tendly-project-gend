export interface MessengerAttachment {
  type: string;
  url?: string;
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

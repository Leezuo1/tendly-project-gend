export interface MessengerAttachment {
  type: string;
  url?: string;
}

export interface MessengerMessage {
  pageId: string;
  psid: string;
  messageId: string;
  direction: 'in' | 'out';
  timestamp: number;
  text: string;
  attachments: MessengerAttachment[];
}

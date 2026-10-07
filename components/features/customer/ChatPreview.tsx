'use client';

import { useState } from 'react';
import { ChatWidget } from './ChatWidget';
import { CustomerPreview } from './CustomerPreview';
import { chatSeed } from './seeds';

export function ChatPreview() {
  const [session, setSession] = useState(0);

  return (
    <CustomerPreview
      note="Xem trước: khung chat trên website / Fanpage — góc nhìn của khách hàng. Thử nhắn hỏi sản phẩm, phí ship, hoặc phàn nàn để xem AI chuyển tiếp."
      onReset={() => setSession((s) => s + 1)}
      resetLabel="Làm mới hội thoại"
    >
      <ChatWidget key={session} seed={chatSeed()} />
    </CustomerPreview>
  );
}

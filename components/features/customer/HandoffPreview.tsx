'use client';

import { useState } from 'react';
import { ChatWidget } from './ChatWidget';
import { CustomerPreview } from './CustomerPreview';
import { handoffSeed } from './seeds';

export function HandoffPreview() {
  const [session, setSession] = useState(0);

  return (
    <CustomerPreview
      note="Xem trước UA3: chuyển tiếp sang nhân viên thật khi câu hỏi phức tạp/bức xúc — góc nhìn của khách hàng"
      onReset={() => setSession((s) => s + 1)}
      resetLabel="Làm mới hội thoại"
    >
      <ChatWidget key={session} seed={handoffSeed()} />
    </CustomerPreview>
  );
}

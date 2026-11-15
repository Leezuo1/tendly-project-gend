'use client';

import { readDb } from '@/lib/services/mockDb';
import type { AiChatReply, AiKnowledge, AiSessionMessage } from '@/lib/types/ai';
import { parseAiAnalysis } from '@/lib/services/aiAnalysis';
import { buildKnowledge } from '@/lib/services/aiKnowledge';

/** Đọc lại mỗi lần hỏi để áp dụng ngay thay đổi đã lưu trong FAQ & sản phẩm. */
export function currentAiKnowledge(): AiKnowledge {
  return buildKnowledge(readDb());
}

export async function askShopAi(message: string, sessionContext: AiSessionMessage[] = []): Promise<AiChatReply> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, knowledge: currentAiKnowledge(), sessionContext }),
  });
  const data = await res.json();
  if (!res.ok || typeof data.reply !== 'string' || !data.reply.trim()) {
    throw new Error(data.error || 'AI chưa thể trả lời. Vui lòng thử lại.');
  }
  return { reply: data.reply, model: data.model, sourceSummary: data.sourceSummary, analysis: parseAiAnalysis(data.analysis) };
}

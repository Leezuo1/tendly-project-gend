'use client';

import { readDb } from '@/lib/services/mockDb';
import type { AiChatReply, AiKnowledge, AiSessionMessage } from '@/lib/types/ai';
import { parseAiAnalysis } from '@/lib/services/aiAnalysis';

/** Đọc lại mỗi lần hỏi để áp dụng ngay thay đổi đã lưu trong Cấu hình AI. */
export function currentAiKnowledge(): AiKnowledge {
  const db = readDb();
  return structuredClone({
    shop: { name: db.shop.name, email: db.shop.email, phone: db.shop.phone },
    productSource: {
      name: db.productSource.name, connected: db.productSource.connected, lastSyncedAt: db.productSource.lastSyncedAt,
    },
    products: db.products.map((p) => ({
      id: p.id, sku: p.sku, name: p.name, material: p.material, category: p.category,
      colors: p.colors, sizes: p.sizes, qty: p.qty, price: p.price,
    })),
    faqs: db.faqs.filter((f) => f.active),
    emailTriggers: db.triggers.filter((t) => t.enabled),
  });
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

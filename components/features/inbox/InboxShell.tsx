'use client';

import React, { useState, useMemo, useRef } from 'react';
import { Conversation, InboxFilter } from '@/lib/types/inbox';
import { INITIAL_CONVERSATIONS } from '@/lib/data/inbox';
import { Sidebar } from '@/components/features/dashboard/Sidebar';
import { ConversationList } from './ConversationList';
import { ThreadPane } from './ThreadPane';
import { CustomerProfilePane } from './CustomerProfilePane';
import { Toast } from '@/components/shared/Toast';
import { askShopAi } from '@/lib/services/aiChat';
import { applyConversationAnalysis, latestCustomerMessage, markConversationAnswered, sessionContext, sortReplyQueue } from '@/lib/services/inboxAi';

export function InboxShell() {
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    INITIAL_CONVERSATIONS.map((conversation) => ({ ...conversation, aiSuggestion: undefined }))
  );
  const [selectedId, setSelectedId] = useState<string>('lan');
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [draftText, setDraftText] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const pendingRequests = useRef(new Set<string>());

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const counts = useMemo(() => {
    return {
      all: conversations.length,
      urgent: conversations.filter((c) => c.isUnreplied && c.isUrgent).length,
      unreplied: conversations.filter((c) => c.isUnreplied).length,
    };
  }, [conversations]);

  const filteredConversations = useMemo(() => {
    return sortReplyQueue(conversations.filter((conv) => {
      if (filter === 'urgent' && (!conv.isUnreplied || !conv.isUrgent)) return false;
      if (filter === 'unreplied' && !conv.isUnreplied) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = conv.name.toLowerCase().includes(query);
        const matchesPreview = conv.preview.toLowerCase().includes(query);
        const matchesMessages = conv.messages.some((m) => m.text.toLowerCase().includes(query));
        const matchesArea = conv.profile.shippingArea.toLowerCase().includes(query);
        if (!matchesName && !matchesPreview && !matchesMessages && !matchesArea) {
          return false;
        }
      }

      return true;
    }));
  }, [conversations, filter, searchQuery]);

  const selectedConv = useMemo(() => {
    return conversations.find((c) => c.id === selectedId) || conversations[0];
  }, [conversations, selectedId]);

  const handleSelectConv = (id: string) => {
    setSelectedId(id);
    setDraftText('');
  };

  const handleSendMessage = (text: string) => {
    if (!selectedConv) return;

    const newMsg = {
      id: `msg-${Date.now()}`,
      sender: 'out' as const,
      text,
      time: 'Vừa xong',
    };

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === selectedConv.id) {
          return markConversationAnswered(c, newMsg);
        }
        return c;
      })
    );

    showToast(`Đã gửi tin nhắn đến ${selectedConv.name}`);
  };

  const handleUseAiSuggestion = (text: string) => {
    if (!selectedConv) return;

    const newMsg = {
      id: `msg-ai-${Date.now()}`,
      sender: 'out' as const,
      text,
      time: 'Vừa xong',
      isAiReply: true,
      aiSource: selectedConv.aiSuggestion?.source || 'Cấu hình AI',
    };

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === selectedConv.id) {
          return markConversationAnswered(c, newMsg);
        }
        return c;
      })
    );

    showToast(`Đã gửi câu trả lời AI cho ${selectedConv.name}`);
  };

  const analyzeMessage = async (conversation: Conversation, messageId: string, text: string, contextMessages = conversation.messages) => {
    try {
      const data = await askShopAi(text, sessionContext(contextMessages, messageId));
      setConversations((prev) => prev.map((c) => c.id === conversation.id
        ? applyConversationAnalysis(c, messageId, data) : c));
      showToast('Đã cập nhật cảm xúc, ưu tiên và gợi ý trả lời của AI.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không phân tích được tin nhắn.';
      setConversations((prev) => prev.map((c) => c.id === conversation.id && latestCustomerMessage(c)?.id === messageId && c.isUnreplied
        ? { ...c, aiStatus: 'error', aiError: message } : c));
      showToast(`Lỗi AI: ${message}`);
    } finally {
      pendingRequests.current.delete(conversation.id);
    }
  };

  const handleGenerateAiSuggestion = async () => {
    if (!selectedConv || pendingRequests.current.has(selectedConv.id)) return;
    const question = latestCustomerMessage(selectedConv);
    if (!question || !selectedConv.isUnreplied) {
      showToast('Không có tin nhắn khách đang chờ trả lời.');
      return;
    }
    pendingRequests.current.add(selectedConv.id);
    setConversations((prev) => prev.map((c) => c.id === selectedConv.id
      ? { ...c, aiStatus: 'analyzing', aiError: undefined, aiSuggestion: undefined } : c));
    await analyzeMessage(selectedConv, question.id, question.text);
  };

  // Khách nhắn tin -> phân tích, xếp hàng ưu tiên và tạo gợi ý cùng một lượt.
  const handleCustomerSendMessage = async (text: string) => {
    if (!selectedConv || pendingRequests.current.has(selectedConv.id)) return;
    pendingRequests.current.add(selectedConv.id);
    const receivedAt = Date.now();

    const newInMsg = {
      id: `msg-in-${crypto.randomUUID()}`,
      sender: 'in' as const,
      text,
      time: 'Vừa xong',
    };

    // 1. Cập nhật tin nhắn khách vào hội thoại
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === selectedConv.id) {
          return {
            ...c,
            time: 'Vừa xong',
            preview: text,
            isUnreplied: true,
            aiStatus: 'analyzing',
            aiError: undefined,
            pendingSince: c.pendingSince ?? receivedAt,
            aiSuggestion: undefined,
            messages: [...c.messages, newInMsg],
          };
        }
        return c;
      })
    );

    await analyzeMessage(selectedConv, newInMsg.id, text, selectedConv.messages);
  };

  return (
    <div className="inbox-root">
      <div className="shell">
        <Sidebar currentPath="hop-thoai" onToast={showToast} />

        <main className="main" aria-label="Hộp thoại">
          <div className="inbox-shell">
            <ConversationList
              conversations={filteredConversations}
              selectedId={selectedConv?.id || ''}
              onSelectConv={handleSelectConv}
              filter={filter}
              onFilterChange={setFilter}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              counts={counts}
            />

            {selectedConv && (
              <>
                <ThreadPane
                  conversation={selectedConv}
                  onSendMessage={handleSendMessage}
                  onUseAiSuggestion={handleUseAiSuggestion}
                  draftText={draftText}
                  onDraftChange={setDraftText}
                  onToast={showToast}
                  onCustomerSendMessage={handleCustomerSendMessage}
                  onGenerateAiSuggestion={handleGenerateAiSuggestion}
                />

                <CustomerProfilePane
                  profile={selectedConv.profile}
                  analysis={selectedConv.analysis}
                  aiStatus={selectedConv.aiStatus}
                  isUnreplied={Boolean(selectedConv.isUnreplied)}
                  onToast={showToast}
                />
              </>
            )}
          </div>
        </main>
      </div>

      <Toast message={toastMessage} />
    </div>
  );
}

'use client';

import React, { useState, useMemo } from 'react';
import { Conversation, InboxFilter } from '@/lib/types/inbox';
import { INITIAL_CONVERSATIONS } from '@/lib/data/inbox';
import { Sidebar } from '@/components/features/dashboard/Sidebar';
import { ConversationList } from './ConversationList';
import { ThreadPane } from './ThreadPane';
import { CustomerProfilePane } from './CustomerProfilePane';
import { Toast } from '@/components/shared/Toast';

export function InboxShell() {
  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS);
  const [selectedId, setSelectedId] = useState<string>('lan');
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [draftText, setDraftText] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const counts = useMemo(() => {
    return {
      all: conversations.length,
      urgent: conversations.filter((c) => c.isUrgent).length,
      unreplied: conversations.filter((c) => c.isUnreplied).length,
    };
  }, [conversations]);

  const filteredConversations = useMemo(() => {
    return conversations.filter((conv) => {
      // Filter tab
      if (filter === 'urgent' && !conv.isUrgent) return false;
      if (filter === 'unreplied' && !conv.isUnreplied) return false;

      // Search query
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
    });
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
          return {
            ...c,
            time: 'Vừa xong',
            preview: text,
            isUnreplied: false,
            messages: [...c.messages, newMsg],
          };
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
      aiSource: selectedConv.aiSuggestion?.source || 'AI Tendly',
    };

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === selectedConv.id) {
          return {
            ...c,
            time: 'Vừa xong',
            preview: text,
            isUnreplied: false,
            messages: [...c.messages, newMsg],
          };
        }
        return c;
      })
    );

    showToast(`Đã gửi câu trả lời AI cho ${selectedConv.name}`);
  };

  return (
    <div className="inbox-root">
      <div className="shell">
        <Sidebar currentPath="hop-thoai" onToast={showToast} />

        <main className="main">
          <div className="page-head">
            <div>
              <h1>Hộp thoại</h1>
              <p>Toàn bộ hội thoại từ Messenger &amp; Zalo OA, gom về 1 nơi và xếp theo mức độ ưu tiên.</p>
            </div>
          </div>

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
                />

                <CustomerProfilePane
                  profile={selectedConv.profile}
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

'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Conversation, InboxFilter } from '@/lib/types/inbox';
import { Sidebar } from '@/components/features/dashboard/Sidebar';
import { ConversationList } from './ConversationList';
import { ThreadPane } from './ThreadPane';
import { CustomerProfilePane } from './CustomerProfilePane';
import { Toast } from '@/components/shared/Toast';
import { askShopAi } from '@/lib/services/aiChat';
import { applyConversationAnalysis, latestCustomerMessage, markConversationAnswered, sessionContext, sortReplyQueue } from '@/lib/services/inboxAi';
import { mergeMessengerThread, messengerChatMessage } from '@/lib/services/messengerView';
import type { MessengerInboxSnapshot } from '@/lib/types/messengerInbox';
import type { MessengerMessage } from '@/lib/types/messenger';

export function InboxShell() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [draftText, setDraftText] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const pendingRequests = useRef(new Set<string>());
  const [accessKey, setAccessKey] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [syncStatus, setSyncStatus] = useState('Nhập mã truy cập để kết nối Messenger');
  const [limit, setLimit] = useState(100);
  const [hasMore, setHasMore] = useState(false);
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());
  const sendLocks = useRef(new Set<string>());
  const outboundRequests = useRef(new Map<string, string>());

  useEffect(() => {
    if (!accessKey) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController;
    const poll = async () => {
      if (document.visibilityState === 'hidden') { timer = setTimeout(poll, 2000); return; }
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch(`/api/messenger/inbox?limit=${limit}`, {
          headers: { Authorization: `Bearer ${accessKey}` }, cache: 'no-store', signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Không đồng bộ được Messenger.');
        if (cancelled) return;
        const snapshot = data as MessengerInboxSnapshot;
        setSelectedId((id) => snapshot.conversations.some((c) => c.id === id) ? id : snapshot.conversations[0]?.id || '');
        setConversations((previous) => snapshot.conversations.map((thread) =>
          mergeMessengerThread(thread, previous.find((c) => c.id === thread.id))));
        setHasMore(snapshot.hasMore);
        setSyncStatus('Đã kết nối · Tự cập nhật mỗi 2 giây');
      } catch (error) {
        if (!cancelled) setSyncStatus(error instanceof Error ? error.message : 'Mất kết nối. Đang thử lại...');
      } finally {
        clearTimeout(timeout);
        if (!cancelled) timer = setTimeout(poll, 2000);
      }
    };
    void poll();
    return () => { cancelled = true; clearTimeout(timer); controller?.abort(); };
  }, [accessKey, limit]);

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

  const sendLiveMessage = async (text: string): Promise<boolean> => {
    const target = selectedConv;
    if (!target?.messenger || sendLocks.current.has(target.id)) return false;
    sendLocks.current.add(target.id);
    setSendingIds((ids) => new Set(ids).add(target.id));
    const requestKey = JSON.stringify([target.id, text]);
    const requestId = outboundRequests.current.get(requestKey) || crypto.randomUUID();
    outboundRequests.current.set(requestKey, requestId);
    try {
      const response = await fetch('/api/messenger/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessKey}` },
        body: JSON.stringify({ psid: target.messenger.psid, text, requestId }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 400) outboundRequests.current.delete(requestKey);
        throw new Error(result.error || 'Chưa gửi được tin nhắn.');
      }
      outboundRequests.current.delete(requestKey);
      const message = messengerChatMessage(result.message as MessengerMessage);
      setConversations((previous) => previous.map((c) => {
        if (c.id !== target.id) return c;
        const messages = c.messages.some((m) => m.id === message.id) ? c.messages : [...c.messages, message];
        const latestIn = [...messages].reverse().find((m) => m.sender === 'in');
        if (latestIn && (latestIn.timestamp || 0) > (message.timestamp || 0)) return { ...c, messages };
        return { ...markConversationAnswered(c, message), messages };
      }));
      showToast(result.persisted ? 'Meta đã xác nhận gửi tin.' : 'Meta đã nhận tin; đang chờ webhook đồng bộ. Không gửi lại tin này.');
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Lỗi gửi. Kiểm tra Messenger trước khi thử lại.');
      return false;
    } finally {
      sendLocks.current.delete(target.id);
      setSendingIds((ids) => { const next = new Set(ids); next.delete(target.id); return next; });
    }
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

  return (
    <div className="inbox-root">
      <div className="shell">
        <Sidebar currentPath="hop-thoai" onToast={showToast} />

        <main className="main" aria-label="Hộp thoại">
          <div className="inbox-shell">
            <ConversationList
              toolbar={<div className="messenger-toolbar">
                  <form onSubmit={(e) => { e.preventDefault(); setAccessKey(keyInput.trim()); setKeyInput(''); }}>
                    <input type="password" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} placeholder="Mã truy cập inbox" aria-label="Mã truy cập inbox" autoComplete="off" required />
                    <button className="btn btn-outline btn-sm" type="submit">Kết nối</button>
                  </form>
                  <p role="status">{syncStatus}</p>
                  {hasMore && limit < 1000 && <button className="btn btn-outline btn-sm" onClick={() => setLimit((n) => n + 100)}>Tải thêm hội thoại</button>}
              </div>}
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
                  key={selectedConv.id}
                  conversation={selectedConv}
                  onSendMessage={sendLiveMessage}
                  onUseAiSuggestion={sendLiveMessage}
                  draftText={draftText}
                  onDraftChange={setDraftText}
                  onToast={showToast}
                  onGenerateAiSuggestion={handleGenerateAiSuggestion}
                  isSending={sendingIds.has(selectedConv.id)}
                  onLoadOlder={async () => {
                    const target = selectedConv;
                    const oldest = target.messages[0];
                    if (!target.messenger || !oldest) return;
                    try {
                      const params = new URLSearchParams({ psid: target.messenger.psid, before: String(oldest.timestamp), messageId: oldest.id });
                      const response = await fetch(`/api/messenger/inbox?${params}`, { headers: { Authorization: `Bearer ${accessKey}` }, cache: 'no-store' });
                      const result = await response.json();
                      if (!response.ok) throw new Error(result.error);
                      setConversations((prev) => prev.map((c) => c.id === target.id ? { ...c,
                        messenger: { ...c.messenger!, hasOlder: result.hasOlder },
                        messages: [...(result.messages as MessengerMessage[]).map(messengerChatMessage), ...c.messages].filter((m, i, all) => all.findIndex((x) => x.id === m.id) === i),
                      } : c));
                    } catch (error) { showToast(error instanceof Error ? error.message : 'Không tải được tin cũ.'); }
                  }}
                />

                <CustomerProfilePane
                  profile={selectedConv.profile}
                  analysis={selectedConv.analysis}
                  aiStatus={selectedConv.aiStatus}
                  isUnreplied={Boolean(selectedConv.isUnreplied)}
                />
              </>
            )}
            {!selectedConv && <div className="messenger-empty">
              <h2>Hội thoại Messenger</h2>
              <p>{accessKey ? 'Tin mới sẽ hiện ở đây khi khách nhắn vào Page và webhook đã được kết nối.' : 'Nhập mã truy cập ở bên trái để mở inbox.'}</p>
            </div>}
          </div>
        </main>
      </div>

      <Toast message={toastMessage} />
    </div>
  );
}

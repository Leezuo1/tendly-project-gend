'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Conversation, InboxFilter } from '@/lib/types/inbox';
import { Sidebar } from '@/components/features/dashboard/Sidebar';
import { ConversationList } from './ConversationList';
import { ThreadPane } from './ThreadPane';
import { CustomerProfilePane } from './CustomerProfilePane';
import { Toast } from '@/components/shared/Toast';
import { askShopAi } from '@/lib/services/aiChat';
import { applyConversationAnalysis, automaticAnalysisCandidates, latestCustomerMessage, markConversationAnswered, sessionContext, sortReplyQueue } from '@/lib/services/inboxAi';
import { mergeMessengerThread, messengerChatMessage } from '@/lib/services/messengerView';
import type { MessengerInboxSnapshot } from '@/lib/types/messengerInbox';
import type { MessengerMessage } from '@/lib/types/messenger';
import { useInboxSession } from '@/lib/services/inboxCredentials';
import type { AiChatReply, AiSessionMessage } from '@/lib/types/ai';
import { ConfirmDialog } from '@/components/ui/Modal';

export function InboxShell() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const selectedIdRef = useRef('');
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [draftText, setDraftText] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const pendingRequests = useRef(new Set<string>());
  const attemptedAnalysis = useRef(new Map<string, string>());
  const [analysisTick, setAnalysisTick] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);
  const [deleting, setDeleting] = useState(false);
  const conversationsRef = useRef(conversations);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);
  const { ready, error: sessionError } = useInboxSession();
  const [syncStatus, setSyncStatus] = useState('');
  const [limit, setLimit] = useState(100);
  const [hasMore, setHasMore] = useState(false);
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());
  const sendLocks = useRef(new Set<string>());
  const outboundRequests = useRef(new Map<string, string>());
  const hiddenConversations = useRef(new Map<string, number>());

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController;
    const poll = async () => {
      if (document.visibilityState === 'hidden') { timer = setTimeout(poll, 2000); return; }
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch(`/api/messenger/inbox?limit=${limit}`, {
          cache: 'no-store', signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Không đồng bộ được Messenger.');
        if (cancelled) return;
        const snapshot = data as MessengerInboxSnapshot;
        snapshot.conversations = snapshot.conversations.filter((thread) => {
          const hiddenAt = hiddenConversations.current.get(thread.id);
          if (hiddenAt === undefined) return true;
          if ((thread.lastInAt || 0) <= hiddenAt) return false;
          hiddenConversations.current.delete(thread.id);
          return true;
        });
        const nextSelected = snapshot.conversations.some((c) => c.id === selectedIdRef.current)
          ? selectedIdRef.current : snapshot.conversations[0]?.id || '';
        selectedIdRef.current = nextSelected;
        setSelectedId(nextSelected);
        setConversations((previous) => snapshot.conversations.map((thread) => {
          const merged = mergeMessengerThread(thread, previous.find((c) => c.id === thread.id));
          // The visible open thread is already being read; other rows keep their unread marker.
          return thread.id === selectedIdRef.current && document.visibilityState === 'visible'
            ? { ...merged, hasNewMessage: false, unreadMessageIds: [] } : merged;
        }));
        setHasMore(snapshot.hasMore);
        setSyncStatus('');
      } catch (error) {
        if (!cancelled) setSyncStatus(error instanceof Error ? error.message : 'Mất kết nối. Đang thử lại...');
      } finally {
        clearTimeout(timeout);
        if (!cancelled) timer = setTimeout(poll, 2000);
      }
    };
    void poll();
    return () => { cancelled = true; clearTimeout(timer); controller?.abort(); };
  }, [ready, limit]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  }, []);

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
    selectedIdRef.current = id;
    setSelectedId(id);
    setConversations((previous) => previous.map((c) => c.id === id ? { ...c, hasNewMessage: false, unreadMessageIds: [] } : c));
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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

  const analyzeMessage = useCallback(async (conversation: Conversation, messageId: string, text: string, contextMessages = conversation.messages, automatic = false) => {
    try {
      const data = await askShopAi(text, sessionContext(contextMessages, messageId));
      if (conversation.messenger) {
        const response = await fetch('/api/messenger/conversation', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ psid: conversation.messenger.psid, messageId, ...data }) });
        if (!response.ok) throw new Error('Không lưu được phân tích vào database.');
      }
      setConversations((prev) => prev.map((c) => c.id === conversation.id
        ? applyConversationAnalysis(c, messageId, data) : c));
      if (!automatic) showToast('Đã cập nhật cảm xúc, ưu tiên và gợi ý trả lời của AI.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không phân tích được tin nhắn.';
      setConversations((prev) => prev.map((c) => c.id === conversation.id && latestCustomerMessage(c)?.id === messageId && c.isUnreplied
        ? { ...c, aiStatus: 'error', aiError: message } : c));
      if (!automatic) showToast(`Lỗi AI: ${message}`);
    } finally {
      pendingRequests.current.delete(conversation.id);
      setAnalysisTick((tick) => tick + 1);
    }
  }, [showToast]);

  useEffect(() => {
    if (!ready) return;
    const candidates = automaticAnalysisCandidates(conversations, pendingRequests.current, attemptedAnalysis.current);
    if (!candidates.length) return;
    for (const conversation of candidates) {
      const question = latestCustomerMessage(conversation)!;
      // Reserve synchronously, including in Strict Mode, and never retry a failed message on every poll.
      pendingRequests.current.add(conversation.id);
      attemptedAnalysis.current.set(conversation.id, question.id);
      void analyzeMessage(conversation, question.id, question.text, conversation.messages, true);
    }
    const ids = new Set(candidates.map((c) => c.id));
    setConversations((previous) => previous.map((c) => ids.has(c.id)
      ? { ...c, aiStatus: 'analyzing', aiError: undefined, aiSuggestion: undefined } : c));
  }, [ready, conversations, analysisTick, analyzeMessage]);

  // Backfill persisted messages for the open conversation, without replacing its latest reply suggestion.
  useEffect(() => {
    if (!ready || !selectedId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const backfill = async () => {
      const conversation = conversationsRef.current.find((c) => c.id === selectedId);
      if (!conversation?.messenger || cancelled) return;
      if (pendingRequests.current.size) { timer = setTimeout(backfill, 3000); return; }
      try {
        const response = await fetch(`/api/messenger/conversation?psid=${conversation.messenger.psid}`, { cache: 'no-store' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        if (!result.jobs.length && !cancelled) {
          await fetch('/api/messenger/conversation', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ psid: conversation.messenger.psid, action: 'summarize' }) });
        }
        for (const job of result.jobs as { messageId: string; text: string; context: AiSessionMessage[] }[]) {
          if (cancelled) return;
          const current = conversationsRef.current.find((c) => c.id === selectedId);
          if (!current) return;
          if (pendingRequests.current.size || (current.isUnreplied && latestCustomerMessage(current)?.id === job.messageId)) break;
          const data: AiChatReply = await askShopAi(job.text || '[Tệp đính kèm]', job.context);
          const saved = await fetch('/api/messenger/conversation', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ psid: conversation.messenger.psid, messageId: job.messageId, ...data }) });
          if (!saved.ok) throw new Error('Không lưu được phân tích lịch sử.');
        }
        if (!cancelled) timer = setTimeout(backfill, result.jobs.length ? 3000 : 15000);
      } catch (error) {
        if (!cancelled) showToast(error instanceof Error ? error.message : 'Không phân tích được lịch sử. Mở lại hội thoại để thử lại.');
      }
    };
    timer = setTimeout(backfill, 3000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [ready, selectedId, showToast]);

  const handleGenerateAiSuggestion = async () => {
    if (!selectedConv || pendingRequests.current.has(selectedConv.id)) return;
    const question = latestCustomerMessage(selectedConv);
    if (!question || !selectedConv.isUnreplied) {
      showToast('Không có tin nhắn khách đang chờ trả lời.');
      return;
    }
    pendingRequests.current.add(selectedConv.id);
    attemptedAnalysis.current.set(selectedConv.id, question.id);
    setConversations((prev) => prev.map((c) => c.id === selectedConv.id
      ? { ...c, aiStatus: 'analyzing', aiError: undefined, aiSuggestion: undefined } : c));
    await analyzeMessage(selectedConv, question.id, question.text);
  };

  if (!ready) return <div className="inbox-root"><div className="shell">
    <Sidebar currentPath="hop-thoai" onToast={showToast} />
    <main className="main"><p role="status">{sessionError || 'Đang kiểm tra cấu hình kết nối...'}</p></main>
  </div></div>;

  return (
    <div className="inbox-root">
      <div className="shell">
        <Sidebar currentPath="hop-thoai" onToast={showToast}
          unreadMessageCount={conversations.reduce((sum, c) => sum + (c.unreadMessageIds?.length || 0), 0)} />

        <main className="main" aria-label="Hộp thoại">
          <div className="inbox-shell">
            <ConversationList
              toolbar={<div className="messenger-toolbar">
                  {syncStatus && <p role="status">{syncStatus}</p>}
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
                  onDeleteConversation={async () => { setDeleteTarget(selectedConv); }}
                  onLoadOlder={async () => {
                    const target = selectedConv;
                    const oldest = target.messages[0];
                    if (!target.messenger || !oldest) return;
                    try {
                      const params = new URLSearchParams({ psid: target.messenger.psid, before: String(oldest.timestamp), messageId: oldest.id });
                      const response = await fetch(`/api/messenger/inbox?${params}`, { cache: 'no-store' });
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
                  personalitySummary={selectedConv.personalitySummary}
                />
              </>
            )}
            {!selectedConv && <div className="messenger-empty">
              <h2>Hội thoại Messenger</h2>
              <p>Tin mới sẽ hiện ở đây khi khách nhắn vào Page và webhook đã được kết nối.</p>
            </div>}
          </div>
        </main>
      </div>

      <Toast message={toastMessage} />
      <ConfirmDialog open={Boolean(deleteTarget)} title="Xóa hội thoại khỏi inbox?"
        message="Hội thoại sẽ được ẩn phía shop, không xóa tin trên Facebook. Lịch sử vẫn lưu trong database và hội thoại hiện lại khi khách nhắn tin mới."
        confirmLabel="Xóa hội thoại" busy={deleting} onClose={() => { if (!deleting) setDeleteTarget(null); }}
        onConfirm={() => { void (async () => {
          if (!deleteTarget?.messenger) return;
          setDeleting(true);
          try {
            const response = await fetch('/api/messenger/conversation', { method: 'DELETE', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ psid: deleteTarget.messenger.psid }) });
            if (!response.ok) throw new Error('Không xóa được hội thoại.');
            const result = await response.json();
            hiddenConversations.current.set(deleteTarget.id, result.hiddenAt || Date.now());
            setConversations((previous) => previous.filter((c) => c.id !== deleteTarget.id));
            setDeleteTarget(null); setDraftText(''); showToast('Đã xóa hội thoại khỏi inbox.');
          } catch (error) { showToast(error instanceof Error ? error.message : 'Không xóa được hội thoại.'); }
          finally { setDeleting(false); }
        })(); }} />
    </div>
  );
}

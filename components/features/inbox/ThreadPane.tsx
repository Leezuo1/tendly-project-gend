'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Conversation } from '@/lib/types/inbox';
import { EMOTION_LABELS } from '@/lib/services/inboxAi';

interface ThreadPaneProps {
  conversation: Conversation;
  onSendMessage: (text: string) => void;
  onUseAiSuggestion: (text: string) => void;
  draftText: string;
  onDraftChange: (text: string) => void;
  onToast: (msg: string) => void;
  onCustomerSendMessage?: (text: string) => Promise<void> | void;
  onGenerateAiSuggestion: () => Promise<void>;
}

const CUSTOMER_PROMPT_CHIPS = [
  { icon: '😠', text: 'Shop giao sai màu lần thứ hai rồi, em rất bực! Em muốn gặp nhân viên.', desc: 'Khiếu nại cần xử lý' },
  { icon: '😟', text: 'Em hơi lo không biết đơn của em có kịp đến trước thứ sáu không?', desc: 'Lo lắng' },
  { icon: '😊', text: 'Cảm ơn shop nha, em đã hiểu rồi!', desc: 'Tích cực' },
  { icon: '👕', text: 'Áo AT-01 giá bao nhiêu?', desc: 'Tư vấn bình thường' },
  { icon: '🔄', text: 'Shop có chính sách đổi size như thế nào?', desc: 'Hỏi chính sách, không phải khiếu nại' },
  { icon: '👋', text: 'Chào shop, có ai ở đây không?', desc: 'Xã giao' },
];

export function ThreadPane({
  conversation,
  onSendMessage,
  onUseAiSuggestion,
  draftText,
  onDraftChange,
  onToast,
  onCustomerSendMessage,
  onGenerateAiSuggestion,
}: ThreadPaneProps) {
  const messagesRef = useRef<HTMLDivElement>(null);
  const previousConversationRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Mặc định cho phép người dùng đóng vai khách hàng hỏi ngay
  const [role, setRole] = useState<'customer' | 'shop'>('customer');
  const isThinkingAi = conversation.aiStatus === 'analyzing';

  useEffect(() => {
    const messages = messagesRef.current;
    if (!messages) return;
    const switchedConversation = previousConversationRef.current !== conversation.id;
    previousConversationRef.current = conversation.id;
    messages.scrollTo({
      top: messages.scrollHeight,
      behavior: switchedConversation ? 'instant' : 'smooth',
    });
  }, [conversation.id, conversation.messages.length, conversation.aiSuggestion, isThinkingAi, role]);

  const handleAskGemini = async () => {
    if (!isThinkingAi) await onGenerateAiSuggestion();
  };

  const handleSend = async () => {
    if (!draftText.trim() || isThinkingAi) return;
    const text = draftText.trim();
    onDraftChange('');

    if (role === 'customer') {
      if (onCustomerSendMessage) {
        await onCustomerSendMessage(text);
      } else {
        onToast('Tính năng gửi tin nhắn khách hàng chưa sẵn sàng.');
      }
    } else {
      onSendMessage(text);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickChipClick = async (chipText: string) => {
    if (isThinkingAi) return;
    setRole('customer');
    if (onCustomerSendMessage) {
      await onCustomerSendMessage(chipText);
    }
  };

  const handleEditSuggestion = (text: string) => {
    onDraftChange(text);
    setRole('shop'); // chuyển sang vai Shop để chỉnh sửa và gửi
    if (inputRef.current) {
      inputRef.current.focus();
    }
    onToast('Đã chèn nội dung AI vào khung soạn thảo và chuyển sang chế độ Shop');
  };

  const isFb = conversation.channel === 'facebook';

  return (
    <div className="thread-pane">
      {/* Header */}
      <div className="thread-header">
        <div className="thread-who">
          <div className="conv-avatar-wrap">
            <div className="conv-avatar">{conversation.avatar}</div>
            <div className={`channel-dot ${isFb ? 'cd-fb' : 'cd-zalo'}`}>
              {isFb ? 'f' : 'Z'}
            </div>
          </div>
          <div>
            <div className="name">{conversation.threadWho.name}</div>
            <div className="sub">{conversation.threadWho.sub}</div>
          </div>
        </div>

        <div className="thread-header-actions">
        {conversation.threadWho.badgeTag && (
          <span className={`tag tag-${conversation.threadWho.badgeTag.type}`}>
            {conversation.threadWho.badgeTag.label}
          </span>
        )}
          {conversation.isUnreplied && (
            <button type="button" className="btn btn-outline btn-sm" onClick={handleAskGemini} disabled={isThinkingAi}>
              {isThinkingAi ? 'Đang phân tích...' : 'Phân tích AI'}
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="thread-messages" ref={messagesRef}>
        {conversation.messages.map((msg) => {
          if (msg.isDivider) {
            return (
              <div key={msg.id} className="thread-divider">
                {msg.text}
              </div>
            );
          }

          return (
            <div key={msg.id} className={`msg-row ${msg.sender}`}>
              <div className="msg-bubble">{msg.text}</div>
              <div className="msg-meta">
                {msg.isAiReply && <span className="msg-ai-tag">AI Gemini trả lời</span>}
                <span>{msg.time}</span>
                {conversation.analysis?.messageId === msg.id && (
                  <span className={`tag tag-${conversation.analysis.sentiment === 'negative' ? 'high' : conversation.analysis.sentiment === 'positive' ? 'positive' : 'neutral'}`}>
                    {EMOTION_LABELS[conversation.analysis.emotion]}
                  </span>
                )}
                {msg.aiSource && <span>· {msg.aiSource}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Compose + AI Suggestion */}
      <div className="thread-compose">
        <div className="compose-tools">
        {/* Đang chờ Gemini suy nghĩ */}
        {isThinkingAi && (
          <div className="ai-loading-box">
            <span>🤖</span>
            <span>AI đang nhận diện cảm xúc, xếp ưu tiên và tạo câu trả lời...</span>
          </div>
        )}
        {conversation.aiStatus === 'error' && (
          <div className="ai-error-box" role="alert">
            <span>{conversation.aiError || 'AI chưa phân tích được tin nhắn.'}</span>
            <button type="button" className="btn btn-outline btn-sm" onClick={handleAskGemini}>Thử lại</button>
          </div>
        )}

        {/* Khối gợi ý câu trả lời của AI */}
        {conversation.aiSuggestion && !isThinkingAi && (
          <div className="ai-suggestion">
            <div className="ai-suggestion-head">
              <span className="ai-suggestion-label">{conversation.aiSuggestion.label}</span>
              <span className="ai-suggestion-source">{conversation.aiSuggestion.source}</span>
            </div>
            <div className="ai-suggestion-text">{conversation.aiSuggestion.text}</div>
            <div className="ai-suggestion-actions">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => onUseAiSuggestion(conversation.aiSuggestion!.text)}
              >
                Gửi ngay câu này (Tư cách Shop)
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => handleEditSuggestion(conversation.aiSuggestion!.text)}
              >
                Chỉnh sửa trước khi gửi
              </button>
            </div>
          </div>
        )}

        {/* Thanh chọn chế độ đóng vai */}
        <div className="role-switch-bar">
          <div className="role-toggle-group">
            <button
              type="button"
              className={`role-btn ${role === 'customer' ? 'active-customer' : ''}`}
              onClick={() => setRole('customer')}
              title="Đóng vai khách hỏi để xem AI đề xuất"
            >
              👤 Khách hỏi
            </button>
            <button
              type="button"
              className={`role-btn ${role === 'shop' ? 'active-shop' : ''}`}
              onClick={() => setRole('shop')}
              title="Gửi câu trả lời của Shop"
            >
              🏢 Shop trả lời
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {role === 'customer' ? (
              <span className="role-hint-pill">
                💡 Đang ở vai Khách: Hãy hỏi để xem AI đề xuất
              </span>
            ) : (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleAskGemini}
                disabled={isThinkingAi || !conversation.isUnreplied}
                style={{ fontSize: 11.5, padding: '4px 10px', gap: 6, borderRadius: 8 }}
                title="Tạo câu trả lời từ dữ liệu Cấu hình AI đã lưu"
              >
                {isThinkingAi ? '⏳ Đang phân tích...' : '✨ Tạo câu trả lời AI'}
              </button>
            )}
          </div>
        </div>

        {/* Gợi ý câu hỏi nhanh khi ở chế độ Khách */}
        {role === 'customer' && (
          <div className="customer-quick-chips">
            <span className="chips-label">Hỏi nhanh:</span>
            {CUSTOMER_PROMPT_CHIPS.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                className="cust-chip"
                onClick={() => handleQuickChipClick(chip.text)}
                disabled={isThinkingAi}
                title={`Thử hỏi: ${chip.desc}`}
              >
                {chip.icon} {chip.text}
              </button>
            ))}
          </div>
        )}

        </div>
        {/* Khung nhập tin nhắn */}
        <div className={`compose-row ${role === 'customer' ? 'mode-customer' : ''}`}>
          <input
            ref={inputRef}
            type="text"
            value={draftText}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              role === 'customer'
                ? `Nhập câu hỏi với vai ${conversation.name} (ví dụ: 'Trời mưa không?', 'Còn size L không?')...`
                : 'Nhập tin nhắn phản hồi của Shop...'
            }
            aria-label="Nhập tin nhắn"
            disabled={isThinkingAi}
          />
          <button
            type="button"
            className={`compose-send ${role === 'customer' ? 'send-as-customer' : ''}`}
            onClick={handleSend}
            disabled={!draftText.trim() || isThinkingAi}
            title={role === 'customer' ? 'Gửi với vai Khách hàng' : 'Gửi với vai Shop'}
            aria-label="Gửi tin nhắn"
          >
            {role === 'customer' ? (
              <span style={{ fontSize: 12, fontWeight: 700 }}>Hỏi</span>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 2 11 13"></path>
                <path d="M22 2 15 22l-4-9-9-4 20-7z"></path>
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

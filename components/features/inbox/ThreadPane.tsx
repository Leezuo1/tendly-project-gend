'use client';

import React, { useRef, useEffect } from 'react';
import { Conversation } from '@/lib/types/inbox';

interface ThreadPaneProps {
  conversation: Conversation;
  onSendMessage: (text: string) => void;
  onUseAiSuggestion: (text: string) => void;
  draftText: string;
  onDraftChange: (text: string) => void;
  onToast: (msg: string) => void;
}

export function ThreadPane({
  conversation,
  onSendMessage,
  onUseAiSuggestion,
  draftText,
  onDraftChange,
  onToast,
}: ThreadPaneProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation.id, conversation.messages.length]);

  const handleSend = () => {
    if (!draftText.trim()) return;
    onSendMessage(draftText.trim());
    onDraftChange('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEditSuggestion = (text: string) => {
    onDraftChange(text);
    if (inputRef.current) {
      inputRef.current.focus();
    }
    onToast('Đã chèn nội dung AI vào khung soạn thảo để bạn chỉnh sửa');
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

        {conversation.threadWho.badgeTag && (
          <span className={`tag tag-${conversation.threadWho.badgeTag.type}`}>
            {conversation.threadWho.badgeTag.label}
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="thread-messages">
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
                {msg.isAiReply && <span className="msg-ai-tag">AI trả lời tự động</span>}
                <span>{msg.time}</span>
                {msg.aiSource && <span>· nguồn: {msg.aiSource}</span>}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Compose + AI Suggestion */}
      <div className="thread-compose">
        {conversation.aiSuggestion && (
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
                Gửi ngay
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

        <div className="compose-row">
          <input
            ref={inputRef}
            type="text"
            value={draftText}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nhập tin nhắn..."
            aria-label="Nhập tin nhắn phản hồi"
          />
          <button
            type="button"
            className="compose-send"
            onClick={handleSend}
            disabled={!draftText.trim()}
            title="Gửi tin nhắn"
            aria-label="Gửi tin nhắn"
          >
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
          </button>
        </div>
      </div>
    </div>
  );
}

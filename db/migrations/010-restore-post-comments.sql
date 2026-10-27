-- Requeue ordinary post comments incorrectly handed to a Livestream test session.
UPDATE facebook_comments c SET status='pending',reason='',revision=revision+1
WHERE c.status='ignored'
  AND c.reason='Bình luận thuộc phiên Livestream đang chạy, xử lý ở trang Livestream.'
  AND EXISTS (SELECT 1 FROM live_sessions s WHERE s.page_id=c.page_id
    AND s.platform='facebook' AND s.source_kind='post' AND s.source_post_id=c.post_id)
  AND NOT EXISTS (SELECT 1 FROM live_sessions s WHERE s.page_id=c.page_id
    AND s.platform='facebook' AND s.source_kind='live_video' AND s.status='live' AND s.source_post_id=c.post_id)
  AND NOT EXISTS (SELECT 1 FROM live_comments l JOIN live_sessions s ON s.id=l.session_id
    WHERE s.page_id=c.page_id AND l.comment_id=c.comment_id AND l.reply_status IN ('sending','sent','unknown'));

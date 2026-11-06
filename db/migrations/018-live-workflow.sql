ALTER TABLE live_sessions DROP CONSTRAINT IF EXISTS live_sessions_status_check;
ALTER TABLE live_sessions ADD CONSTRAINT live_sessions_status_check CHECK(status IN ('draft','live','ended'));
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS preparation_json JSONB;
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS preparation_revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS approved_at BIGINT;
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS approved_by TEXT;
CREATE TABLE IF NOT EXISTS live_on_air_events (
  session_id TEXT NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  occurred_at BIGINT NOT NULL,
  sku TEXT,
  PRIMARY KEY(session_id,occurred_at)
);
-- shortcut: old sessions have no event history; only establish context from migration time onward.
INSERT INTO live_on_air_events(session_id,occurred_at,sku)
SELECT s.id,FLOOR(EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)*1000)::bigint,s.on_air_sku
FROM live_sessions s WHERE s.status='live' AND s.on_air_sku IS NOT NULL
AND NOT EXISTS(SELECT 1 FROM live_on_air_events e WHERE e.session_id=s.id)
ON CONFLICT DO NOTHING;

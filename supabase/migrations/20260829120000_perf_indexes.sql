CREATE INDEX IF NOT EXISTS idx_attachments_user_ready
  ON attachments (user_id, created_at DESC)
  WHERE processing_status = 'ready';

CREATE INDEX IF NOT EXISTS idx_conversations_zone_id
  ON conversations (zone_id, id)
  WHERE zone_id IS NOT NULL;

DROP INDEX IF EXISTS document_chunks_zone_idx;

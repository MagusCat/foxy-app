-- Semantic search over uploaded files. Applied on top of schema v2.
-- Until the ai-service needs it, attachments.extracted_text is enough.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE document_chunks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attachment_id uuid NOT NULL REFERENCES attachments (id) ON DELETE CASCADE,
  zone_id       uuid REFERENCES study_zones (id) ON DELETE CASCADE,
  content       text NOT NULL,
  embedding     vector(1536),
  chunk_index   integer NOT NULL,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (attachment_id, chunk_index)
);

CREATE INDEX document_chunks_zone_idx ON document_chunks (zone_id) WHERE zone_id IS NOT NULL;
CREATE INDEX document_chunks_embedding_idx ON document_chunks
  USING hnsw (embedding vector_cosine_ops);

ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON document_chunks FROM anon, authenticated;

COMMENT ON TABLE document_chunks IS 'Chunks of an attachment with their embedding, for semantic search.';
COMMENT ON COLUMN document_chunks.zone_id IS 'Denormalized from the attachment so search can be scoped to one zone without a join.';
COMMENT ON COLUMN document_chunks.embedding IS 'Dimension 1536 matches the current embedding model; changing model means rebuilding this column and its index.';
COMMENT ON COLUMN document_chunks.chunk_index IS 'Position inside the file, unique per attachment.';

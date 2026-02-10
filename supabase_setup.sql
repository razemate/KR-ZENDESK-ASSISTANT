-- Enable the pgvector extension to work with embeddings
create extension if not exists vector;

-- Create a table to store your knowledge base (both Ticket History and Uploaded Files)
-- This is a NEW table and does not touch your existing data.
create table if not exists knowledge_base (
  id bigserial primary key,
  content text, -- The text content (e.g., ticket reply or file text)
  metadata jsonb, -- Metadata like { "source": "ticket", "ticket_id": 123 } or { "source": "file", "filename": "policy.pdf" }
  embedding vector(768) -- Gemini 1.5 Flash embedding dimension
);

-- Create a function to search for similar documents
create or replace function match_knowledge_base (
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query;
  select
    kb.id,
    kb.content,
    kb.metadata,
    1 - (kb.embedding <=> query_embedding) as similarity
  from knowledge_base kb
  where 1 - (kb.embedding <=> query_embedding) > match_threshold
  order by kb.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- ============================================================
-- Migration 040: search_memories RPC for pgvector semantic search
-- 
-- Creates a Postgres function callable via supabase.rpc() that
-- performs cosine similarity search using the IVFFlat index.
-- 
-- This replaces the non-existent exec_sql RPC and enables
-- real vector search instead of keyword fallback.
-- ============================================================

-- Cosine similarity search against the memories table
-- Returns matches sorted by relevance (1.0 = exact match)
create or replace function search_memories(
  query_embedding vector(768),
  match_threshold float default 0.5,
  match_count int default 10,
  filter_memory_type text default null,
  filter_entity_type text default null
)
returns table (
  id uuid,
  content text,
  memory_type text,
  entity_type text,
  entity_id uuid,
  importance int,
  similarity float,
  metadata jsonb,
  created_at timestamptz
)
language plpgsql
as $$
begin
  return query
  select
    memories.id,
    memories.content,
    memories.memory_type,
    memories.entity_type,
    memories.entity_id,
    memories.importance,
    1 - (memories.embedding <=> query_embedding) as similarity,
    memories.metadata,
    memories.created_at
  from memories
  where
    (1 - (memories.embedding <=> query_embedding)) > match_threshold
    and (filter_memory_type is null or memories.memory_type = filter_memory_type)
    and (filter_entity_type is null or memories.entity_type = filter_entity_type)
  order by memories.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Keyword fallback search using full-text search
create or replace function search_memories_keyword(
  search_query text,
  match_count int default 10,
  filter_memory_type text default null,
  filter_entity_type text default null
)
returns table (
  id uuid,
  content text,
  memory_type text,
  entity_type text,
  entity_id uuid,
  importance int,
  rank float,
  metadata jsonb,
  created_at timestamptz
)
language plpgsql
as $$
begin
  return query
  select
    memories.id,
    memories.content,
    memories.memory_type,
    memories.entity_type,
    memories.entity_id,
    memories.importance,
    0.5::float as rank,
    memories.metadata,
    memories.created_at
  from memories
  where
    memories.content ilike '%' || search_query || '%'
    and (filter_memory_type is null or memories.memory_type = filter_memory_type)
    and (filter_entity_type is null or memories.entity_type = filter_entity_type)
  order by memories.importance desc
  limit match_count;
end;
$$;

-- Verify IVFFlat index exists
select indexname, indexdef
from pg_indexes
where tablename = 'memories'
  and indexdef ilike '%ivfflat%';

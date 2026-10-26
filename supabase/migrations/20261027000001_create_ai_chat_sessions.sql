-- ==============================================================================
-- CHESS PLAYER ANALYZER V2: PERSISTENT AI CHAT SESSIONS
-- Migration: 20261027000001_create_ai_chat_sessions.sql
-- Purpose: Create cross-device persistent AI Chat history table with RLS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.ai_chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    player_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    title TEXT NOT NULL DEFAULT 'Cuộc trò chuyện mới',
    perspective_mode TEXT NOT NULL DEFAULT 'self',
    pinned BOOLEAN NOT NULL DEFAULT false,
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable Row Level Security
ALTER TABLE public.ai_chat_sessions ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists then recreate
DROP POLICY IF EXISTS "Users can manage their own chat sessions" ON public.ai_chat_sessions;
CREATE POLICY "Users can manage their own chat sessions"
    ON public.ai_chat_sessions
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Performance Index for sorting by recent updates per user
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_user_updated
    ON public.ai_chat_sessions(user_id, updated_at DESC);

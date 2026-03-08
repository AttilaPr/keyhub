-- CreateIndex (Full-Text Search)
CREATE INDEX IF NOT EXISTS "RequestLog_prompt_search_idx" ON "RequestLog" USING GIN (to_tsvector('english', "prompt"));
CREATE INDEX IF NOT EXISTS "RequestLog_response_search_idx" ON "RequestLog" USING GIN (to_tsvector('english', COALESCE("response", '')));

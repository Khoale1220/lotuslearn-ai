ALTER TABLE pipeline_backfill_slots
    ADD COLUMN fence_token BIGINT NOT NULL DEFAULT 0;

ALTER TABLE pipeline_backfill_slots
    ADD CONSTRAINT pipeline_backfill_slots_fence_token_nonnegative
    CHECK (fence_token >= 0);

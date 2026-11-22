-- DE04 C14: controlled backfill cancellation.
--
-- Extend the existing backfill slot status domain with CANCELLED while
-- preserving all previously installed lifecycle invariants.
--
-- This migration replaces only the enum-like status CHECK constraint.
-- It deliberately does not remove status-dependent ownership, lease,
-- fencing, or terminal-execution invariants.

DO $$
DECLARE
    constraint_record record;
BEGIN
    FOR constraint_record IN
        SELECT
            constraint_row.conname
        FROM pg_constraint AS constraint_row
        JOIN pg_class AS table_row
          ON table_row.oid = constraint_row.conrelid
        JOIN pg_namespace AS namespace_row
          ON namespace_row.oid = table_row.relnamespace
        WHERE table_row.relname = 'pipeline_backfill_slots'
          AND namespace_row.nspname = current_schema()
          AND constraint_row.contype = 'c'
          AND pg_get_constraintdef(constraint_row.oid)
              ILIKE '%PENDING%'
          AND pg_get_constraintdef(constraint_row.oid)
              ILIKE '%SKIPPED%'
          AND pg_get_constraintdef(constraint_row.oid)
              ILIKE '%CLAIMED%'
          AND pg_get_constraintdef(constraint_row.oid)
              ILIKE '%SUCCEEDED%'
          AND pg_get_constraintdef(constraint_row.oid)
              ILIKE '%FAILED%'
    LOOP
        EXECUTE format(
            'ALTER TABLE pipeline_backfill_slots '
            'DROP CONSTRAINT %I',
            constraint_record.conname
        );
    END LOOP;
END
$$;

ALTER TABLE pipeline_backfill_slots
    ADD CONSTRAINT pipeline_backfill_slots_status_c14_check
    CHECK (
        status IN (
            'PENDING',
            'SKIPPED',
            'CANCELLED',
            'CLAIMED',
            'SUCCEEDED',
            'FAILED'
        )
    );

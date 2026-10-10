-- First-clip order link for one DCA cycle.
-- Claimed when the first market clip is sent and cleared when that leg resets,
-- so a repeat send in the same cycle reuses the link and the next cycle does not.

alter table public.dca_playbooks
    add column long_clip_generation bigint
        check (long_clip_generation is null or long_clip_generation >= 0),
    add column short_clip_generation bigint
        check (short_clip_generation is null or short_clip_generation >= 0);

-- Phase 11: 20260827090000 already ran on develop as the first playbook
-- shape (side + one status). Later commits edited that file in place, so
-- db push did not add direction, legs, or exit columns. This brings the
-- live table in line with the current create table.

alter table public.dca_playbooks
    add column if not exists direction text,
    add column if not exists start_kind text,
    add column if not exists webhook_id uuid
        references public.futures_webhooks (id) on delete set null,
    add column if not exists dca_mode text,
    add column if not exists size_multiplier numeric,
    add column if not exists deviation_multiplier numeric,
    add column if not exists take_profit_basis text,
    add column if not exists stop_loss_basis text,
    add column if not exists breakeven_activation_pct numeric,
    add column if not exists breakeven_offset_pct numeric,
    add column if not exists trailing_trigger_pct numeric,
    add column if not exists trailing_pct numeric,
    add column if not exists indicator_kind text,
    add column if not exists indicator_timeframe text,
    add column if not exists indicator_compare text,
    add column if not exists indicator_level numeric,
    add column if not exists long_indicator_true boolean,
    add column if not exists short_indicator_true boolean,
    add column if not exists long_status text,
    add column if not exists long_clips_filled integer,
    add column if not exists long_last_clip_price numeric,
    add column if not exists long_last_clip_at timestamptz,
    add column if not exists long_first_fill_price numeric,
    add column if not exists long_breakeven_done boolean,
    add column if not exists short_status text,
    add column if not exists short_clips_filled integer,
    add column if not exists short_last_clip_price numeric,
    add column if not exists short_last_clip_at timestamptz,
    add column if not exists short_first_fill_price numeric,
    add column if not exists short_breakeven_done boolean;

do $$
begin
    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
            and table_name = 'dca_playbooks'
            and column_name = 'side'
    ) and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
            and table_name = 'dca_playbooks'
            and column_name = 'status'
    ) then
        update public.dca_playbooks
        set
            direction = coalesce(direction, side, 'long'),
            long_status = coalesce(
                long_status,
                case when side is distinct from 'short' then status end,
                'idle'
            ),
            short_status = coalesce(
                short_status,
                case when side = 'short' then status end,
                'idle'
            ),
            long_clips_filled = coalesce(
                long_clips_filled,
                case when side is distinct from 'short' then clips_filled end,
                0
            ),
            short_clips_filled = coalesce(
                short_clips_filled,
                case when side = 'short' then clips_filled end,
                0
            ),
            long_last_clip_price = coalesce(
                long_last_clip_price,
                case when side is distinct from 'short' then last_clip_price end
            ),
            short_last_clip_price = coalesce(
                short_last_clip_price,
                case when side = 'short' then last_clip_price end
            ),
            long_last_clip_at = coalesce(
                long_last_clip_at,
                case when side is distinct from 'short' then last_clip_at end
            ),
            short_last_clip_at = coalesce(
                short_last_clip_at,
                case when side = 'short' then last_clip_at end
            );
    end if;
end $$;

update public.dca_playbooks
set
    direction = coalesce(direction, 'long'),
    start_kind = coalesce(start_kind, 'immediate'),
    dca_mode = coalesce(dca_mode, 'position'),
    size_multiplier = coalesce(size_multiplier, 1),
    deviation_multiplier = coalesce(deviation_multiplier, 1),
    take_profit_basis = coalesce(take_profit_basis, 'average'),
    stop_loss_basis = coalesce(stop_loss_basis, 'average'),
    long_indicator_true = coalesce(long_indicator_true, false),
    short_indicator_true = coalesce(short_indicator_true, false),
    long_status = coalesce(long_status, 'idle'),
    long_clips_filled = coalesce(long_clips_filled, 0),
    long_breakeven_done = coalesce(long_breakeven_done, false),
    short_status = coalesce(short_status, 'idle'),
    short_clips_filled = coalesce(short_clips_filled, 0),
    short_breakeven_done = coalesce(short_breakeven_done, false);

alter table public.dca_playbooks
    alter column direction set default 'long',
    alter column direction set not null,
    alter column start_kind set default 'immediate',
    alter column start_kind set not null,
    alter column dca_mode set default 'position',
    alter column dca_mode set not null,
    alter column size_multiplier set default 1,
    alter column size_multiplier set not null,
    alter column deviation_multiplier set default 1,
    alter column deviation_multiplier set not null,
    alter column take_profit_basis set default 'average',
    alter column take_profit_basis set not null,
    alter column stop_loss_basis set default 'average',
    alter column stop_loss_basis set not null,
    alter column long_indicator_true set default false,
    alter column long_indicator_true set not null,
    alter column short_indicator_true set default false,
    alter column short_indicator_true set not null,
    alter column long_status set default 'idle',
    alter column long_status set not null,
    alter column long_clips_filled set default 0,
    alter column long_clips_filled set not null,
    alter column long_breakeven_done set default false,
    alter column long_breakeven_done set not null,
    alter column short_status set default 'idle',
    alter column short_status set not null,
    alter column short_clips_filled set default 0,
    alter column short_clips_filled set not null,
    alter column short_breakeven_done set default false,
    alter column short_breakeven_done set not null;

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_direction_check,
    drop constraint if exists dca_playbooks_start_kind_check,
    drop constraint if exists dca_playbooks_dca_mode_check,
    drop constraint if exists dca_playbooks_take_profit_basis_check,
    drop constraint if exists dca_playbooks_stop_loss_basis_check,
    drop constraint if exists dca_playbooks_long_status_check,
    drop constraint if exists dca_playbooks_short_status_check,
    drop constraint if exists dca_playbooks_account_id_key,
    drop constraint if exists dca_playbooks_account_id_symbol_side_key,
    drop constraint if exists dca_playbooks_account_id_symbol_key;

alter table public.dca_playbooks
    add constraint dca_playbooks_direction_check
        check (direction in ('long', 'short', 'both')),
    add constraint dca_playbooks_start_kind_check
        check (start_kind in ('immediate', 'price', 'webhook', 'indicator')),
    add constraint dca_playbooks_dca_mode_check
        check (dca_mode in ('position', 'order')),
    add constraint dca_playbooks_take_profit_basis_check
        check (take_profit_basis in ('average', 'first_entry')),
    add constraint dca_playbooks_stop_loss_basis_check
        check (stop_loss_basis in ('average', 'first_entry')),
    add constraint dca_playbooks_long_status_check
        check (long_status in ('idle', 'armed', 'stop_adding')),
    add constraint dca_playbooks_short_status_check
        check (short_status in ('idle', 'armed', 'stop_adding')),
    add constraint dca_playbooks_account_id_symbol_key unique (account_id, symbol);

drop index if exists public.dca_playbooks_status_idx;

alter table public.dca_playbooks
    drop column if exists side,
    drop column if exists status,
    drop column if exists clips_filled,
    drop column if exists last_clip_price,
    drop column if exists last_clip_at;

create index if not exists dca_playbooks_status_idx
    on public.dca_playbooks (long_status, short_status);

create index if not exists dca_playbooks_webhook_idx
    on public.dca_playbooks (webhook_id);

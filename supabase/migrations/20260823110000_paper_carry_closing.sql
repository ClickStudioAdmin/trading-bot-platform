-- Closing = unwind in progress. Same open-row fields until the last clip.

alter table public.paper_carries
    drop constraint if exists paper_carries_status_check;

alter table public.paper_carries
    add constraint paper_carries_status_check
    check (status in ('open', 'closing', 'closed'));

alter table public.paper_carries
    drop constraint if exists paper_carries_check;

alter table public.paper_carries
    add constraint paper_carries_state_check
    check (
        (
            status in ('open', 'closing')
            and exit_basis is null
            and closed_at is null
            and realized_usdt is null
        )
        or (
            status = 'closed'
            and exit_basis is not null
            and closed_at is not null
            and realized_usdt is not null
        )
    );

alter table public.paper_carries
    drop constraint if exists paper_carries_close_reason_check;

alter table public.paper_carries
    add constraint paper_carries_close_reason_check
    check (
        close_reason is null
        or close_reason in (
            'dte',
            'mark_apr',
            'take_profit',
            'stop_loss',
            'unwind'
        )
    );

alter table public.paper_orders
    drop constraint if exists paper_orders_trigger_reason_check;

alter table public.paper_orders
    add constraint paper_orders_trigger_reason_check
    check (
        trigger_reason is null
        or trigger_reason in (
            'dte',
            'mark_apr',
            'take_profit',
            'stop_loss',
            'unwind'
        )
    );

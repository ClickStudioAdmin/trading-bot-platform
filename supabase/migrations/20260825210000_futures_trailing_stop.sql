-- Trailing stop on Futures positions and working limits.

alter table public.futures_positions
    add column trailing_stop numeric check (
        trailing_stop is null or trailing_stop > 0
    ),
    add column trailing_active numeric check (
        trailing_active is null or trailing_active > 0
    ),
    add column trailing_peak numeric check (
        trailing_peak is null or trailing_peak > 0
    );

alter table public.futures_working_orders
    add column trailing_stop numeric check (
        trailing_stop is null or trailing_stop > 0
    ),
    add column trailing_active numeric check (
        trailing_active is null or trailing_active > 0
    );

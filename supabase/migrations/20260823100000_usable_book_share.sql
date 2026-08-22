-- Per-user share of the in-range top 5 book used as usable book value.

alter table public.paper_engine_settings
    add column usable_book_share numeric not null default 0.25
        check (usable_book_share > 0 and usable_book_share <= 1);

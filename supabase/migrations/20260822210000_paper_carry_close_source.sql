-- How a paper carry was closed. Open rows stay null.

alter table public.paper_carries
    add column close_source text
        check (close_source is null or close_source in ('manual', 'engine')),
    add column close_reason text
        check (
            close_reason is null
            or close_reason in ('dte', 'mark_apr', 'take_profit', 'stop_loss')
        );

update public.paper_carries
set close_source = 'manual'
where status = 'closed'
  and close_source is null;

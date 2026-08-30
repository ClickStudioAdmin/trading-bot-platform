-- Draft runs from a desk bot (no library template required).
-- source_template_id is the library row they loaded from, if any.
-- template_id is set later when they attach or save as a template.

alter table public.backtest_runs
    drop constraint if exists backtest_runs_status_check;

alter table public.backtest_runs
    add constraint backtest_runs_status_check
    check (status in ('draft', 'queued', 'running', 'done', 'failed', 'cancelled'));

alter table public.backtest_runs
    add column if not exists source_template_id uuid
        references public.automation_templates (id) on delete set null;

create index if not exists backtest_runs_source_template_idx
    on public.backtest_runs (source_template_id, created_at desc);

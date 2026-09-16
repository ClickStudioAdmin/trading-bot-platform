-- Retry incomplete mail. Existing rows are treated as already completed.
alter table public.email_dispatches
    add column if not exists completed_at timestamptz;

update public.email_dispatches
    set completed_at = sent_at
    where completed_at is null;

drop function if exists public.claim_email_dispatch(text, text);

create function public.claim_email_dispatch(
    p_template text,
    p_entity_key text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    v_completed timestamptz;
    inserted integer;
begin
    if coalesce(trim(p_template), '') = ''
       or coalesce(trim(p_entity_key), '') = '' then
        return 'done';
    end if;

    insert into public.email_dispatches (template, entity_key)
    values (trim(p_template), trim(p_entity_key))
    on conflict (template, entity_key) do nothing;

    get diagnostics inserted = row_count;
    if inserted > 0 then
        return 'new';
    end if;

    select completed_at
      into v_completed
      from public.email_dispatches
     where template = trim(p_template)
       and entity_key = trim(p_entity_key);

    if v_completed is null then
        return 'retry';
    end if;

    return 'done';
end;
$$;

create function public.complete_email_dispatch(
    p_template text,
    p_entity_key text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if coalesce(trim(p_template), '') = ''
       or coalesce(trim(p_entity_key), '') = '' then
        return;
    end if;

    update public.email_dispatches
       set completed_at = now()
     where template = trim(p_template)
       and entity_key = trim(p_entity_key)
       and completed_at is null;
end;
$$;

revoke all on function public.claim_email_dispatch(text, text) from public;
revoke all on function public.complete_email_dispatch(text, text) from public;

grant execute on function public.claim_email_dispatch(text, text) to service_role;
grant execute on function public.complete_email_dispatch(text, text) to service_role;

-- Develop / local John affiliate demo (5×5 tree under the first admin).
-- Idempotent. Password for every John is 55555555 (sign-in needs 8 characters).
-- Do not take these rows to production: call public.clear_john_affiliate_demo()
-- before merging this file to main, or add a follow-up clear migration.

create or replace function public.clear_john_affiliate_demo()
returns integer
language plpgsql
security definer
set search_path = public
as $clear$
declare
    removed integer := 0;
begin
    delete from public.membership_payout_items
    where payout_id in (
        select id
        from public.membership_payouts
        where external_id like 'john-demo:%'
           or user_id in (
               select user_id
               from public.members
               where email ilike '%@tbp-john-demo.invalid'
           )
    );

    delete from public.membership_payouts
    where external_id like 'john-demo:%'
       or user_id in (
           select user_id
           from public.members
           where email ilike '%@tbp-john-demo.invalid'
       );

    delete from public.membership_wallet_entries
    where external_id like 'john-demo:%'
       or user_id in (
           select user_id
           from public.members
           where email ilike '%@tbp-john-demo.invalid'
       );

    delete from public.membership_commissions
    where invoice_id in (
        select id
        from public.membership_invoices
        where external_id like 'john-demo:%'
           or user_id in (
               select user_id
               from public.members
               where email ilike '%@tbp-john-demo.invalid'
           )
      )
       or earner_user_id in (
           select user_id
           from public.members
           where email ilike '%@tbp-john-demo.invalid'
       )
       or source_user_id in (
           select user_id
           from public.members
           where email ilike '%@tbp-john-demo.invalid'
       );

    delete from public.membership_invoices
    where external_id like 'john-demo:%'
       or user_id in (
           select user_id
           from public.members
           where email ilike '%@tbp-john-demo.invalid'
       );

    delete from public.membership_referrals
    where user_id in (
        select user_id
        from public.members
        where email ilike '%@tbp-john-demo.invalid'
    );

    delete from public.membership_affiliate_links
    where slug ilike 'jdem%'
       or user_id in (
           select user_id
           from public.members
           where email ilike '%@tbp-john-demo.invalid'
       );

    delete from public.membership_affiliate_campaigns
    where name ilike 'John demo%'
       or user_id in (
           select user_id
           from public.members
           where email ilike '%@tbp-john-demo.invalid'
       );

    delete from public.membership_referral_codes
    where user_id in (
        select user_id
        from public.members
        where email ilike '%@tbp-john-demo.invalid'
    );

    delete from public.trader_profiles
    where user_id in (
        select user_id
        from public.members
        where email ilike '%@tbp-john-demo.invalid'
    );

    delete from public.members
    where email ilike '%@tbp-john-demo.invalid';
    get diagnostics removed = row_count;

    return removed;
end;
$clear$;

revoke all on function public.clear_john_affiliate_demo() from public;
revoke all on function public.clear_john_affiliate_demo() from anon, authenticated;

do $seed$
declare
    admin_id uuid;
    admin_code text;
    free_id uuid;
    plus_id uuid;
    pro_id uuid;
    rates_zero boolean;
    campaign_youtube uuid := md5('tbp-john-demo:campaign:youtube')::uuid;
    campaign_twitter uuid := md5('tbp-john-demo:campaign:twitter')::uuid;
    campaign_archived uuid := md5('tbp-john-demo:campaign:archived')::uuid;
    campaign_john_one uuid := md5('tbp-john-demo:campaign:john-1')::uuid;
    link_home uuid := md5('tbp-john-demo:link:home')::uuid;
    link_affiliates uuid := md5('tbp-john-demo:link:affiliates')::uuid;
    link_archived uuid := md5('tbp-john-demo:link:archived')::uuid;
    link_john_one uuid := md5('tbp-john-demo:link:john-1')::uuid;
    john_one uuid := md5('tbp-john-demo:1')::uuid;
    john_two uuid := md5('tbp-john-demo:2')::uuid;
    john_three uuid := md5('tbp-john-demo:3')::uuid;
    john_four uuid := md5('tbp-john-demo:4')::uuid;
    payout_admin_requested uuid := md5('tbp-john-demo:payout:admin:requested')::uuid;
    payout_admin_approved uuid := md5('tbp-john-demo:payout:admin:approved')::uuid;
    payout_admin_rejected uuid := md5('tbp-john-demo:payout:admin:rejected')::uuid;
    payout_admin_paid uuid := md5('tbp-john-demo:payout:admin:paid')::uuid;
    payout_john1_requested uuid := md5('tbp-john-demo:payout:john-1:requested')::uuid;
    payout_john2_approved uuid := md5('tbp-john-demo:payout:john-2:approved')::uuid;
    payout_john3_rejected uuid := md5('tbp-john-demo:payout:john-3:rejected')::uuid;
    payout_john4_paid uuid := md5('tbp-john-demo:payout:john-4:paid')::uuid;
    chain_slug text;
    password_hash text := 'scrypt$JohnDemoSalt0001$Lb8QIFMYlnaW1fVJJWGQLjqUvtBJkNA3SE0-20rlsdo';
    inserted integer;
begin
    if exists (
        select 1
        from public.members
        where email ilike '%@tbp-john-demo.invalid'
    ) then
        raise notice 'John affiliate demo already present; skipping';
        return;
    end if;

    select user_id
    into admin_id
    from public.members
    where role = 'admin'
      and status = 'active'
      and lower(email) = 'click.studio.admin@gmail.com'
    limit 1;

    if admin_id is null then
        select user_id
        into admin_id
        from public.members
        where role = 'admin'
          and status = 'active'
        order by created_at
        limit 1;
    end if;

    if admin_id is null then
        raise exception 'John affiliate demo needs an active admin member';
    end if;

    select id into free_id from public.membership_plans where slug = 'free';
    select id into plus_id from public.membership_plans where slug = 'plus';
    select id into pro_id from public.membership_plans where slug = 'pro';
    plus_id := coalesce(plus_id, free_id);
    pro_id := coalesce(pro_id, plus_id);

    if free_id is null then
        raise exception 'John affiliate demo needs a Free membership plan';
    end if;

    select
        affiliate_default_l1_pct = 0
        and affiliate_default_l2_pct = 0
        and affiliate_default_l3_pct = 0
        and affiliate_default_l4_pct = 0
        and affiliate_default_l5_pct = 0
    into rates_zero
    from public.platform_settings
    where id = 'tbp';

    if rates_zero is null then
        raise exception 'John affiliate demo needs platform_settings row tbp';
    end if;

    update public.platform_settings
    set
        affiliate_max_depth = 5,
        affiliate_default_l1_pct = case when rates_zero then 10 else affiliate_default_l1_pct end,
        affiliate_default_l2_pct = case when rates_zero then 5 else affiliate_default_l2_pct end,
        affiliate_default_l3_pct = case when rates_zero then 3 else affiliate_default_l3_pct end,
        affiliate_default_l4_pct = case when rates_zero then 2 else affiliate_default_l4_pct end,
        affiliate_default_l5_pct = case when rates_zero then 1 else affiliate_default_l5_pct end
    where id = 'tbp';

    drop table if exists john_demo_people;
    create temporary table john_demo_people (
        path int[] primary key,
        lvl int not null,
        user_id uuid not null unique,
        parent_user_id uuid not null,
        email text not null,
        display_name text not null,
        code text not null unique,
        paid boolean not null,
        platform_member boolean not null
    ) on commit drop;

    insert into john_demo_people (
        path,
        lvl,
        user_id,
        parent_user_id,
        email,
        display_name,
        code,
        paid,
        platform_member
    )
    with recursive tree as (
        select
            array[slot]::int[] as path,
            1 as lvl
        from generate_series(1, 5) as slot
        union all
        select
            t.path || slot,
            t.lvl + 1
        from tree t
        cross join generate_series(1, 5) as slot
        where t.lvl < 5
    )
    select
        t.path,
        t.lvl,
        md5('tbp-john-demo:' || array_to_string(t.path, '-'))::uuid,
        case
            when t.lvl = 1 then admin_id
            else md5(
                'tbp-john-demo:' || array_to_string(t.path[1:t.lvl - 1], '-')
            )::uuid
        end,
        'john.' || array_to_string(t.path, '-') || '@tbp-john-demo.invalid',
        'John ' || array_to_string(t.path, '-'),
        'JHN' || translate(array_to_string(t.path, ''), '12345', 'ABCDE'),
        t.path[t.lvl] in (1, 2),
        t.path[t.lvl] <> 5
    from tree t;

    insert into public.members (
        user_id,
        email,
        name,
        role,
        status,
        platform_member,
        plan_id,
        last_enroll_plan_id,
        subscription_status,
        password_hash
    )
    select
        p.user_id,
        p.email,
        p.display_name,
        'member',
        'active',
        p.platform_member,
        case
            when p.paid and p.lvl % 2 = 0 then pro_id
            when p.paid then plus_id
            else free_id
        end,
        case
            when p.paid and p.lvl % 2 = 0 then pro_id
            when p.paid then plus_id
            else free_id
        end,
        case when p.paid then 'active' else 'none' end,
        password_hash
    from john_demo_people p;
    get diagnostics inserted = row_count;

    if inserted <> 3905 then
        raise exception
            'John affiliate demo expected 3905 members, inserted %',
            inserted;
    end if;

    insert into public.trader_profiles (user_id, alias, bio)
    select
        p.user_id,
        p.display_name,
        'John affiliate demo. Safe to delete.'
    from john_demo_people p;

    begin
        insert into public.membership_referral_codes (user_id, code)
        values (admin_id, 'JHNADMN');
    exception
        when unique_violation then
            null;
    end;

    select code
    into admin_code
    from public.membership_referral_codes
    where user_id = admin_id;

    if admin_code is null then
        insert into public.membership_referral_codes (user_id, code)
        values (admin_id, 'JHNADM0');
        admin_code := 'JHNADM0';
    end if;

    insert into public.membership_referral_codes (user_id, code)
    select p.user_id, p.code
    from john_demo_people p;

    insert into public.membership_affiliate_campaigns (id, user_id, name)
    values
        (campaign_youtube, admin_id, 'John demo YouTube'),
        (campaign_twitter, admin_id, 'John demo Twitter'),
        (campaign_archived, admin_id, 'John demo Archived'),
        (campaign_john_one, john_one, 'John demo John 1');

    insert into public.membership_affiliate_links (
        id,
        user_id,
        campaign_id,
        slug,
        name,
        landing
    )
    values
        (
            link_home,
            admin_id,
            campaign_youtube,
            'JDEMHOME1',
            'John demo home',
            'home'
        ),
        (
            link_affiliates,
            admin_id,
            campaign_twitter,
            'JDEMAFF1',
            'John demo affiliates',
            'affiliates'
        ),
        (
            link_archived,
            admin_id,
            campaign_archived,
            'JDEMOLD1',
            'John demo old link',
            'home'
        ),
        (
            link_john_one,
            john_one,
            campaign_john_one,
            'JDEMJ1A',
            'John demo John 1 link',
            'home'
        );

    update public.membership_affiliate_campaigns
    set archived_at = now() - interval '4 days'
    where id = campaign_archived;

    update public.membership_affiliate_links
    set archived_at = now() - interval '3 days'
    where id = link_archived;

    insert into public.membership_referrals (
        user_id,
        referrer_user_id,
        code,
        attributed_at,
        first_paid_at,
        campaign_id,
        link_id
    )
    select
        p.user_id,
        p.parent_user_id,
        case
            when p.lvl = 1 then admin_code
            else parent.code
        end,
        now() - ((20 - p.lvl) * interval '1 day'),
        case
            when p.paid then now() - ((10 - p.lvl) * interval '1 day')
            else null
        end,
        case
            when p.lvl = 1 and p.path[1] = 1 then campaign_youtube
            when p.lvl = 1 and p.path[1] = 2 then campaign_twitter
            when p.lvl >= 2 and p.path[2] = 1 then campaign_john_one
            else null
        end,
        case
            when p.lvl = 1 and p.path[1] = 1 then link_home
            when p.lvl = 1 and p.path[1] = 2 then link_affiliates
            when p.lvl >= 2 and p.path[2] = 1 then link_john_one
            else null
        end
    from john_demo_people p
    left join john_demo_people parent on parent.user_id = p.parent_user_id;

    insert into public.membership_invoices (
        id,
        user_id,
        plan_id,
        method,
        external_id,
        amount_usd,
        status,
        created_at
    )
    select
        md5('tbp-john-demo:invoice:' || array_to_string(p.path, '-'))::uuid,
        p.user_id,
        case when p.lvl % 2 = 0 then pro_id else plus_id end,
        'wallet',
        'john-demo:invoice:' || p.user_id::text,
        29 + (((row_number() over (order by p.path)) - 1) % 3) * 10,
        'paid',
        now() - interval '8 days'
    from john_demo_people p
    where p.paid
      and (
          not exists (
              select 1
              from unnest(p.path) as n
              where n <> 1
          )
          or p.lvl = 1
          or (p.lvl <= 3 and p.path[p.lvl] = 2)
      );

    insert into public.membership_commissions (
        id,
        earner_user_id,
        source_user_id,
        invoice_id,
        rate_plan_id,
        campaign_id,
        link_id,
        level,
        rate_pct,
        amount_usd,
        status,
        hold_until,
        created_at
    )
    select
        md5(
            'tbp-john-demo:commission:'
            || array_to_string(p.path, '-')
            || ':'
            || hop::text
        )::uuid,
        case
            when hop = p.lvl then admin_id
            else md5(
                'tbp-john-demo:'
                || array_to_string(p.path[1:p.lvl - hop], '-')
            )::uuid
        end,
        p.user_id,
        md5('tbp-john-demo:invoice:' || array_to_string(p.path, '-'))::uuid,
        plus_id,
        case when p.lvl = 1 then campaign_youtube else null end,
        case when p.lvl = 1 then link_home else null end,
        hop,
        (array[10, 5, 3, 2, 1])[hop],
        round(
            inv.amount_usd * (array[10, 5, 3, 2, 1])[hop] / 100.0,
            2
        ),
        (array['pending', 'payable', 'paid', 'void'])[
            ((hop + p.lvl) % 4) + 1
        ],
        case
            when (array['pending', 'payable', 'paid', 'void'])[
                ((hop + p.lvl) % 4) + 1
            ] = 'pending' then now() + interval '12 days'
            else now() - interval '2 days'
        end,
        now() - interval '7 days'
    from john_demo_people p
    join public.membership_invoices inv
        on inv.id = md5(
            'tbp-john-demo:invoice:' || array_to_string(p.path, '-')
        )::uuid
    cross join lateral generate_series(1, p.lvl) as hops(hop);

    select coalesce(
        (
            select slug
            from public.membership_billing_chains
            where affiliate_payouts is true
            order by sort_order
            limit 1
        ),
        (
            select slug
            from public.membership_billing_chains
            order by sort_order
            limit 1
        ),
        'arbitrum'
    )
    into chain_slug;

    insert into public.membership_payouts (
        id,
        user_id,
        method,
        amount_usd,
        status,
        network,
        address,
        external_id,
        created_at,
        paid_at
    )
    values
        (
            payout_admin_requested,
            admin_id,
            'usdt',
            40,
            'requested',
            chain_slug,
            '0x5555555555555555555555555555555555555555',
            'john-demo:payout:requested:' || payout_admin_requested::text,
            now() - interval '3 days',
            null
        ),
        (
            payout_admin_approved,
            admin_id,
            'usdt',
            25,
            'approved',
            chain_slug,
            '0x5555555555555555555555555555555555555555',
            'john-demo:payout:approved:' || payout_admin_approved::text,
            now() - interval '3 days',
            null
        ),
        (
            payout_admin_rejected,
            admin_id,
            'usdt',
            15,
            'rejected',
            chain_slug,
            '0x5555555555555555555555555555555555555555',
            'john-demo:payout:rejected:' || payout_admin_rejected::text,
            now() - interval '3 days',
            null
        ),
        (
            payout_admin_paid,
            admin_id,
            'usdt',
            55,
            'paid',
            chain_slug,
            '0x5555555555555555555555555555555555555555',
            'john-demo:payout:paid:' || payout_admin_paid::text,
            now() - interval '3 days',
            now() - interval '1 day'
        ),
        (
            payout_john1_requested,
            john_one,
            'usdt',
            20,
            'requested',
            chain_slug,
            '0x5555555555555555555555555555555555555555',
            'john-demo:payout:requested:' || payout_john1_requested::text,
            now() - interval '3 days',
            null
        ),
        (
            payout_john2_approved,
            john_two,
            'usdt',
            18,
            'approved',
            chain_slug,
            '0x5555555555555555555555555555555555555555',
            'john-demo:payout:approved:' || payout_john2_approved::text,
            now() - interval '3 days',
            null
        ),
        (
            payout_john3_rejected,
            john_three,
            'usdt',
            12,
            'rejected',
            chain_slug,
            '0x5555555555555555555555555555555555555555',
            'john-demo:payout:rejected:' || payout_john3_rejected::text,
            now() - interval '3 days',
            null
        ),
        (
            payout_john4_paid,
            john_four,
            'usdt',
            30,
            'paid',
            chain_slug,
            '0x5555555555555555555555555555555555555555',
            'john-demo:payout:paid:' || payout_john4_paid::text,
            now() - interval '3 days',
            now() - interval '2 days'
        );

    insert into public.membership_payout_items (payout_id, commission_id)
    select payout_admin_requested, c.id
    from public.membership_commissions c
    where c.earner_user_id = admin_id
      and c.status = 'payable'
      and c.invoice_id in (
          select id
          from public.membership_invoices
          where external_id like 'john-demo:%'
      )
    order by c.id
    limit 1;

    insert into public.membership_payout_items (payout_id, commission_id)
    select payout_admin_approved, c.id
    from public.membership_commissions c
    where c.earner_user_id = admin_id
      and c.status = 'payable'
      and c.invoice_id in (
          select id
          from public.membership_invoices
          where external_id like 'john-demo:%'
      )
      and not exists (
          select 1
          from public.membership_payout_items i
          where i.commission_id = c.id
      )
    order by c.id
    limit 1;

    insert into public.membership_payout_items (payout_id, commission_id)
    select payout_admin_paid, c.id
    from public.membership_commissions c
    where c.earner_user_id = admin_id
      and c.status = 'paid'
      and c.invoice_id in (
          select id
          from public.membership_invoices
          where external_id like 'john-demo:%'
      )
    order by c.id
    limit 2;

    insert into public.membership_payout_items (payout_id, commission_id)
    select payout_john1_requested, c.id
    from public.membership_commissions c
    where c.earner_user_id = john_one
      and c.status = 'payable'
      and c.invoice_id in (
          select id
          from public.membership_invoices
          where external_id like 'john-demo:%'
      )
    order by c.id
    limit 1;

    insert into public.membership_wallet_entries (
        user_id,
        book,
        kind,
        amount_usd,
        external_id,
        memo
    )
    values
        (
            admin_id,
            'affiliate',
            'withdraw',
            40,
            'john-demo:wallet:' || payout_admin_requested::text,
            'John demo USDT withdraw'
        ),
        (
            admin_id,
            'affiliate',
            'withdraw',
            25,
            'john-demo:wallet:' || payout_admin_approved::text,
            'John demo USDT withdraw'
        ),
        (
            admin_id,
            'affiliate',
            'adjust',
            15,
            'john-demo:wallet:' || payout_admin_rejected::text,
            'John demo reject'
        ),
        (
            admin_id,
            'affiliate',
            'withdraw',
            55,
            'john-demo:wallet:' || payout_admin_paid::text,
            'John demo USDT withdraw'
        ),
        (
            john_one,
            'affiliate',
            'withdraw',
            20,
            'john-demo:wallet:' || payout_john1_requested::text,
            'John demo USDT withdraw'
        ),
        (
            john_two,
            'affiliate',
            'withdraw',
            18,
            'john-demo:wallet:' || payout_john2_approved::text,
            'John demo USDT withdraw'
        ),
        (
            john_three,
            'affiliate',
            'adjust',
            12,
            'john-demo:wallet:' || payout_john3_rejected::text,
            'John demo reject'
        ),
        (
            john_four,
            'affiliate',
            'withdraw',
            30,
            'john-demo:wallet:' || payout_john4_paid::text,
            'John demo USDT withdraw'
        );

    raise notice 'John affiliate demo inserted 3905 members under %', admin_id;
end;
$seed$;

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_indicator_timeframe_check;

alter table public.dca_playbooks
    add constraint dca_playbooks_indicator_timeframe_check
        check (
            indicator_timeframe is null
            or indicator_timeframe in (
                '5',
                '15',
                '30',
                '60',
                '120',
                '240',
                '360',
                '720',
                'D'
            )
        );

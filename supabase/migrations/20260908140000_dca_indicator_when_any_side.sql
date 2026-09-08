-- When is now the real condition on either side. Old Short MACD stored
-- cross_gte / gte and the engine flipped by side; persist that meaning.

update public.dca_playbooks
set indicator_compare = case
    when indicator_compare = 'cross_gte' then 'cross_lte'
    when indicator_compare = 'gte' then 'lte'
    else indicator_compare
end
where direction = 'short'
  and indicator_kind = 'macd'
  and indicator_compare in ('cross_gte', 'gte');

update public.dca_playbooks
set short_indicator_compare = case
    when short_indicator_compare = 'cross_gte' then 'cross_lte'
    when short_indicator_compare = 'gte' then 'lte'
    else short_indicator_compare
end
where short_indicator_kind = 'macd'
  and short_indicator_compare in ('cross_gte', 'gte');


create type public.credit_tier as enum ('registered','basic','pro','quantum');

create table public.user_credits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  used integer not null default 0,
  reset_at timestamptz not null default (now() + interval '1 day'),
  paid_tier public.credit_tier not null default 'registered',
  updated_at timestamptz not null default now()
);

grant select on public.user_credits to authenticated;
grant all on public.user_credits to service_role;

alter table public.user_credits enable row level security;

create policy "Users read own credits"
  on public.user_credits for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.consume_credits(_cost integer)
returns table(allowed boolean, used integer, "limit" integer, tier public.credit_tier)
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _row public.user_credits;
  _limit integer;
begin
  if _uid is null then
    raise exception 'not authenticated';
  end if;
  if _cost is null or _cost < 1 or _cost > 100 then
    raise exception 'invalid cost';
  end if;

  insert into public.user_credits(user_id) values (_uid)
  on conflict (user_id) do nothing;

  select * into _row from public.user_credits where user_id = _uid for update;

  if _row.reset_at <= now() then
    update public.user_credits
      set used = 0, reset_at = now() + interval '1 day', updated_at = now()
      where user_id = _uid
      returning * into _row;
  end if;

  _limit := case _row.paid_tier
    when 'registered' then 15
    when 'basic' then 60
    when 'pro' then 200
    when 'quantum' then 99999
  end;

  if _row.used + _cost > _limit then
    return query select false, _row.used, _limit, _row.paid_tier;
    return;
  end if;

  update public.user_credits
    set used = used + _cost, updated_at = now()
    where user_id = _uid
    returning * into _row;

  return query select true, _row.used, _limit, _row.paid_tier;
end;
$$;

revoke all on function public.consume_credits(integer) from public;
grant execute on function public.consume_credits(integer) to authenticated;

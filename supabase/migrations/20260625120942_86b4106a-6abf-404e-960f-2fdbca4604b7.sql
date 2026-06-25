
-- Drop old version callable by authenticated/anon
DROP FUNCTION IF EXISTS public.consume_credits(integer);

CREATE OR REPLACE FUNCTION public.consume_credits(_user_id uuid, _cost integer)
RETURNS TABLE(allowed boolean, used integer, "limit" integer, tier public.credit_tier)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  _row public.user_credits;
  _limit integer;
begin
  if _user_id is null then
    raise exception 'user_id required';
  end if;
  if _cost is null or _cost < 1 or _cost > 100 then
    raise exception 'invalid cost';
  end if;

  insert into public.user_credits(user_id) values (_user_id)
  on conflict (user_id) do nothing;

  select * into _row from public.user_credits where user_id = _user_id for update;

  if _row.reset_at <= now() then
    update public.user_credits
      set used = 0, reset_at = now() + interval '1 day', updated_at = now()
      where user_id = _user_id
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
    where user_id = _user_id
    returning * into _row;

  return query select true, _row.used, _limit, _row.paid_tier;
end;
$$;

REVOKE ALL ON FUNCTION public.consume_credits(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_credits(uuid, integer) TO service_role;

create or replace function public.can_buy_extra_seats(_circle_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_plan text;
  v_comped timestamptz;
  v_source text;
begin
  select owner_id into v_owner from public.circles where id = _circle_id;
  if v_owner is null then
    return false;
  end if;

  select plan, comped_by_admin_at, source
    into v_plan, v_comped, v_source
    from public.user_plans
    where user_id = v_owner;

  return v_plan in ('family','extended','enterprise','founder')
      or v_comped is not null
      or v_source in ('admin_comp','apple','enterprise','google');
end;
$$;

grant execute on function public.can_buy_extra_seats(uuid) to authenticated;
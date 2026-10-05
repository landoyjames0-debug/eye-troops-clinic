alter table public.users
  add column if not exists job_title text,
  add column if not exists phone text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_phone_format_check'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_phone_format_check
      check (phone is null or phone ~ '^[+]?[0-9]{10,15}$');
  end if;
end;
$$;

grant update (job_title, phone) on public.users to authenticated;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function public.current_user_is_admin() from public;
grant execute on function public.current_user_is_admin() to authenticated;

create policy "admins read all user profiles" on public.users
  for select to authenticated
  using (public.current_user_is_admin());
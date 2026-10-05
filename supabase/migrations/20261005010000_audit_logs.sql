-- Audit log schema and rollout plan
--
-- 1. Create the audit log table to record security and operational events.
-- 2. Add a helper function so the app can write audit entries consistently.
-- 3. Protect reads with admin-only access and only allow authenticated users to
--    insert events that are tied to their own identity or admin operations.
-- 4. Add indexes for common filters used in patient, staff, and operational audits.

create extension if not exists pgcrypto;

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

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid null references auth.users(id) on delete set null,
  actor_role text not null default 'unknown' check (actor_role in ('admin', 'staff', 'system', 'patient', 'unknown')),
  action text not null,
  resource_type text not null,
  resource_id text null,
  description text not null default '',
  details jsonb not null default '{}'::jsonb,
  ip_address inet null,
  user_agent text null,
  request_path text null,
  status text not null default 'success' check (status in ('success', 'warning', 'failed')),
  severity text not null default 'info' check (severity in ('info', 'warning', 'error', 'critical')),
  created_by uuid null references public.users(id) on delete set null
);

create index if not exists idx_audit_logs_created_at_desc
  on public.audit_logs (created_at desc);

create index if not exists idx_audit_logs_actor_id
  on public.audit_logs (actor_id, created_at desc);

create index if not exists idx_audit_logs_resource
  on public.audit_logs (resource_type, resource_id, created_at desc);

create index if not exists idx_audit_logs_action
  on public.audit_logs (action, created_at desc);

create index if not exists idx_audit_logs_status
  on public.audit_logs (status, created_at desc);

create index if not exists idx_audit_logs_details
  on public.audit_logs using gin (details);

alter table public.audit_logs enable row level security;

grant select, insert on public.audit_logs to authenticated;

drop function if exists public.log_audit_event(
  p_action text,
  p_resource_type text,
  p_resource_id text,
  p_description text,
  p_details jsonb,
  p_status text,
  p_severity text,
  p_request_path text,
  p_ip_address inet,
  p_user_agent text
);

create or replace function public.log_audit_event(
  p_action text,
  p_resource_type text default 'system',
  p_resource_id text default null,
  p_description text default '',
  p_details jsonb default '{}'::jsonb,
  p_status text default 'success',
  p_severity text default 'info',
  p_request_path text default null,
  p_ip_address inet default null,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role text := 'unknown';
  v_id uuid;
begin
  if v_actor_id is not null then
    select role into v_actor_role
    from public.users
    where id = v_actor_id;
  end if;

  if v_actor_role is null then
    v_actor_role := 'unknown';
  end if;

  insert into public.audit_logs (
    actor_id,
    actor_role,
    action,
    resource_type,
    resource_id,
    description,
    details,
    ip_address,
    user_agent,
    request_path,
    status,
    severity,
    created_by
  )
  values (
    v_actor_id,
    v_actor_role,
    p_action,
    p_resource_type,
    p_resource_id,
    p_description,
    coalesce(p_details, '{}'::jsonb),
    p_ip_address,
    p_user_agent,
    p_request_path,
    p_status,
    p_severity,
    v_actor_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.log_audit_event(
  text,
  text,
  text,
  text,
  jsonb,
  text,
  text,
  text,
  inet,
  text
) to authenticated;

create policy "admins can read audit logs" on public.audit_logs
  for select to authenticated
  using (public.current_user_is_admin());

create policy "authenticated users can create own audit events" on public.audit_logs
  for insert to authenticated
  with check (
    actor_id = auth.uid()
    or public.current_user_is_admin()
  );

create policy "admins can update audit log rows" on public.audit_logs
  for update to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create policy "admins can delete audit log rows" on public.audit_logs
  for delete to authenticated
  using (public.current_user_is_admin());

-- Recommended rollout sequence for production:
-- 1. Apply this migration in Supabase.
-- 2. Add app-level audit calls from login, sign-out, patient record changes,
--    payment actions, follow-up status updates, and backup/restore operations.
-- 3. Add a retention job or archival policy after the go-live review.
-- 4. Confirm admin dashboard access, export workflow, and audit review process
--    before using live patient data.

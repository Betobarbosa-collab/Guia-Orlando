begin;

create schema if not exists guia_private;
revoke all on schema guia_private from public, anon, authenticated;

create table guia_private.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  revision integer not null default 0 check (revision >= 0),
  snapshot jsonb not null,
  updated_at timestamptz not null default now()
);
create table guia_private.members (
  trip_id uuid not null references guia_private.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (trip_id, user_id)
);
create index guia_members_user on guia_private.members(user_id);
create table guia_private.invites (
  code_hash bytea primary key,
  trip_id uuid not null references guia_private.trips(id) on delete cascade,
  email text not null,
  expires_at timestamptz not null
);
create unique index guia_invite_email on guia_private.invites(trip_id, email);
create table guia_private.route_usage (
  user_id uuid primary key references auth.users(id) on delete cascade,
  day date not null,
  calls integer not null check (calls > 0)
);
alter table guia_private.trips enable row level security;
alter table guia_private.members enable row level security;
alter table guia_private.invites enable row level security;
alter table guia_private.route_usage enable row level security;

create function guia_private.valid_snapshot(p_snapshot jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(
    jsonb_typeof(p_snapshot) = 'object'
    and octet_length(p_snapshot::text) <= 800000
    and jsonb_typeof(p_snapshot->'trip') = 'object'
    and jsonb_typeof(p_snapshot->'agenda') = 'array'
    and jsonb_typeof(p_snapshot->'plan') = 'array'
    and jsonb_typeof(p_snapshot->'routeOrder') = 'object'
    and jsonb_typeof(p_snapshot->'people') = 'array'
    and jsonb_typeof(p_snapshot->'items') = 'array'
    and jsonb_typeof(p_snapshot->'done') = 'object',
    false
  );
$$;

create function guia_private.member_role(p_trip uuid, p_user uuid) returns text
language sql stable set search_path = '' as $$
  select case when t.owner_id = p_user then 'owner'
    when exists (select 1 from guia_private.members m where m.trip_id = t.id and m.user_id = p_user) then 'editor'
    end
  from guia_private.trips t where t.id = p_trip;
$$;

create function public.guia_create_trip(p_snapshot jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Sem sessão' using errcode = '42501'; end if;
  if not guia_private.valid_snapshot(p_snapshot) then raise exception 'Dados inválidos'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
  if (select count(*) from guia_private.trips where owner_id = v_user) >= 10 then raise exception 'Limite de viagens'; end if;
  insert into guia_private.trips (owner_id, snapshot) values (v_user, p_snapshot) returning id into v_id;
  return jsonb_build_object('id', v_id, 'revision', 0);
end;
$$;

create function public.guia_read_trip(p_trip uuid, p_revision integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_role text := guia_private.member_role(p_trip, auth.uid()); v_trip guia_private.trips;
begin
  if v_role is null then raise exception 'Acesso negado' using errcode = '42501'; end if;
  select * into v_trip from guia_private.trips where id = p_trip;
  return jsonb_build_object('id', p_trip, 'role', v_role, 'revision', v_trip.revision,
    'snapshot', case when v_trip.revision is distinct from p_revision then v_trip.snapshot else null end);
end;
$$;

create function public.guia_push_trip(p_trip uuid, p_revision integer, p_snapshot jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_trip guia_private.trips;
begin
  select * into v_trip from guia_private.trips where id = p_trip for update;
  if guia_private.member_role(p_trip, auth.uid()) is null then raise exception 'Acesso negado' using errcode = '42501'; end if;
  if not guia_private.valid_snapshot(p_snapshot) then raise exception 'Dados inválidos'; end if;
  if v_trip.snapshot = p_snapshot then return jsonb_build_object('revision', v_trip.revision); end if;
  if v_trip.revision is distinct from p_revision then
    return jsonb_build_object('revision', v_trip.revision, 'conflict', true, 'snapshot', v_trip.snapshot);
  end if;
  update guia_private.trips set snapshot = p_snapshot, revision = revision + 1, updated_at = now() where id = p_trip;
  return jsonb_build_object('revision', v_trip.revision + 1);
end;
$$;

create function public.guia_invite_trip(p_trip uuid, p_email text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_email text := lower(trim(p_email)); v_code text := replace(gen_random_uuid()::text, '-', '');
begin
  perform 1 from guia_private.trips where id = p_trip for update;
  if guia_private.member_role(p_trip, auth.uid()) is distinct from 'owner' then raise exception 'Acesso negado' using errcode = '42501'; end if;
  if v_email is null or length(v_email) > 254 or position('@' in v_email) < 2 then raise exception 'E-mail inválido'; end if;
  delete from guia_private.invites where trip_id = p_trip and expires_at <= now();
  if (select count(*) from guia_private.invites where trip_id = p_trip and email <> v_email) >= 30 then raise exception 'Limite de convites'; end if;
  insert into guia_private.invites values (sha256(convert_to(v_code, 'UTF8')), p_trip, v_email, now() + interval '72 hours')
    on conflict (trip_id, email) do update set code_hash = excluded.code_hash, expires_at = excluded.expires_at;
  return jsonb_build_object('code', v_code);
end;
$$;

create function public.guia_join_trip(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_trip uuid; v_user uuid := auth.uid(); v_email text := lower(auth.jwt()->>'email');
begin
  if v_user is null or v_email is null or p_code is null or p_code !~ '^[a-f0-9]{32}$' then raise exception 'Convite inválido' using errcode = '42501'; end if;
  select trip_id into v_trip from guia_private.invites
    where code_hash = sha256(convert_to(p_code, 'UTF8')) and email = v_email and expires_at > now();
  if v_trip is null then raise exception 'Convite inválido ou expirado' using errcode = '42501'; end if;
  perform 1 from guia_private.trips where id = v_trip for update;
  delete from guia_private.invites
    where code_hash = sha256(convert_to(p_code, 'UTF8')) and email = v_email and expires_at > now();
  if not found then raise exception 'Convite já usado ou expirado' using errcode = '42501'; end if;
  if (select count(*) from guia_private.members where trip_id = v_trip and user_id <> v_user) >= 30 then raise exception 'Limite de viajantes'; end if;
  insert into guia_private.members (trip_id, user_id) values (v_trip, v_user) on conflict do nothing;
  return public.guia_read_trip(v_trip, -1);
end;
$$;

create function public.guia_list_trips() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'title', t.snapshot #>> '{trip,title}',
    'role', guia_private.member_role(t.id, auth.uid())) order by t.updated_at desc), '[]'::jsonb)
  from guia_private.trips t where t.owner_id = auth.uid()
    or exists (select 1 from guia_private.members m where m.trip_id = t.id and m.user_id = auth.uid());
$$;

create function public.guia_trip_access(p_trip uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if guia_private.member_role(p_trip, auth.uid()) is distinct from 'owner' then raise exception 'Acesso negado' using errcode = '42501'; end if;
  return jsonb_build_object(
    'members', coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'email', u.email))
      from guia_private.members m join auth.users u on u.id = m.user_id where m.trip_id = p_trip and m.user_id <> auth.uid()), '[]'::jsonb),
    'invites', coalesce((select jsonb_agg(email) from guia_private.invites where trip_id = p_trip and expires_at > now()), '[]'::jsonb)
  );
end;
$$;

create function public.guia_revoke_access(p_trip uuid, p_user uuid, p_email text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from guia_private.trips where id = p_trip for update;
  if guia_private.member_role(p_trip, auth.uid()) is distinct from 'owner' then raise exception 'Acesso negado' using errcode = '42501'; end if;
  if p_user is not null then delete from guia_private.members where trip_id = p_trip and user_id = p_user; end if;
  if p_email is not null then delete from guia_private.invites where trip_id = p_trip and email = lower(p_email); end if;
end;
$$;

create function public.guia_reserve_route() returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_day date := (now() at time zone 'UTC')::date;
begin
  if v_user is null then return false; end if;
  insert into guia_private.route_usage as u (user_id, day, calls) values (v_user, v_day, 1)
    on conflict (user_id) do update set day = v_day, calls = case when u.day = v_day then u.calls + 1 else 1 end
    where u.day <> v_day or u.calls < 12;
  return found;
end;
$$;

revoke all on function public.guia_create_trip(jsonb), public.guia_read_trip(uuid, integer),
  public.guia_push_trip(uuid, integer, jsonb), public.guia_invite_trip(uuid, text), public.guia_join_trip(text),
  public.guia_list_trips(), public.guia_trip_access(uuid), public.guia_revoke_access(uuid, uuid, text),
  public.guia_reserve_route() from public, anon;
grant execute on function public.guia_create_trip(jsonb), public.guia_read_trip(uuid, integer),
  public.guia_push_trip(uuid, integer, jsonb), public.guia_invite_trip(uuid, text), public.guia_join_trip(text),
  public.guia_list_trips(), public.guia_trip_access(uuid), public.guia_revoke_access(uuid, uuid, text),
  public.guia_reserve_route() to authenticated;

commit;

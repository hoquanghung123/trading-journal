-- EA credentials can only stage data. All mutations are service-only RPCs.
create table public.mt5_connections (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 name text not null, account_login text not null, server text not null, token_hash text not null unique,
 created_at timestamptz not null default now(), revoked_at timestamptz, last_seen_at timestamptz, last_error text,
 mappings jsonb not null default '{"US100":"NQ1!","US500":"ES1!","US30":"YM1!","XAUUSD":"GC1!","XAGUSD":"SI1!"}',
 offset_rules jsonb not null, history_from timestamptz, history_to timestamptz,
 scan_version uuid not null default gen_random_uuid(),
 check (jsonb_typeof(offset_rules)='array')
);
create table public.mt5_inbox (
 id uuid primary key default gen_random_uuid(), connection_id uuid not null references public.mt5_connections(id),
 user_id uuid not null references auth.users(id), position_key text not null,
 revision bigint not null default 1, fingerprint text not null, event_time timestamptz not null,
 payload jsonb not null, state text not null default 'pending' check(state in ('pending','approved','ignored')),
 trade_id uuid, updated_at timestamptz not null default now(),
 unique(connection_id,position_key)
);
alter table public.trades add column broker_data jsonb;
alter table public.trades add column mt5_inbox_id uuid;
create unique index trades_mt5_inbox_unique on public.trades(mt5_inbox_id) where mt5_inbox_id is not null;
create index mt5_inbox_owner_state on public.mt5_inbox(user_id,state,updated_at desc);
alter table public.mt5_connections enable row level security;
alter table public.mt5_inbox enable row level security;
create policy mt5_connections_read on public.mt5_connections for select to authenticated using ((select auth.uid())=user_id);
create policy mt5_inbox_read on public.mt5_inbox for select to authenticated using ((select auth.uid())=user_id);
revoke all on public.mt5_connections, public.mt5_inbox from anon, authenticated;
grant select(id,user_id,name,account_login,server,created_at,revoked_at,last_seen_at,last_error,mappings,offset_rules,history_from,history_to,scan_version) on public.mt5_connections to authenticated;
grant select on public.mt5_inbox to authenticated;
grant all on public.mt5_connections,public.mt5_inbox to service_role;

create function public.mt5_stage(p_connection uuid,p_key text,p_payload jsonb,p_fingerprint text)
returns void language plpgsql set search_path='' as $$
declare c public.mt5_connections; old public.mt5_inbox; event_at timestamptz;
begin
 select * into c from public.mt5_connections where id=p_connection and revoked_at is null for update;
 if not found then raise exception 'Connection revoked'; end if;
 event_at := coalesce((p_payload->>'exitTime')::timestamptz,(p_payload->>'entryTime')::timestamptz);
 select * into old from public.mt5_inbox where connection_id=c.id and position_key=p_key for update;
 -- Linked open positions must still receive their eventual close outside a history window.
 if old.id is null and p_payload->>'status'='Closed' and not
   (event_at>=c.created_at or (event_at>=c.history_from and event_at<c.history_to)) then return; end if;
 if old.id is not null then
   if old.fingerprint=p_fingerprint then return; end if;
   -- Never regress a closed position to an earlier opening snapshot.
   if old.payload->>'status'='Closed' and p_payload->>'status'='Opened' then return; end if;
   if (p_payload->>'sequence')::numeric < (old.payload->>'sequence')::numeric then return; end if;
   update public.mt5_inbox set payload=p_payload,fingerprint=p_fingerprint,
     revision=revision+1,state='pending',event_time=event_at,updated_at=now() where id=old.id;
 else
   insert into public.mt5_inbox(connection_id,user_id,position_key,payload,fingerprint,event_time)
    values(c.id,c.user_id,p_key,p_payload,p_fingerprint,event_at);
 end if;
end $$;

create function public.mt5_review(p_user uuid,p_id uuid,p_revision bigint,p_action text,p_symbol text default null,p_remember boolean default false)
returns uuid language plpgsql set search_path='' as $$
declare r public.mt5_inbox; c public.mt5_connections; tid uuid; b jsonb; sym text;
begin
 select c0.* into c from public.mt5_connections c0 join public.mt5_inbox i on i.connection_id=c0.id
  where i.id=p_id and i.user_id=p_user and c0.user_id=p_user for update of c0;
 if not found then raise exception 'Not found'; end if;
 select * into r from public.mt5_inbox where id=p_id and user_id=p_user for update;
 if not found then raise exception 'Not found'; end if;
 if r.revision<>p_revision then raise exception 'Dữ liệu đã thay đổi. Hãy xem lại phiên bản mới.'; end if;
 if r.state<>'pending' then return r.trade_id; end if;
 if p_action='ignore' then update public.mt5_inbox set state='ignored' where id=r.id; return r.trade_id; end if;
 if p_action<>'approve' then raise exception 'Invalid action'; end if;
 if c.revoked_at is not null then raise exception 'Connection revoked'; end if;
 b:=r.payload;
 sym:=coalesce(nullif(trim(p_symbol),''),c.mappings->>(b->>'sourceSymbol'));
 if sym is null or length(sym)>50 then raise exception 'Chọn symbol journal trước khi duyệt'; end if;
 if p_remember then update public.mt5_connections set mappings=jsonb_set(mappings,array[b->>'sourceSymbol'],to_jsonb(sym)) where id=c.id; end if;
 select id into tid from public.trades where mt5_inbox_id=r.id and user_id=p_user for update;
 if tid is null then
  insert into public.trades(user_id,entry_time,exit_time,symbol,side,status,gross_pnl,fees,net_pnl,actual_rr,max_rr,compliance_check,broker_data,mt5_inbox_id)
  values(p_user,(b->>'entryTime')::timestamptz,(b->>'exitTime')::timestamptz,sym,(b->>'side')::public.trade_side,b->>'status',
   (b->>'grossPnl')::numeric,(b->>'fees')::numeric,(b->>'netPnl')::numeric,0,0,false,b,r.id) returning id into tid;
 else
  update public.trades set entry_time=(b->>'entryTime')::timestamptz,exit_time=(b->>'exitTime')::timestamptz,
   symbol=sym,side=(b->>'side')::public.trade_side,status=b->>'status',gross_pnl=(b->>'grossPnl')::numeric,
   fees=(b->>'fees')::numeric,net_pnl=(b->>'netPnl')::numeric,broker_data=b where id=tid and user_id=p_user;
 end if;
 update public.mt5_inbox set state='approved',trade_id=tid where id=r.id;
 return tid;
end $$;
revoke all on function public.mt5_stage(uuid,text,jsonb,text) from public,anon,authenticated;
revoke all on function public.mt5_review(uuid,uuid,bigint,text,text,boolean) from public,anon,authenticated;
grant execute on function public.mt5_stage(uuid,text,jsonb,text),public.mt5_review(uuid,uuid,bigint,text,text,boolean) to service_role;

-- Existing temporal snapshots already include broker_data. Restore it alongside the
-- original restoration function without rewriting its ownership and FK safeguards.
do $migration$
declare definition text;
begin
 select pg_get_functiondef('public.restore_single_system_version(uuid)'::regprocedure) into definition;
 definition:=replace(definition,'status, weekly_img','status, weekly_img, broker_data, mt5_inbox_id');
 definition:=replace(definition,$before$(hist_rec.snapshot_data->>'weekly_img')
        );$before$, $after$(hist_rec.snapshot_data->>'weekly_img'),
            (hist_rec.snapshot_data->'broker_data'),
            (hist_rec.snapshot_data->>'mt5_inbox_id')::uuid
        );$after$);
 execute definition;
end $migration$;

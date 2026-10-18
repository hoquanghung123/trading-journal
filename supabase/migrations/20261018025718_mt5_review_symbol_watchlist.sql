-- Add a confirmed journal symbol to the user watchlist atomically with approval.
create or replace function public.mt5_review(p_user uuid,p_id uuid,p_revision bigint,p_action text,p_symbol text default null,p_remember boolean default false)
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
 insert into public.symbols(user_id,name) values(p_user,sym) on conflict(user_id,name) do nothing;
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

-- A missing optional history range must evaluate false, not SQL NULL.
create or replace function public.mt5_stage(p_connection uuid,p_key text,p_payload jsonb,p_fingerprint text)
returns void language plpgsql set search_path='' as $$
declare c public.mt5_connections; old public.mt5_inbox; event_at timestamptz;
begin
 select * into c from public.mt5_connections where id=p_connection and revoked_at is null for update;
 if not found then raise exception 'Connection revoked'; end if;
 event_at := coalesce((p_payload->>'exitTime')::timestamptz,(p_payload->>'entryTime')::timestamptz);
 select * into old from public.mt5_inbox where connection_id=c.id and position_key=p_key for update;
 -- Linked open positions must still receive their eventual close outside a history window.
 if old.id is null and p_payload->>'status'='Closed' and not
   (event_at>=c.created_at or coalesce(event_at>=c.history_from and event_at<c.history_to,false)) then return; end if;
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

-- Missed opportunities are separate from executions, so performance queries cannot include them.
create table public.missed_trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  setup_time timestamptz not null,
  symbol text not null check (length(trim(symbol)) > 0),
  side text not null check (side in ('buy', 'sell')),
  setup_id uuid references public.playbook_setups(id) on delete set null,
  reason text not null check (reason in ('Không có mặt', 'Thấy quá muộn', 'Do dự', 'Chờ thêm xác nhận', 'Lệnh chờ không khớp', 'Lỗi kỹ thuật', 'Khác')),
  analysis text not null check (length(trim(analysis)) > 0),
  lesson text not null default '',
  planned_entry numeric,
  planned_sl numeric,
  planned_tp numeric,
  hypothetical_r numeric,
  before_img text not null check (length(before_img) > 0),
  after_img text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index missed_trades_user_time_idx on public.missed_trades (user_id, setup_time desc);
alter table public.missed_trades enable row level security;
revoke all on public.missed_trades from anon;
grant select, insert, update, delete on public.missed_trades to authenticated;
create policy "Read own missed trades" on public.missed_trades for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own missed trades" on public.missed_trades for insert to authenticated with check (
  (select auth.uid()) = user_id and (setup_id is null or exists (select 1 from public.playbook_setups s where s.id = setup_id and s.user_id = (select auth.uid())))
);
create policy "Update own missed trades" on public.missed_trades for update to authenticated using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id and (setup_id is null or exists (select 1 from public.playbook_setups s where s.id = setup_id and s.user_id = (select auth.uid())))
);
create policy "Delete own missed trades" on public.missed_trades for delete to authenticated using ((select auth.uid()) = user_id);
create trigger missed_trades_updated_at before update on public.missed_trades for each row execute function public.update_updated_at_column();

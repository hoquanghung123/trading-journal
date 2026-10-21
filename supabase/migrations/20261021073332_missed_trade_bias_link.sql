alter table public.missed_trades
  add column bias_entry_id uuid references public.journal_entries(id) on delete set null;

-- Restrictive policy preserves existing ownership/setup checks and also validates the linked bias.
create policy "Link own bias on missed trades"
on public.missed_trades as restrictive for all to authenticated
using (true)
with check (
  bias_entry_id is null or exists (
    select 1 from public.journal_entries entry
    where entry.id = missed_trades.bias_entry_id and entry.user_id = (select auth.uid())
  )
);

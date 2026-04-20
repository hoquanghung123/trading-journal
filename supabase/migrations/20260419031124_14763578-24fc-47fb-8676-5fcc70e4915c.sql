
insert into storage.buckets (id, name, public)
values ('journal-charts', 'journal-charts', false)
on conflict (id) do nothing;

create policy "Users can view own chart files"
on storage.objects for select
to authenticated
using (bucket_id = 'journal-charts' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can upload own chart files"
on storage.objects for insert
to authenticated
with check (bucket_id = 'journal-charts' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can update own chart files"
on storage.objects for update
to authenticated
using (bucket_id = 'journal-charts' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete own chart files"
on storage.objects for delete
to authenticated
using (bucket_id = 'journal-charts' and auth.uid()::text = (storage.foldername(name))[1]);

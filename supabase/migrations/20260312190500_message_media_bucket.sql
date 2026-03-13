insert into storage.buckets (id, name, public)
values ('message-media', 'message-media', false)
on conflict (id) do nothing;

create policy "message_media_read_own" on storage.objects
  for select using (
    bucket_id = 'message-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "message_media_write_own" on storage.objects
  for insert with check (
    bucket_id = 'message-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "message_media_update_own" on storage.objects
  for update using (
    bucket_id = 'message-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'message-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "message_media_delete_own" on storage.objects
  for delete using (
    bucket_id = 'message-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

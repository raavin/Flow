-- Topics are global shared entities (like hashtags).
-- Any authenticated user can create new topics or update the label
-- of an existing topic (normalisation only — slug is unique and immutable).
create policy "topics_insert_authenticated" on public.topics
  for insert to authenticated
  with check (true);

create policy "topics_update_authenticated" on public.topics
  for update to authenticated
  using (true)
  with check (true);

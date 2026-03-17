-- Remove duplicate active participants, keeping the oldest row per (project_id, name)
delete from public.project_participants
where id in (
  select id from (
    select id,
           row_number() over (
             partition by project_id, lower(name)
             order by created_at
           ) as rn
    from public.project_participants
    where status != 'removed'
  ) ranked
  where rn > 1
);

-- Prevent duplicate participants (same name, same project, non-removed status)
create unique index if not exists project_participants_unique_active_name
  on public.project_participants (project_id, lower(name))
  where status != 'removed';

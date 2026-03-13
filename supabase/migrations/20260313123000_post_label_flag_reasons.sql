alter table public.post_label_flags
  add column if not exists reason text;

alter table public.post_label_flags
  drop constraint if exists post_label_flags_reason_length_check;

alter table public.post_label_flags
  add constraint post_label_flags_reason_length_check
  check (reason is null or char_length(reason) <= 40);

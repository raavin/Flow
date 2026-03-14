-- Add link_url to notifications so alerts can point to the relevant page
alter table notifications
  add column if not exists link_url text;

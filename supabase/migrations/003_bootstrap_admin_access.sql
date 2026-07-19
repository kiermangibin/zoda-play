insert into public.admin_emails (email)
values ('trish@zoda.sg')
on conflict (email) do nothing;

delete from public.admin_emails
where email = 'themediamorphosys@gmail.com';

update public.profiles
set role = 'admin'
where email = 'trish@zoda.sg';

update public.profiles
set role = 'user'
where email = 'themediamorphosys@gmail.com';

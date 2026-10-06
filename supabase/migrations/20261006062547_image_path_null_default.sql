-- posts.image_path and clubs.profile_image_path defaulted to the string 'NULL'
-- (baseline), which the API read as an image key and served as .../NULL.jpg.
-- Default to a real NULL and clear the rows that kept the string.
alter table public.posts alter column image_path set default null;
alter table public.clubs alter column profile_image_path set default null;

update public.posts set image_path = null where upper(btrim(image_path)) = 'NULL';
update public.clubs set profile_image_path = null
  where upper(btrim(profile_image_path)) = 'NULL';

-- Drop the seasonal "The Autumn Edit" hero eyebrow; the hero hides it when empty.
alter table public.settings alter column hero_eyebrow set default '';
update public.settings set hero_eyebrow = '' where hero_eyebrow = 'The Autumn Edit';

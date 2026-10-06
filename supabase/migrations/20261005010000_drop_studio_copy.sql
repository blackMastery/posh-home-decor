-- Posh no longer offers styling services: reword the seeded product-details copy.
update public.settings
set default_details_text = replace(default_details_text, 'selected by our Georgetown studio', 'selected by our Georgetown team')
where default_details_text like '%selected by our Georgetown studio%';

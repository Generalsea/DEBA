-- Phase 2 / Step 2.1
-- Arabic transliteration expansion plus the three missing offers foreign-key indexes.

begin;

insert into private.search_synonyms (group_key, term)
values
  ('galaxy', 'جالاكسي'),
  ('galaxy', 'جالكسي'),
  ('galaxy', 'galaxy'),
  ('toyota', 'تويوتا'),
  ('toyota', 'toyota'),
  ('hyundai', 'هيونداي'),
  ('hyundai', 'hyundai'),
  ('bosch', 'بوش'),
  ('bosch', 'bosch'),
  ('sony', 'سوني'),
  ('sony', 'sony'),
  ('playstation', 'بلايستيشن'),
  ('playstation', 'بلاي ستيشن'),
  ('playstation', 'playstation'),
  ('macbook', 'ماكبوك'),
  ('macbook', 'ماك بوك'),
  ('macbook', 'macbook'),
  ('airpods', 'ايربودز'),
  ('airpods', 'air pods'),
  ('airpods', 'airpods'),
  ('lenovo', 'لينوفو'),
  ('lenovo', 'lenovo'),
  ('dell', 'ديل'),
  ('dell', 'dell'),
  ('lg', 'ال جي'),
  ('lg', 'lg'),
  ('tablet', 'تابلت'),
  ('tablet', 'جهاز لوحي'),
  ('tablet', 'tablet'),
  ('camera', 'كاميرا'),
  ('camera', 'كاميرا ديجيتال'),
  ('camera', 'camera'),
  ('smartwatch', 'ساعة ذكية'),
  ('smartwatch', 'سمارت واتش'),
  ('smartwatch', 'smartwatch')
on conflict (group_key, term) do nothing;

insert into private.search_brand_groups (group_key)
values
  ('galaxy'),
  ('toyota'),
  ('hyundai'),
  ('bosch'),
  ('sony'),
  ('playstation'),
  ('macbook'),
  ('airpods'),
  ('lenovo'),
  ('dell'),
  ('lg')
on conflict (group_key) do nothing;

create index if not exists offers_seller_created_idx
  on public.offers (seller_id, created_at desc);

create index if not exists offers_created_by_idx
  on public.offers (created_by);

create index if not exists offers_last_action_by_idx
  on public.offers (last_action_by);

notify pgrst, 'reload schema';

commit;

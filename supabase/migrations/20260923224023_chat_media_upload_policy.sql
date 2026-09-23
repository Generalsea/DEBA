create policy "chat media authenticated uploads"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'deba-product-media'
  and (storage.foldername(name))[1] = 'chat'
  and (storage.foldername(name))[2] = auth.uid()::text
);


UPDATE public.profiles p
SET upi_id = right(regexp_replace(p.phone, '[^0-9]', '', 'g'), 10) || '@vaanipay'
WHERE p.upi_id IS NULL
  AND length(regexp_replace(p.phone, '[^0-9]', '', 'g')) >= 10
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p2
    WHERE p2.upi_id = right(regexp_replace(p.phone, '[^0-9]', '', 'g'), 10) || '@vaanipay'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p3
    WHERE p3.id != p.id
      AND right(regexp_replace(p3.phone, '[^0-9]', '', 'g'), 10) = right(regexp_replace(p.phone, '[^0-9]', '', 'g'), 10)
      AND p3.upi_id IS NULL
      AND p3.created_at < p.created_at
  );

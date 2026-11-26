-- Libro de pagos on-chain.
--
-- La tabla la crea 20260917102030, con esta forma exacta, asi que aqui no se
-- repite el `create table`: se comprueba que esta y se dejan indices, RLS y
-- politica, que son idempotentes. Un proyecto restaurado a mano sin aquella
-- migracion falla aqui, con el nombre de la que falta, y no en el codigo.
--
-- `verify-crypto-payment` lee e inserta en esta tabla. Si no existiera, el pago
-- se verificaba, el plan se acreditaba y el insert reventaba con 500, sin dejar
-- rastro ni poder detectar una transaccion reutilizada.
--
-- El libro es la fuente de verdad y se escribe ANTES de extender el plan:
--   status = 'verified' → pago comprobado on-chain, plan aún no extendido;
--   status = 'granted'  → plan ya extendido, no se puede volver a usar.
-- Asi un fallo a mitad se puede reintentar, y un reintento nunca regala otro
-- periodo.
do $$
begin
  if to_regclass('public.crypto_payments') is null then
    raise exception 'public.crypto_payments no existe: falta aplicar 20260917102030'
      using errcode = '42P01';
  end if;
end $$;

-- Una transacción, un pago: lo que hace imposible reutilizar un hash.
create unique index if not exists crypto_payments_tx_hash_key
  on public.crypto_payments (tx_hash);
create index if not exists crypto_payments_user_created_idx
  on public.crypto_payments (user_id, created_at desc);

alter table public.crypto_payments enable row level security;

-- El cliente sólo lee su propio historial; quien escribe es la service role.
drop policy if exists "crypto_payments: ver los propios" on public.crypto_payments;
create policy "crypto_payments: ver los propios"
  on public.crypto_payments
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

comment on table public.crypto_payments is
  'Libro de pagos on-chain verificados. Lo escribe verify-crypto-payment con la service role.';
comment on column public.crypto_payments.status is
  'verified = comprobado sin acreditar (reintentable); granted = plan ya extendido (no reutilizable).';

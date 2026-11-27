-- Libro de pagos on-chain: aquí sólo queda el portero.
--
-- La tabla la crea 20260917102030, y allí van también los índices, el RLS, la
-- política y los comentarios. Este fichero llegó a tener una copia entera de
-- esa DDL; dos copias de lo mismo acaban divergiendo, y la de septiembre es la
-- que corre antes, así que la que manda es esa.
--
-- En una base que ya aplicó septiembre esto es un no-op. En un proyecto
-- restaurado a mano sin aquella migración falla aquí, con el nombre de la que
-- falta, en vez de reventar más tarde en el código con un 500 y sin rastro.
--
-- El libro es la fuente de verdad y se escribe ANTES de extender el plan:
--   status = 'verified' → pago comprobado on-chain, plan aún no extendido;
--   status = 'granted'  → plan ya extendido, no se puede volver a usar.
-- Así un fallo a mitad se puede reintentar, y un reintento nunca regala otro
-- periodo.
do $$
begin
  if to_regclass('public.crypto_payments') is null then
    raise exception 'public.crypto_payments no existe: falta aplicar 20260917102030'
      using errcode = '42P01';
  end if;
end $$;

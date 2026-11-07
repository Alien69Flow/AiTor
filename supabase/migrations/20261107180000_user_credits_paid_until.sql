-- Caducidad del plan de pago.
--
-- `user_credits.paid_tier` se activaba para siempre: un pago mensual dejaba la
-- cuenta en `basic` (Synapse) de forma indefinida, y cancelar no devolvía a
-- nadie a Node. `paid_until` guarda hasta cuándo vale ese plan; el cliente lo
-- respeta al resolver el tier y la interfaz avisa antes de que venza.
--
-- NULL = sin caducidad. Es lo que valen las filas anteriores a esta migración:
-- rellenarlas hacia atrás con una fecha inventada degradaría a quien ya pagó,
-- así que se dejan como estaban y sólo los cobros nuevos escriben la fecha.

alter table public.user_credits
  add column if not exists paid_until timestamptz;

comment on column public.user_credits.paid_until is
  'Hasta cuándo vale paid_tier. NULL = sin caducidad (filas anteriores o acceso vitalicio).';

-- Sirve para listar las renovaciones próximas sin recorrer la tabla entera.
create index if not exists user_credits_paid_until_idx
  on public.user_credits (paid_until)
  where paid_until is not null;

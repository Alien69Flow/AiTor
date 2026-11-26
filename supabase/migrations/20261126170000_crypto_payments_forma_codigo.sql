-- crypto_payments: llevar un proyecto hospedado de la forma vieja a la que ya
-- crea 20260917102030 en una base limpia.
--
-- En una base nueva la tabla nace con status, cycle, token, price_version y
-- granted_at, asi que todo lo de aqui es `if not exists` y no hay nada que
-- hacer. En el proyecto hospedado se creo con `plan` (enum credit_tier) y
-- `recipient` obligatorios, y no hay ninguna migracion posterior que la cambie:
-- 20261110120000 solo comprueba que la tabla existe. Alli el insert de
-- verify-crypto-payment falla por columna inexistente y, si se anaden a mano,
-- por NOT NULL en `plan`.
--
-- Dos reglas que sigue este fichero:
--   * no borra `plan` ni ninguna otra columna: `plan` se queda como historico de
--     lo que se compro en la primera version;
--   * no escribe ni reescribe filas: ni backfill, ni UPDATE. Los pagos viejos
--     conservan sus valores; los defaults solo se aplican a lo que se inserte
--     despues.

alter table public.crypto_payments
  add column if not exists status text,
  add column if not exists cycle text,
  add column if not exists token text,
  add column if not exists price_version text,
  add column if not exists granted_at timestamptz;

-- Los defaults se pueden alinear sin tocar ninguna fila: son lo que se escribe
-- cuando verify-crypto-payment inserta sin mandar la columna.
alter table public.crypto_payments alter column status set default 'verified';
alter table public.crypto_payments alter column token set default 'USDC';

-- `plan` y `recipient` eran obligatorios en la forma vieja y el codigo nuevo no
-- los escribe: sin esto el insert falla por NOT NULL aunque la columna exista.
-- `plan` no se dropea, solo deja de ser obligatorio.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'crypto_payments'
       and column_name = 'plan' and is_nullable = 'NO'
  ) then
    execute 'alter table public.crypto_payments alter column plan drop not null';
  end if;

  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'crypto_payments'
       and column_name = 'recipient' and is_nullable = 'NO'
  ) then
    execute 'alter table public.crypto_payments alter column recipient drop not null';
  end if;
end $$;

-- Los CHECK de la forma nueva, en un DO porque `add constraint` no tiene
-- `if not exists`. Van `not valid` a proposito: validarlos obligaria a leer las
-- filas viejas, y aqui no se tocan datos. `not valid` no comprueba lo que ya
-- esta y si se aplica a todo lo que se inserte desde ahora, que es lo que
-- necesita el codigo nuevo.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.crypto_payments'::regclass
       and conname = 'crypto_payments_status_check'
  ) then
    execute 'alter table public.crypto_payments add constraint crypto_payments_status_check check (status in (''verified'', ''granted'')) not valid';
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.crypto_payments'::regclass
       and conname = 'crypto_payments_hash_lowercase'
  ) then
    execute 'alter table public.crypto_payments add constraint crypto_payments_hash_lowercase check (tx_hash = lower(tx_hash)) not valid';
  end if;
end $$;

-- Lo que esta migracion deja distinto a proposito, para que no sorprenda: en el
-- hospedado las columnas nuevas aceptan NULL y las filas anteriores se quedan
-- con status y token en NULL; en una base limpia nacen NOT NULL con default.
-- Igualar eso exige rellenar y validar datos, que es justo lo que este fichero
-- evita.

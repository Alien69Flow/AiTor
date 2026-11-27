-- Informes CSP agregados por dia, directiva y origenes.
--
-- El colector (#168) escribe una linea por informe en los Runtime Logs, y ese
-- log rota con el plan: cuando rota, la medicion de la politica se va con el.
-- Esta tabla guarda lo unico que hace falta para decidir que origenes sobran
-- antes de pasar de `Report-Only` a bloqueo: cuantas veces aparece cada par
-- (directiva, origen bloqueado, origen del documento) en cada dia, y entre que
-- dos instantes se vio.
--
-- Una fila por (dia, directiva, blocked_origen, document_origen). El agregador
-- suma `count` y ensancha `first_seen`/`last_seen` en cada pasada, asi que
-- reagregar una ventana ya agregada cuenta doble: la ventana es cosa de quien
-- llama, no de la tabla.
--
-- `blocked_origen` y `document_origen` son origenes, no URLs: el colector ya
-- recorta el documento, y el agregador recorta el bloqueado antes de llegar
-- aqui. Un valor que no es una URL (`inline`, `eval`, `data`) se guarda tal cual,
-- y `-` es el campo vacio que escribe el colector.

create table if not exists public.csp_reports_daily (
  dia             date        not null,
  directiva       text        not null,
  blocked_origen  text        not null,
  document_origen text        not null,
  count           bigint      not null default 0,
  first_seen      timestamptz not null,
  last_seen       timestamptz not null,

  constraint csp_reports_daily_pkey
    primary key (dia, directiva, blocked_origen, document_origen),
  constraint csp_reports_daily_count_positivo check (count > 0),
  constraint csp_reports_daily_ventana check (last_seen >= first_seen),

  -- El dia sale de los dos extremos: una fila que empieza un dia y acaba en
  -- otro no es un agregado diario, y con este check no puede existir. Va en
  -- UTC porque el dia tambien se calcula en UTC en el agregador; si un dia se
  -- cambia de zona, `dia` deja de partir de `first_seen` y esto salta a la
  -- primera fila.
  constraint csp_reports_daily_mismo_dia check (
    (first_seen at time zone 'UTC')::date = dia
    and (last_seen at time zone 'UTC')::date = dia
  ),

  -- Los topes son los del colector: un campo mas largo no es un origen.
  constraint csp_reports_daily_campos check (
    char_length(directiva) between 1 and 512
    and char_length(blocked_origen) between 1 and 512
    and char_length(document_origen) between 1 and 512
  )
);

-- La pregunta que justifica la tabla: "este origen, que dias aparece". La clave
-- primaria ya resuelve el recorrido por dia.
create index if not exists csp_reports_daily_por_origen
  on public.csp_reports_daily (blocked_origen, dia desc);

-- Nadie entra sin service role: son origenes de terceros y origenes del propio
-- sitio, telemetria interna que no pinta nada en el bundle. No hay panel. La
-- clave anon viaja en el navegador, asi que ni leer.
alter table public.csp_reports_daily enable row level security;
revoke all on public.csp_reports_daily from anon, authenticated;
grant select, insert, update on public.csp_reports_daily to service_role;

-- Sumar un lote de filas en un solo viaje.
--
-- Sin esta funcion, el agregador tendria que leer la fila y reescribir el
-- contador: dos pasadas a la vez se pisarian y el recuento perderia informes.
-- Aqui el INSERT ... ON CONFLICT suma en la misma sentencia, y `first_seen` se
-- queda con el menor y `last_seen` con el mayor, que es lo que hace que una
-- pasada atrasada no estropee la ventana ya guardada.
--
-- Devuelve cuantas filas acepto, para que el agregador pueda compararlo con lo
-- que mando. Rechaza lotes de mas de 500: el agregador trocea, y un lote
-- gigante es un fallo de quien llama, no algo que haya que tragarse.
create or replace function public.record_csp_reports(p_filas jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fila  jsonb;
  v_total integer := 0;
begin
  if p_filas is null or jsonb_typeof(p_filas) <> 'array' then
    raise exception 'record_csp_reports espera un array jsonb'
      using errcode = '22023';
  end if;

  if jsonb_array_length(p_filas) > 500 then
    raise exception 'record_csp_reports: % filas en un lote (maximo 500)',
      jsonb_array_length(p_filas)
      using errcode = '22023';
  end if;

  for v_fila in select jsonb_array_elements(p_filas) loop
    insert into public.csp_reports_daily as t
      (dia, directiva, blocked_origen, document_origen, count, first_seen, last_seen)
    values (
      (v_fila ->> 'dia')::date,
      v_fila ->> 'directiva',
      v_fila ->> 'blocked_origen',
      v_fila ->> 'document_origen',
      greatest(1, coalesce((v_fila ->> 'count')::bigint, 1)),
      coalesce((v_fila ->> 'first_seen')::timestamptz, now()),
      coalesce((v_fila ->> 'last_seen')::timestamptz, now())
    )
    on conflict (dia, directiva, blocked_origen, document_origen) do update
      set count      = t.count + excluded.count,
          first_seen = least(t.first_seen, excluded.first_seen),
          last_seen  = greatest(t.last_seen, excluded.last_seen);

    v_total := v_total + 1;
  end loop;

  return v_total;
end;
$$;

-- Por defecto toda funcion es ejecutable por `public`: sin este revoke, la
-- clave anon podria inflar los contadores del log con filas inventadas.
revoke all on function public.record_csp_reports(jsonb)
  from public, anon, authenticated;
grant execute on function public.record_csp_reports(jsonb)
  to service_role;

-- Temporal: verifica que el paso 'Run pgTAP suites' sigue en rojo con el tee.
-- Se borra en cuanto termine la comprobación; no debe fusionarse.
begin;
select plan(1);
select ok(false, 'fallo forzado: esta aserción tiene que poner el paso en rojo');
select * from finish();
rollback;

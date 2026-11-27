-- Sonda temporal de la rama de prueba: fuerza un rojo para comprobar que el
-- log del job cabe entero y se ve qué aserción cae. Se va con la rama.
begin;
select plan(3);

select ok(true, 'la primera pasa, para que se note el contraste');
select ok(false, 'mutacion deliberada: tiene que salir en rojo');
select ok(true, 'la tercera pasa');

select * from finish();
rollback;

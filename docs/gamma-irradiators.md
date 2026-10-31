# Plantas de irradiación gamma (IAEA DIIF)

Generado por `scripts/build-gamma-irradiators.mjs`. No se edita a mano.

## El problema del volcado

El fichero crudo del fork (`data/gamma-irradiators-raw.json`) es una descarga de
la visualización de Tableau de la IAEA. Trae **136 pares de
coordenadas** (`realValues`: primero las 136 latitudes, después las 136
longitudes) pero solo **124 nombres de ciudad distintos**, así que
las dos listas no se pueden unir por índice. La versión derivada del fork lo hizo
igual y quedó corrida desde la fila 124: a Abuja le puso la
latitud de Túnez, a Acra la de Abuya y a Ibaraki una longitud de Ghana. Además la
lista de países (51) y la de organismos (79) son
*listas de valores distintos*, no columnas: tampoco se pueden unir por fila.

## Método

1. Los pares salen del volcado tal cual; el corte entre latitudes y longitudes se
   detecta solo.
2. Ciudad, región y país de cada punto salen de **geolocalización inversa contra
   OpenStreetMap** (Nominatim, zoom 10). Es la fuente administrativa, no una
   suposición.
3. Contraste con la IAEA: se geocodifican sus topónimos y se comprueba que la
   coordenada caiga en un país que la lista menciona. Se guarda también a qué
   distancia queda el topónimo declarado más cercano.
4. Se descarta lo que no cumple: coordenadas en el mar, países que la lista no
   menciona y duplicados exactos.

## Resultado

| | |
| --- | --- |
| Pares de coordenadas en el volcado | 136 |
| Filas publicadas | **131** |
| Filas descartadas | 5 |
| Países representados | 48 |
| Topónimo IAEA más cercano (mediana) | 3 km |

## Filas descartadas

| Fila | Coordenada | Ciudad OSM | Topónimo IAEA más cercano | Motivo |
| --- | --- | --- | --- | --- |
| 43 | 9.07144, -79.30081 | Pacora | Pacora (2 km) | duplicado: misma coordenada que otra fila |
| 85 | 53.79742, -9.53058 | County Mayo | Swindon (509 km) | el topónimo declarado más cercano («Swindon») queda a 509 km |
| 91 | -6.23053, 106.82184 | Special Capital Region of Jakarta | Jakarta (3 km) | duplicado: misma coordenada que otra fila |
| 92 | -6.23054, 106.82184 | Special Capital Region of Jakarta | Jakarta (3 km) | duplicado: misma coordenada que otra fila |
| 133 | 36.92578, 10.04657 | شرفش | Sidi Thabet (754 km) | el topónimo declarado más cercano («Sidi Thabet») queda a 754 km |

## Filtro de contraste

Una fila se publica solo si el topónimo más cercano que declara la IAEA queda a
**250 km o menos**. Es el filtro que atrapa las filas corridas
que la geolocalización inversa no detecta por sí sola: un punto real de Irlanda
o de Irán con el nombre de otra fila del volcado. Las que caen por encima
aparecen arriba, en «Filas descartadas», con la distancia que las delata.

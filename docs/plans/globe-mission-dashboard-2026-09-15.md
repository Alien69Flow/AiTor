# Globe Mission Dashboard

## Objetivo
Convertir la pestaña Globe en la dirección **Hyper-spectral tactical command** seleccionada, conservando Cesium y las fuentes en tiempo real como núcleo.

## Cambios
- Reorganizar el Globe como centro de mando: cabecera de estado compacta, globo dominante, controles de capas y navegación a la izquierda, análisis del evento seleccionado a la derecha.
- Mantener el branding Ai Tor en negro profundo, verde neón y dorado; usar rojo solo para alertas y JetBrains Mono/Work Sans para una lectura táctica clara.
- Agrupar las capas atmosféricas visibles: atmósfera, nubes, temperatura, precipitación, presión y viento, mostrando estado independiente de cada fuente.
- Sustituir puntos genéricos por iconos diferenciados para terremotos, incendios, vuelos, barcos, satélites, conflictos, noticias, nodos Bitcoin e infraestructura.
- Hacer clicables los eventos y mostrar una ficha con tipo, ubicación, magnitud/intensidad, hora, fuente, confiabilidad y datos de mercado cuando existan.
- Colocar dos carriles inferiores separados justo encima del pie: **LIVE MARKETS** con todos los activos disponibles y **LIVE ALERTS** con terremotos y riesgos recientes.
- Mantener controles plegables en escritorio y hojas inferiores compactas en móvil, sin tapar el globo.

## Detalles técnicos
- Extender el payload común de los marcadores de Cesium para que todas las entidades interactivas usen el mismo flujo de selección.
- Generar iconos ligeros en memoria para los billboards de Cesium, evitando nuevas imágenes remotas y conservando buen rendimiento.
- Reutilizar los datos existentes de CoinGecko, USGS/EMSC, NASA, NOAA, RainViewer, Open-Meteo, ADS-B, GDELT y los conectores actuales.
- Aplicar los colores mediante tokens semánticos del tema y componentes de control existentes.
- Verificar compilación, consola, interacción de iconos, capas atmosféricas y composición en escritorio y móvil.

## Alcance
No se cambiará el motor Cesium ni se inventarán datos o fuentes. NASA FIRMS seguirá necesitando su clave real para mostrar detecciones completas.

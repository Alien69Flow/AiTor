# Globo LIVE, emisiones y cobros Synapse

## Objetivo
Ampliar el globo sin perder las mejoras de GitHub/Vercel: clima visible y verificable, mercados arriba, alertas abajo, emisiones oficiales y más opciones de pago. Conservar DAO City y continuar su validación sin sustituirla por otra interfaz.

## Estado comprobado
- Al abrir el globo, CoinGecko respondió y el ticker mostró BTC junto con 20 activos. Open-Meteo, USGS, NASA EONET y NOAA también respondieron. Esto no demuestra que todas las capas se representen correctamente.
- Temperatura y humedad se consultan para 22 ciudades. No equivalen a una cobertura meteorológica mundial continua; los valores ausentes se convierten actualmente en cero.
- El ticker conserva precios fijos de respaldo sin diferenciarlos de cotizaciones actuales.
- Hay cámaras compartidas entre ALIEN y el globo, y seguimiento de satélites/ISS. No se encontró un conector de mareas en el recorrido revisado.
- Los aviones utilizan iconos con colores por altura y formas por categoría, no modelos 3D reales.
- El cobro Synapse revisado admite USDC/USDT en Base y Polygon. Reown está configurado para conectar wallets EVM.

## 1. Conservar y recuperar avances
- Comparar el código local con las ramas públicas de `Alien69Flow/AiTor` y confirmar qué revisión despliega Vercel antes de importar cambios.
- Recuperar selectivamente modelos, colores, zoom, atmósferas y fuentes que estén más avanzados; no sobrescribir autenticación, pagos o cambios locales.
- Incorporar estos trabajos al roadmap al iniciar implementación y mantener DAO City dentro del alcance pendiente de validación.

## 2. Clima real y fuentes
- Corregir la coexistencia de temperatura, humedad, presión y viento: activar una capa no debe ocultar las lecturas de otra.
- Mostrar unidades, fuente, hora y cobertura. No sustituir lecturas ausentes por cero.
- Mantener las lecturas verificables por ubicación y añadir cobertura global únicamente con una fuente adecuada y validada; no interpolar 22 ciudades como si fueran mediciones mundiales.
- Revisar todos los estados por fuente: lluvia, nubes, incendios, sismos, actividad solar, tráfico y satélites. Conectar las pendientes viables y marcar explícitamente las que dependan de permisos o credenciales.
- Ajustar leyendas y controles al zoom y comprobar que no tapen el globo a 780×565 ni en móvil.

## 3. Dos carriles LIVE
**Mercados arriba:** BTC y el catálogo actual de criptoactivos, más índices, oro, materias primas y otros activos cuando exista fuente verificable. Mostrar última actualización, mercado cerrado y datos atrasados; eliminar precios inventados como respaldo LIVE. “Tiempo real” respetará la frecuencia y posibles retrasos de cada fuente.

**Alertas abajo:** terremotos, incendios y eventos naturales; añadir mareas por estaciones costeras con cobertura explícita, y eventos orbitales relevantes de ISS/satélites. Distinguir predicciones de mareas y pasos orbitales de observaciones y alertas reales. Incluir accidentes solamente con una fuente identificable, lugar y hora verificables, sin inventar un feed global.

Cada elemento abrirá su ubicación o ficha con fecha, fuente y detalles.

## 4. Cámaras y emisiones
- Ampliar el catálogo común de ALIEN y GLOBE con categorías Noticias, Finanzas, Deportes y Gaming/Esports, además de cámaras y espacio.
- Verificar emisiones oficiales de RTVE 24h, Bloomberg, BBC, Al Jazeera y NBC; añadir competiciones oficiales disponibles.
- Usar reproductores autorizados. Si una emisión exige suscripción, bloquea inserción o no está emitiendo, mostrar su estado y enlace oficial, no un falso LIVE.
- Geolocalizar solo cámaras con ubicación conocida; no presentar la sede de un canal global como el lugar de la noticia.
- Cargar vídeo al seleccionarlo, con sonido desactivado inicialmente y recuperación ante emisiones caídas.

## 5. Synapse: Reown y nuevas monedas
- Conservar Reown y comprobar wallets, redes, resolución de `alienflow.crypto` y cobros existentes de extremo a extremo.
- Separar conexión de wallet, compra de cripto para el usuario y cobro de una suscripción: no son la misma función.
- Ampliar primero redes y monedas admitidas y verificables. ETH/BNB/POL necesitan verificación de transferencias nativas; SOL necesita integración de su red. BTC y TON requieren rutas específicas. Cosmos/ATOM y GRAM quedarán sin activar hasta comprobar soporte y la identidad exacta del activo/red.
- Para monedas variables, crear una cotización con vencimiento, importe, red y destino; verificar confirmaciones y prevenir reutilización de pagos. Activar Synapse solo tras un pago válido, con duración y renovación coherentes con el periodo elegido.
- Revisar WalletConnect Pay como opción comercial ligada al ecosistema Reown. Requiere alta de comercio y configuración propia; no se activa con el ID actual de AppKit. No prometer conversión ni liquidación a BTC/USDC hasta verificar cobertura y destinos.
- Añadir BTC mediante una ruta de cobro comprobada y configurar el destino del comercio antes de habilitarlo. Lightning será una extensión separada si la ruta elegida lo admite.
- Para tarjeta, comprobar primero cualquier integración comercial existente. Paddle resultó elegible para Synapse, aunque cripto/NFT puede requerir revisión; sigue siendo una opción pendiente de aceptación, no se habilitará automáticamente. Los pagos integrados requieren Pro según la comprobación de disponibilidad; con cuenta Stripe propia existe una alternativa si se elige expresamente.
- No añadir botones de pago que solo conecten una wallet o compren cripto sin cobrar y activar el plan.

## Detalles técnicos y verificación
- Reutilizar los conectores y estados independientes existentes; mantener el catálogo de vídeo compartido y separar eventos, capas ambientales y precios.
- Mantener claves privadas y verificación de pagos en Lovable Cloud. Añadir pruebas para importes, caducidad, periodos, redes, destinos y pagos duplicados.
- Ejecutar las pruebas pertinentes y revisar errores de compilación y de ejecución. Validar globo, selección de capas, tickers, cámaras y DAO City en escritorio y móvil.
- Probar cobros en entorno de prueba, con usuario autenticado y lectura posterior del acceso. No transferir dinero real ni publicar sin autorización.

## Dependencias que no deben ocultarse
- Revisión/rama exacta desplegada en Vercel si no se puede identificar públicamente.
- Destinos verificados por red, alta del comercio y permisos del proveedor para BTC/tarjeta.
- Fuentes globales meteorológicas, mareas y mercados con la cobertura y derechos necesarios.
- Disponibilidad y derechos de inserción de cada emisión.

Primero se entregarán las mejoras del globo y datos verificables; los métodos de cobro quedarán habilitados únicamente al completar sus requisitos y pruebas.
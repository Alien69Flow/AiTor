# Reparar monetización e interfaz AGENTS

## Objetivo
Dejar el paywall de cinco niveles totalmente visible, recuperar los controles de AGENTS y verificar qué datos Web3 faltan antes de activar Oracle y Quantum.

## Cambios
- Reconstruir el paywall como panel centrado y adaptable: cabecera fija, contenido desplazable, selector de periodo/red/moneda legible y cinco planes completos sin quedar cortados.
- Corregir la acción de NODE y SYNAPSE para abrir Reown directamente cuando corresponda, evitando enviar innecesariamente a la página de acceso.
- Restaurar el panel izquierdo de AGENTS conectándolo al botón existente y adaptándolo a móvil sin duplicar controles.
- Recuperar una vista animada del cerebro neuronal dentro de AGENTS, con un control claro para alternar entre chat y núcleo neuronal.
- Simplificar y mejorar el selector de oráculos para que sea compacto, legible y usable en el ancho móvil actual.
- Reducir la repetición visual del logotipo: conservarlo en la navegación y acceso; sustituir copias del chat, estados y DAO por iconografía propia de AI Tor.
- Añadir los dos perfiles de OpenSea como referencias oficiales, sin tratarlos como contratos NFT.

## Verificación Web3
- Confirmar que las URLs proporcionadas son perfiles de OpenSea, no direcciones de contratos NFT configurables.
- Mantener USDC y USDT en Base y Polygon; no activar BTC/Lightning hasta incorporar verificación específica.
- Validar conexión Reown, apertura del paywall, panel lateral, selector y cerebro en escritorio y móvil.

## Información pendiente del propietario
Para activar Oracle/Quantum harán falta las direcciones exactas de contrato y red de cada colección NFT. Para asegurar el cobro, `alienflow.crypto` debe resolver a la wallet receptora correcta para Base/Polygon; el perfil de OpenSea no sustituye esos registros.


# Fase 1 (estricta) — Fix Sol, Luna y Bloom

Un solo archivo: `src/components/globe/CesiumGlobe.tsx`. Sólo el bloque de astros y bloom dentro del `useEffect` de init del viewer. Cero cambios de UI, cero billboards de planetas, cero tabs.

## Diagnóstico

- `new Sun()` y `new Moon()` ya se crean, pero no se ven porque:
  1. El bloom con `contrast: 128` + `brightness: -0.3` aplasta cualquier fuente puntual brillante contra el negro — se come Sol, Luna y estrellas nítidas.
  2. Sin `viewer.clock.shouldAnimate = true`, la posición del Sol es estática según la hora del cliente; según cámara inicial puede estar detrás.
  3. `scene.sun.glowFactor` por defecto es bajo; el disco solar queda diminuto.
  4. `Moon` por defecto usa `onlySunLighting = true` — en cara noche se ve casi negra.
  5. `scene.globe.showGroundAtmosphere` intenso solapa al Sol al ras del limbo.

## Cambios (sólo dentro del init `useEffect`)

Reemplazar el bloque actual de astros y el de bloom por:

```ts
// Sol — halo grande y visible
viewer.scene.sun = new Sun();
viewer.scene.sun.show = true;
viewer.scene.sun.glowFactor = 2.0;

// Luna con textura local (viene con Cesium)
viewer.scene.moon = new Moon({
  textureUrl: buildModuleUrl("Assets/Textures/moonSmall.jpg"),
  onlySunLighting: false, // visible también en el hemisferio noche
});
viewer.scene.moon.show = true;

// Reloj animado → efemérides reales para Sol y Luna
viewer.clock.shouldAnimate = true;
viewer.clock.multiplier = 1;

// Atmósfera terrestre suave, sin comer el limbo solar
viewer.scene.globe.showGroundAtmosphere = true;
(viewer.scene.globe as any).atmosphereBrightnessShift = -0.1;

// Bloom táctico recalibrado — brillo sin aplastar puntos de luz
viewer.scene.postProcessStages.bloom.enabled = true;
viewer.scene.postProcessStages.bloom.uniforms.glowOnly = false;
viewer.scene.postProcessStages.bloom.uniforms.contrast = 16;
viewer.scene.postProcessStages.bloom.uniforms.brightness = -0.1;
viewer.scene.postProcessStages.bloom.uniforms.delta = 1.0;
viewer.scene.postProcessStages.bloom.uniforms.sigma = 2.0;
viewer.scene.postProcessStages.bloom.uniforms.stepSize = 1.0;
```

Todo dentro de `try/catch` como el bloque original.

## Sobre "el resto de planetas del sistema solar"

Cesium **no** renderiza nativamente Mercurio/Venus/Marte/etc. Las únicas opciones reales son:
- billboards con posición calculada (lo que llamas "pegatinas de mierda") — descartado por ti,
- o un asset 3D externo del sistema solar (Ion tile) — mucho scope, no toca en Fase 1.

Por tanto en este commit **no** se añaden más astros. Con `clock.shouldAnimate` activo, Sol y Luna quedan en su posición astronómica real; para añadir planetas propiamente lo abriremos en una fase aparte cuando lo pidas.

## Verificación

- Playwright: cargar `/`, entrar al Globe, screenshot orientando cámara hacia el limbo iluminado → confirmar disco solar con glow. Segundo screenshot hacia el terminador → confirmar Luna visible.
- Consola: sin warnings nuevos.

## Archivos tocados
- `src/components/globe/CesiumGlobe.tsx` (sólo bloques `Sun/Moon` y `bloom` del useEffect init)

Nada más.

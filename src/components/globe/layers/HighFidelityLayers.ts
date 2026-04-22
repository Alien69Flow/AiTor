import * as THREE from "three";

const GLOBE_RADIUS = 100;

// ─── Atmospheric Shader (cyan/violet halo, fresnel-based) ──────────
export function createAtmosphereShell(intensity = 1, accent = "#00ffff") {
  const color = new THREE.Color(accent);
  const geo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.18, 64, 64);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: color },
      uViolet: { value: new THREE.Color("#a020f0") },
      uIntensity: { value: intensity },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vPos;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform vec3 uViolet;
      uniform float uIntensity;
      varying vec3 vNormal;
      varying vec3 vPos;
      void main() {
        float fresnel = pow(1.0 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
        vec3 mix1 = mix(uColor, uViolet, fresnel);
        gl_FragColor = vec4(mix1, fresnel * uIntensity * 0.85);
      }
    `,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "atmosphere_shell";
  return mesh;
}

// ─── Polar Auroras (curtain particle systems at both poles) ────────
export function createAuroraCurtains(kpIndex: number) {
  const group = new THREE.Group();
  group.name = "polar_auroras";
  const intensity = Math.min(1, kpIndex / 9);
  const particleCount = Math.floor(800 + intensity * 2200);

  [{ pole: 1, hue: 0.45 }, { pole: -1, hue: 0.35 }].forEach(({ pole, hue }) => {
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const lat = (65 + Math.random() * 18) * pole; // 65–83° band
      const lon = Math.random() * 360 - 180;
      const altR = GLOBE_RADIUS * (1.04 + Math.random() * 0.08);
      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lon + 180) * (Math.PI / 180);
      positions[i * 3] = -altR * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = altR * Math.cos(phi);
      positions[i * 3 + 2] = altR * Math.sin(phi) * Math.sin(theta);
      const c = new THREE.Color().setHSL(hue + Math.random() * 0.15, 1, 0.55);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.55,
      vertexColors: true,
      transparent: true,
      opacity: 0.35 + intensity * 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const points = new THREE.Points(geom, mat);
    points.userData.pole = pole;
    group.add(points);
  });
  return group;
}

// ─── Van Allen Belts (toroidal plasma rings) ───────────────────────
export function createVanAllenBelts() {
  const group = new THREE.Group();
  group.name = "van_allen_belts";

  const beltDefs = [
    { radius: GLOBE_RADIUS * 1.45, tube: 6, color: 0x00ffff, opacity: 0.18 },
    { radius: GLOBE_RADIUS * 1.85, tube: 10, color: 0xff00ff, opacity: 0.14 },
  ];

  beltDefs.forEach((b) => {
    const geo = new THREE.TorusGeometry(b.radius, b.tube, 24, 120);
    const mat = new THREE.MeshBasicMaterial({
      color: b.color,
      transparent: true,
      opacity: b.opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const torus = new THREE.Mesh(geo, mat);
    // Tilt to match Earth's magnetic axis (~11° offset)
    torus.rotation.x = Math.PI / 2;
    torus.rotation.y = THREE.MathUtils.degToRad(11);
    group.add(torus);
  });
  return group;
}

// ─── Magnetic Flux Lines (pole-to-pole curves) ─────────────────────
export function createMagneticFlux() {
  const group = new THREE.Group();
  group.name = "magnetic_flux";
  const lineCount = 16;

  for (let i = 0; i < lineCount; i++) {
    const lon = (i / lineCount) * Math.PI * 2;
    const points: THREE.Vector3[] = [];
    for (let t = 0; t <= 50; t++) {
      const lat = -Math.PI / 2 + (t / 50) * Math.PI;
      // Curve outward at equator (dipole shape)
      const r = GLOBE_RADIUS * (1.05 + Math.cos(lat) * 0.55);
      points.push(new THREE.Vector3(
        -r * Math.cos(lat) * Math.cos(lon),
        r * Math.sin(lat),
        r * Math.cos(lat) * Math.sin(lon),
      ));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.25,
      blending: THREE.AdditiveBlending,
    });
    group.add(new THREE.Line(geo, mat));
  }
  // Tilt with magnetic axis
  group.rotation.z = THREE.MathUtils.degToRad(11);
  return group;
}

// ─── Telluric / Geodesic Grid (golden ley lines) ───────────────────
export function createTelluricGrid() {
  const group = new THREE.Group();
  group.name = "telluric_grid";
  const r = GLOBE_RADIUS * 1.005;

  // 12 great circles at icosahedral angles
  const tiltSet = [0, 30, 60, 90, 120, 150];
  tiltSet.forEach((tiltDeg, idx) => {
    const points: THREE.Vector3[] = [];
    for (let t = 0; t <= 128; t++) {
      const a = (t / 128) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: idx % 2 === 0 ? 0xffd700 : 0x00ffff,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
    });
    const line = new THREE.Line(geo, mat);
    line.rotation.x = THREE.MathUtils.degToRad(tiltDeg);
    line.rotation.z = THREE.MathUtils.degToRad(tiltDeg * 0.7);
    group.add(line);
  });
  return group;
}

// ─── NASA GIBS real-time cloud texture URL (today's MODIS Terra) ───
export function getGIBSCloudTexture() {
  const today = new Date();
  today.setUTCDate(today.getUTCDate() - 1); // GIBS lags ~1 day
  const date = today.toISOString().slice(0, 10);
  // Equirectangular MODIS Terra true color (cloud-rich) tile composite
  return `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=MODIS_Terra_CorrectedReflectance_TrueColor&CRS=EPSG:4326&BBOX=-90,-180,90,180&WIDTH=2048&HEIGHT=1024&FORMAT=image/png&TRANSPARENT=true&TIME=${date}`;
}
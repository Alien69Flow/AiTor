import { useEffect, useRef } from "react";
import * as THREE from "three";

const TOOLS = [
  { name: "Crypto", color: 0xffd700, icon: "₿" },
  { name: "Weather", color: 0x69af00, icon: "☁" },
  { name: "OSINT", color: 0xa855f7, icon: "◎" },
  { name: "Space", color: 0xffd700, icon: "✦" },
  { name: "UFO", color: 0xa855f7, icon: "◉" },
  { name: "GitHub", color: 0x69af00, icon: "⌥" },
  { name: "Firecrawl", color: 0xffd700, icon: "🔥" },
  { name: "NASA", color: 0xa855f7, icon: "🛰" },
  { name: "Quakes", color: 0x69af00, icon: "⚡" },
  { name: "Markets", color: 0xffd700, icon: "$" },
  { name: "Skills RAG", color: 0xa855f7, icon: "✿" },
  { name: "Polymarket", color: 0x69af00, icon: "%" },
];

export function NeuralBrain() {
  const mountRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const w = mount.clientWidth;
    const h = mount.clientHeight;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 1000);
    camera.position.set(0, 0, 6);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    // Outer brain wireframe sphere
    const brainGeo = new THREE.IcosahedronGeometry(2.4, 2);
    const brainMat = new THREE.MeshBasicMaterial({
      color: 0x69af00,
      wireframe: true,
      transparent: true,
      opacity: 0.12,
    });
    group.add(new THREE.Mesh(brainGeo, brainMat));

    // Inner pulse core
    const coreGeo = new THREE.IcosahedronGeometry(0.5, 1);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    // Distribute nodes on sphere (fibonacci)
    const N = TOOLS.length;
    const positions: THREE.Vector3[] = [];
    const R = 2.4;
    for (let i = 0; i < N; i++) {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / N);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      positions.push(
        new THREE.Vector3(
          R * Math.cos(theta) * Math.sin(phi),
          R * Math.sin(theta) * Math.sin(phi),
          R * Math.cos(phi),
        ),
      );
    }

    // Nodes
    const nodes: { mesh: THREE.Mesh; basePos: THREE.Vector3; data: typeof TOOLS[number] }[] = [];
    const nodeGeo = new THREE.SphereGeometry(0.11, 16, 16);
    positions.forEach((p, i) => {
      const data = TOOLS[i];
      const mat = new THREE.MeshBasicMaterial({ color: data.color });
      const mesh = new THREE.Mesh(nodeGeo, mat);
      mesh.position.copy(p);
      mesh.userData = { index: i };
      group.add(mesh);

      // Glow halo
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 16, 16),
        new THREE.MeshBasicMaterial({ color: data.color, transparent: true, opacity: 0.18 }),
      );
      mesh.add(halo);

      nodes.push({ mesh, basePos: p.clone(), data });
    });

    // Connections between nearby nodes
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.25,
    });
    const lineGeo = new THREE.BufferGeometry();
    const linePts: number[] = [];
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        if (positions[i].distanceTo(positions[j]) < 2.6) {
          linePts.push(...positions[i].toArray(), ...positions[j].toArray());
        }
      }
    }
    lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePts, 3));
    group.add(new THREE.LineSegments(lineGeo, lineMat));

    // Raycaster for hover
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(-10, -10);
    const onMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      if (labelRef.current) {
        labelRef.current.style.left = `${e.clientX - rect.left + 12}px`;
        labelRef.current.style.top = `${e.clientY - rect.top + 12}px`;
      }
    };
    renderer.domElement.addEventListener("mousemove", onMove);

    let raf = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      const t = clock.getElapsedTime();
      group.rotation.y = t * 0.15;
      group.rotation.x = Math.sin(t * 0.1) * 0.2;
      core.scale.setScalar(1 + Math.sin(t * 2) * 0.15);

      nodes.forEach((n, i) => {
        const pulse = 1 + Math.sin(t * 2 + i) * 0.25;
        n.mesh.scale.setScalar(pulse);
      });

      // Hover detection
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(nodes.map((n) => n.mesh));
      if (hits.length && labelRef.current) {
        const idx = (hits[0].object.userData as { index: number }).index;
        const d = TOOLS[idx];
        labelRef.current.textContent = `${d.icon}  ${d.name}`;
        labelRef.current.style.opacity = "1";
      } else if (labelRef.current) {
        labelRef.current.style.opacity = "0";
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      if (!mount) return;
      const w2 = mount.clientWidth;
      const h2 = mount.clientHeight;
      camera.aspect = w2 / h2;
      camera.updateProjectionMatrix();
      renderer.setSize(w2, h2);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("mousemove", onMove);
      renderer.dispose();
      brainGeo.dispose();
      brainMat.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      nodeGeo.dispose();
      lineGeo.dispose();
      lineMat.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full bg-gradient-to-b from-black via-[#0a0014] to-black overflow-hidden">
      <div ref={mountRef} className="absolute inset-0" />
      <div
        ref={labelRef}
        className="pointer-events-none absolute px-2.5 py-1 rounded-md bg-black/80 border border-[#69af00]/40 text-[10px] font-mono text-[#69af00] tracking-wider opacity-0 transition-opacity"
        style={{ left: 0, top: 0 }}
      />
      <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 text-center">
        <div className="text-[10px] font-mono tracking-[0.4em] text-[#69af00]/70 uppercase">
          Neural Cortex
        </div>
        <div className="text-[8px] font-mono tracking-widest text-muted-foreground/50 mt-0.5">
          {TOOLS.length} skills · agentic workflows · RAG online
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4 text-[9px] font-mono tracking-wider">
        <span className="text-[#ffd700]">● Data</span>
        <span className="text-[#a855f7]">● Intel</span>
        <span className="text-[#69af00]">● Tools</span>
      </div>
    </div>
  );
}
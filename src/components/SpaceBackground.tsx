import { useEffect, useRef } from 'react';
import cosmicBg from '@/assets/cosmic-background.webp';

interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  twinkleSpeed: number;
}

interface Nebula {
  x: number;
  y: number;
  radius: number;
  color: string;
  opacity: number;
  drift: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  color: string;
  life: number;
  maxLife: number;
}

interface GravityWave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  opacity: number;
}

/**
 * Ambient starfield behind the terminal.
 *
 * Cost control matters here: this canvas is always on screen, so it
 *  - caps the backing store at 2× DPR (crisp on retina without 3× fill cost),
 *  - stops the animation loop while the tab is hidden,
 *  - renders a single static frame when the user asks for reduced motion,
 *  - trims star count on small/narrow viewports,
 *  - removes dead particles/waves by index (the previous in-place `splice`
 *    inside `forEach` skipped the element right after each removal).
 */
export function SpaceBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduced = motionQuery.matches;

    let animationId = 0;
    let running = false;
    let width = window.innerWidth;
    let height = window.innerHeight;

    const stars: Star[] = [];
    const nebulae: Nebula[] = [];
    const particles: Particle[] = [];
    const gravityWaves: GravityWave[] = [];
    const maxParticles = 80;
    const nebulaColors = [
      'rgba(105, 175, 0, 0.12)', // Verde Lima Neón
      'rgba(255, 215, 0, 0.10)', // Dorado Real
      'rgba(105, 175, 0, 0.08)', // Verde Lima sutil
      'rgba(200, 180, 50, 0.06)', // Dorado apagado
      'rgba(80, 140, 0, 0.10)', // Verde oscuro
      'rgba(255, 200, 50, 0.08)', // Ámbar
    ];

    const starCount = () => (width < 640 ? 180 : width < 1280 ? 300 : 420);

    const resizeCanvas = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      // Draw in CSS pixels; the transform handles the device ratio once.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const initStars = () => {
      stars.length = 0;
      const count = starCount();
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: Math.random() * 2.5 + 0.3,
          speed: Math.random() * 0.2 + 0.03,
          opacity: Math.random() * 0.8 + 0.2,
          twinkleSpeed: Math.random() * 0.02 + 0.005,
        });
      }
    };

    const initNebulae = () => {
      nebulae.length = 0;
      for (let i = 0; i < 6; i++) {
        nebulae.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: Math.random() * 350 + 150,
          color: nebulaColors[i % nebulaColors.length],
          opacity: Math.random() * 0.5 + 0.3,
          drift: (Math.random() - 0.5) * 0.15,
        });
      }
    };

    const spawnGravityWave = () => {
      if (gravityWaves.length < 3 && Math.random() < 0.005) {
        gravityWaves.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: 0,
          maxRadius: Math.random() * 300 + 200,
          opacity: 0.3,
        });
      }
    };

    const spawnParticle = () => {
      if (particles.length < maxParticles && Math.random() < 0.15) {
        const isGold = Math.random() > 0.4;
        // Particles flow downward like gravity discharge
        particles.push({
          x: Math.random() * width,
          y: -10,
          vx: (Math.random() - 0.5) * 0.3,
          vy: Math.random() * 1.5 + 0.5,
          size: Math.random() * 2.5 + 1,
          opacity: Math.random() * 0.7 + 0.3,
          color: isGold ? 'rgba(255, 215, 0,' : 'rgba(105, 175, 0,',
          life: 0,
          maxLife: Math.random() * 400 + 300,
        });
      }
    };

    const drawNebulae = (drift: boolean) => {
      nebulae.forEach((nebula) => {
        const gradient = ctx.createRadialGradient(nebula.x, nebula.y, 0, nebula.x, nebula.y, nebula.radius);
        gradient.addColorStop(0, nebula.color);
        gradient.addColorStop(0.5, nebula.color.replace(/[\d.]+\)$/, '0.05)'));
        gradient.addColorStop(1, 'transparent');

        ctx.beginPath();
        ctx.arc(nebula.x, nebula.y, nebula.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        if (!drift) return;

        nebula.x += nebula.drift;
        nebula.y += nebula.drift * 0.3;

        if (nebula.x < -nebula.radius) nebula.x = width + nebula.radius;
        if (nebula.x > width + nebula.radius) nebula.x = -nebula.radius;
        if (nebula.y < -nebula.radius) nebula.y = height + nebula.radius;
        if (nebula.y > height + nebula.radius) nebula.y = -nebula.radius;
      });
    };

    const drawGravityWaves = () => {
      for (let i = gravityWaves.length - 1; i >= 0; i--) {
        const wave = gravityWaves[i];
        wave.radius += 1.5;
        wave.opacity = 0.3 * (1 - wave.radius / wave.maxRadius);

        if (wave.radius >= wave.maxRadius) {
          gravityWaves.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(105, 175, 0, ${wave.opacity})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Inner ring
        ctx.beginPath();
        ctx.arc(wave.x, wave.y, wave.radius * 0.7, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 215, 0, ${wave.opacity * 0.5})`;
        ctx.stroke();
      }
    };

    const drawStars = (animate: boolean) => {
      const now = Date.now();
      stars.forEach((star) => {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);

        // Mix of gold and lime stars
        const isGold = star.size > 1.5;
        ctx.fillStyle = isGold
          ? `rgba(255, 215, 0, ${star.opacity})`
          : `rgba(200, 255, 150, ${star.opacity})`;
        ctx.fill();

        // Add glow effect for larger stars
        if (star.size > 1.8) {
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.size * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = isGold
            ? `rgba(255, 215, 0, ${star.opacity * 0.25})`
            : `rgba(105, 175, 0, ${star.opacity * 0.25})`;
          ctx.fill();
        }

        if (!animate) return;

        // Twinkle effect
        star.opacity += Math.sin(now * star.twinkleSpeed) * 0.015;
        star.opacity = Math.max(0.1, Math.min(1, star.opacity));

        // Slow downward movement
        star.y += star.speed;
        if (star.y > height) {
          star.y = 0;
          star.x = Math.random() * width;
        }
      });
    };

    const drawParticles = () => {
      for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life++;

        // Slight horizontal drift
        particle.vx += (Math.random() - 0.5) * 0.02;

        const lifeRatio = 1 - particle.life / particle.maxLife;
        const currentOpacity = particle.opacity * lifeRatio;

        // Particle with glow trail
        const gradient = ctx.createRadialGradient(
          particle.x,
          particle.y,
          0,
          particle.x,
          particle.y,
          particle.size * 4,
        );
        gradient.addColorStop(0, `${particle.color}${currentOpacity})`);
        gradient.addColorStop(0.5, `${particle.color}${currentOpacity * 0.3})`);
        gradient.addColorStop(1, `${particle.color}0)`);

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * 4, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = `${particle.color}${currentOpacity})`;
        ctx.fill();

        // Remove dead particles or out of bounds
        if (particle.life >= particle.maxLife || particle.y > height + 50) {
          particles.splice(i, 1);
        }
      }
    };

    const renderStaticFrame = () => {
      ctx.clearRect(0, 0, width, height);
      drawNebulae(false);
      drawStars(false);
    };

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      drawNebulae(true);
      drawGravityWaves();
      drawStars(true);
      spawnParticle();
      spawnGravityWave();
      drawParticles();

      animationId = requestAnimationFrame(animate);
    };

    const start = () => {
      if (running) return;
      running = true;
      animationId = requestAnimationFrame(animate);
    };

    const stop = () => {
      running = false;
      cancelAnimationFrame(animationId);
    };

    const sync = () => {
      stop();
      if (document.hidden) return;
      if (reduced) {
        renderStaticFrame();
        return;
      }
      start();
    };

    resizeCanvas();
    initStars();
    initNebulae();
    sync();

    const handleResize = () => {
      resizeCanvas();
      initStars();
      initNebulae();
      particles.length = 0;
      gravityWaves.length = 0;
      if (reduced || document.hidden) renderStaticFrame();
    };

    const handleMotionChange = (event: MediaQueryListEvent) => {
      reduced = event.matches;
      particles.length = 0;
      gravityWaves.length = 0;
      sync();
    };

    const handleVisibility = () => sync();

    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibility);
    motionQuery.addEventListener('change', handleMotionChange);

    return () => {
      stop();
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
      motionQuery.removeEventListener('change', handleMotionChange);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
      {/* Base cosmic image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${cosmicBg})`,
          opacity: 0.6,
        }}
      />
      {/* Dark overlay for readability */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, hsl(220 25% 6% / 0.7) 0%, hsl(220 25% 4% / 0.9) 100%)',
        }}
      />
      {/* Animated canvas on top */}
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}

import { useEffect, useRef } from 'react';
import cosmicBg from '@/assets/cosmic-background.jpg';

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

export function SpaceBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const stars: Star[] = [];
    const nebulae: Nebula[] = [];
    const particles: Particle[] = [];
    const gravityWaves: GravityWave[] = [];
    const numStars = 400;
    const numNebulae = 6;
    const maxParticles = 80;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const initStars = () => {
      stars.length = 0;
      for (let i = 0; i < numStars; i++) {
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 2.5 + 0.3,
          speed: Math.random() * 0.2 + 0.03,
          opacity: Math.random() * 0.8 + 0.2,
          twinkleSpeed: Math.random() * 0.02 + 0.005,
        });
      }
    };

    const initNebulae = () => {
      nebulae.length = 0;
      const colors = [
        'rgba(105, 175, 0, 0.12)',    // Verde Lima Neón
        'rgba(255, 215, 0, 0.10)',    // Dorado Real
        'rgba(105, 175, 0, 0.08)',    // Verde Lima sutil
        'rgba(200, 180, 50, 0.06)',   // Dorado apagado
        'rgba(80, 140, 0, 0.10)',     // Verde oscuro
        'rgba(255, 200, 50, 0.08)',   // Ámbar
      ];
      for (let i = 0; i < numNebulae; i++) {
        nebulae.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          radius: Math.random() * 350 + 150,
          color: colors[i % colors.length],
          opacity: Math.random() * 0.5 + 0.3,
          drift: (Math.random() - 0.5) * 0.15,
        });
      }
    };

    // Spawn gravity waves periodically
    const spawnGravityWave = () => {
      if (gravityWaves.length < 3 && Math.random() < 0.005) {
        gravityWaves.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
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
          x: Math.random() * canvas.width,
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

    const drawNebulae = () => {
      nebulae.forEach((nebula) => {
        const gradient = ctx.createRadialGradient(
          nebula.x, nebula.y, 0,
          nebula.x, nebula.y, nebula.radius
        );
        gradient.addColorStop(0, nebula.color);
        gradient.addColorStop(0.5, nebula.color.replace(/[\d.]+\)$/, '0.05)'));
        gradient.addColorStop(1, 'transparent');
        
        ctx.beginPath();
        ctx.arc(nebula.x, nebula.y, nebula.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Slow drift
        nebula.x += nebula.drift;
        nebula.y += nebula.drift * 0.3;
        
        // Wrap around
        if (nebula.x < -nebula.radius) nebula.x = canvas.width + nebula.radius;
        if (nebula.x > canvas.width + nebula.radius) nebula.x = -nebula.radius;
        if (nebula.y < -nebula.radius) nebula.y = canvas.height + nebula.radius;
        if (nebula.y > canvas.height + nebula.radius) nebula.y = -nebula.radius;
      });
    };

    const drawGravityWaves = () => {
      gravityWaves.forEach((wave, index) => {
        wave.radius += 1.5;
        wave.opacity = 0.3 * (1 - wave.radius / wave.maxRadius);
        
        if (wave.radius >= wave.maxRadius) {
          gravityWaves.splice(index, 1);
          return;
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
      });
    };

    const drawStars = () => {
      stars.forEach((star) => {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        
        // Mix of gold and lime stars
        const isGold = star.size > 1.5;
        const color = isGold 
          ? `rgba(255, 215, 0, ${star.opacity})`
          : `rgba(200, 255, 150, ${star.opacity})`;
        ctx.fillStyle = color;
        ctx.fill();

        // Add glow effect for larger stars
        if (star.size > 1.8) {
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.size * 2.5, 0, Math.PI * 2);
          const glowColor = isGold 
            ? `rgba(255, 215, 0, ${star.opacity * 0.25})`
            : `rgba(105, 175, 0, ${star.opacity * 0.25})`;
          ctx.fillStyle = glowColor;
          ctx.fill();
        }

        // Twinkle effect
        star.opacity += Math.sin(Date.now() * star.twinkleSpeed) * 0.015;
        star.opacity = Math.max(0.1, Math.min(1, star.opacity));

        // Slow downward movement
        star.y += star.speed;
        if (star.y > canvas.height) {
          star.y = 0;
          star.x = Math.random() * canvas.width;
        }
      });
    };

    const drawParticles = () => {
      particles.forEach((particle, index) => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life++;

        // Slight horizontal drift
        particle.vx += (Math.random() - 0.5) * 0.02;

        const lifeRatio = 1 - particle.life / particle.maxLife;
        const currentOpacity = particle.opacity * lifeRatio;

        // Particle with glow trail
        const gradient = ctx.createRadialGradient(
          particle.x, particle.y, 0,
          particle.x, particle.y, particle.size * 4
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
        if (particle.life >= particle.maxLife || particle.y > canvas.height + 50) {
          particles.splice(index, 1);
        }
      });
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      drawNebulae();
      drawGravityWaves();
      drawStars();
      spawnParticle();
      spawnGravityWave();
      drawParticles();

      animationId = requestAnimationFrame(animate);
    };

    resizeCanvas();
    initStars();
    initNebulae();
    animate();

    const handleResize = () => {
      resizeCanvas();
      initStars();
      initNebulae();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="fixed inset-0 -z-10">
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
          background: 'radial-gradient(ellipse at center, hsl(220 25% 6% / 0.7) 0%, hsl(220 25% 4% / 0.9) 100%)' 
        }}
      />
      {/* Animated canvas on top */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
      />
    </div>
  );
}

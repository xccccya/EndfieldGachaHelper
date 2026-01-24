/**
 * 粒子背景组件
 * 使用 Canvas 绘制漂浮粒子效果
 */

import { useEffect, useRef, useCallback } from 'react';
import { useTheme } from '../theme';

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  opacitySpeed: number;
}

interface ParticleBackgroundProps {
  /** 粒子数量 */
  particleCount?: number;
  /** 粒子颜色 (CSS 颜色值) */
  color?: string;
  /** 最小粒子大小 */
  minSize?: number;
  /** 最大粒子大小 */
  maxSize?: number;
  /** 最大移动速度 */
  maxSpeed?: number;
  /** 是否连接附近粒子 */
  connectParticles?: boolean;
  /** 连接距离 */
  connectDistance?: number;
}

export function ParticleBackground({
  particleCount = 80,
  color,
  minSize = 1,
  maxSize = 3,
  maxSpeed = 0.5,
  connectParticles = true,
  connectDistance = 120,
}: ParticleBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>(0);
  const theme = useTheme();

  // 根据主题自动选择颜色
  const particleColor = color || (theme === 'dark' ? '#4fd1c5' : '#0d9488');

  // 创建粒子
  const createParticle = useCallback((width: number, height: number): Particle => {
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      size: minSize + Math.random() * (maxSize - minSize),
      speedX: (Math.random() - 0.5) * maxSpeed * 2,
      speedY: (Math.random() - 0.5) * maxSpeed * 2,
      opacity: 0.1 + Math.random() * 0.6,
      opacitySpeed: (Math.random() - 0.5) * 0.01,
    };
  }, [minSize, maxSize, maxSpeed]);

  // 初始化粒子
  const initParticles = useCallback((width: number, height: number) => {
    particlesRef.current = [];
    for (let i = 0; i < particleCount; i++) {
      particlesRef.current.push(createParticle(width, height));
    }
  }, [particleCount, createParticle]);

  // 更新粒子位置
  const updateParticle = useCallback((particle: Particle, width: number, height: number) => {
    particle.x += particle.speedX;
    particle.y += particle.speedY;
    particle.opacity += particle.opacitySpeed;

    // 边界检测 - 循环
    if (particle.x < 0) particle.x = width;
    if (particle.x > width) particle.x = 0;
    if (particle.y < 0) particle.y = height;
    if (particle.y > height) particle.y = 0;

    // 透明度闪烁
    if (particle.opacity <= 0.1 || particle.opacity >= 0.7) {
      particle.opacitySpeed *= -1;
    }
  }, []);

  // 绘制粒子
  const drawParticle = useCallback((ctx: CanvasRenderingContext2D, particle: Particle) => {
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fillStyle = particleColor;
    ctx.globalAlpha = particle.opacity;
    ctx.fill();
  }, [particleColor]);

  // 绘制粒子连线
  const drawConnections = useCallback((ctx: CanvasRenderingContext2D, particles: Particle[]) => {
    for (let i = 0; i < particles.length; i++) {
      const particleA = particles[i];
      if (!particleA) continue;
      
      for (let j = i + 1; j < particles.length; j++) {
        const particleB = particles[j];
        if (!particleB) continue;
        
        const dx = particleA.x - particleB.x;
        const dy = particleA.y - particleB.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < connectDistance) {
          const opacity = (1 - distance / connectDistance) * 0.15;
          ctx.beginPath();
          ctx.moveTo(particleA.x, particleA.y);
          ctx.lineTo(particleB.x, particleB.y);
          ctx.strokeStyle = particleColor;
          ctx.globalAlpha = opacity;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
  }, [particleColor, connectDistance]);

  // 动画循环
  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;

    // 清空画布
    ctx.clearRect(0, 0, width, height);

    // 更新和绘制粒子
    const particles = particlesRef.current;
    
    // 先绘制连线（在粒子下层）
    if (connectParticles) {
      drawConnections(ctx, particles);
    }

    // 绘制粒子
    for (const particle of particles) {
      updateParticle(particle, width, height);
      drawParticle(ctx, particle);
    }

    ctx.globalAlpha = 1;
    animationRef.current = requestAnimationFrame(animate);
  }, [connectParticles, drawConnections, updateParticle, drawParticle]);

  // 处理 canvas 大小
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;

      const { width, height } = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }

      // 重新初始化粒子
      initParticles(width, height);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [initParticles]);

  // 启动动画
  useEffect(() => {
    animate();
    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [animate]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}

export default ParticleBackground;

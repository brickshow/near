import { useEffect, useRef } from "react";

type ParticleOrbProps = { className?: string; connections?: boolean };
type Particle = { x: number; y: number; z: number; size: number; noise: number };

function makeParticles(): Particle[] {
  const particles: Particle[] = [];
  const count = 1500;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / (count - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const angle = goldenAngle * i;
    particles.push({
      x: Math.cos(angle) * radius,
      y,
      z: Math.sin(angle) * radius,
      size: 0.35 + Math.random() * 0.75,
      noise: Math.random() * Math.PI * 2,
    });
  }
  // Add a fine, irregular corona around the edge of the particle sphere.
  for (let i = 0; i < 340; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 0.94 + Math.random() * 0.13;
    particles.push({
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      z: (Math.random() - 0.5) * 0.16,
      size: 0.35 + Math.random() * 0.8,
      noise: Math.random() * Math.PI * 2,
    });
  }
  return particles;
}

export function ParticleOrb({ className = "", connections = false }: ParticleOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !context) return;

    const particles = makeParticles();
    const nerveNodes = connections ? particles.slice(0, 1500).filter((_, index) => index % 20 === 0) : [];
    const nerveEdges: Array<[Particle, Particle]> = [];
    for (let index = 0; index < nerveNodes.length; index += 1) {
      let links = 0;
      for (let next = index + 1; next < nerveNodes.length && links < 3; next += 1) {
        const from = nerveNodes[index];
        const to = nerveNodes[next];
        const distance = (from.x - to.x) ** 2 + (from.y - to.y) ** 2 + (from.z - to.z) ** 2;
        if (distance < 0.22) { nerveEdges.push([from, to]); links += 1; }
      }
    }
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const bounds = canvas.getBoundingClientRect();
    const width = bounds.width;
    const height = bounds.height;
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    context.scale(pixelRatio, pixelRatio);

    let animationFrame = 0;
    const render = (time: number) => {
      context.clearRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) * 0.43;
      const rotation = motionQuery.matches ? 0.4 : time * 0.00012;
      const tilt = -0.2;
      const cosY = Math.cos(rotation);
      const sinY = Math.sin(rotation);
      const cosX = Math.cos(tilt);
      const sinX = Math.sin(tilt);
      const pulse = motionQuery.matches ? 1 : 1 + Math.sin(time * 0.0014) * 0.018;
      const aura = context.createRadialGradient(cx, cy, radius * 0.12, cx, cy, radius * 1.55);
      aura.addColorStop(0, "rgba(99, 218, 255, 0.17)");
      aura.addColorStop(0.58, "rgba(43, 171, 236, 0.075)");
      aura.addColorStop(1, "rgba(73, 170, 222, 0)");
      context.fillStyle = aura;
      context.fillRect(cx - radius * 1.55, cy - radius * 1.55, radius * 3.1, radius * 3.1);
      const project = (x: number, y: number, z: number) => {
        const rotatedX = x * cosY - z * sinY;
        const rotatedZ = x * sinY + z * cosY;
        return {
          x: cx + rotatedX * radius * pulse,
          y: cy + (y * cosX - rotatedZ * sinX) * radius * pulse,
          z: rotatedZ,
        };
      };

      // Fine front-facing latitude and longitude traces give the point cloud a
      // holographic structure without enclosing it in a solid outline.
      context.lineWidth = 0.65;
      context.setLineDash([1.5, 2]);
      for (const latitude of [-0.72, -0.38, 0, 0.38, 0.72]) {
        context.beginPath();
        for (let index = 0; index <= 88; index += 1) {
          const angle = (index / 88) * Math.PI * 2;
          const ringRadius = Math.sqrt(1 - latitude * latitude);
          const point = project(Math.cos(angle) * ringRadius, latitude, Math.sin(angle) * ringRadius);
          if (point.z > -0.08) context.lineTo(point.x, point.y);
          else context.moveTo(point.x, point.y);
        }
        context.strokeStyle = "rgba(93, 217, 255, 0.27)";
        context.stroke();
      }
      for (let meridian = 0; meridian < 8; meridian += 1) {
        const longitude = (meridian / 8) * Math.PI;
        context.beginPath();
        for (let index = 0; index <= 80; index += 1) {
          const latitude = (index / 80 - 0.5) * Math.PI;
          const point = project(
            Math.cos(longitude) * Math.cos(latitude),
            Math.sin(latitude),
            Math.sin(longitude) * Math.cos(latitude),
          );
          if (point.z > -0.08) context.lineTo(point.x, point.y);
          else context.moveTo(point.x, point.y);
        }
        context.strokeStyle = "rgba(105, 224, 255, 0.23)";
        context.stroke();
      }
      context.setLineDash([]);

      if (connections) {
        context.lineWidth = 0.45;
        for (const [from, to] of nerveEdges) {
          const start = project(from.x, from.y, from.z);
          const end = project(to.x, to.y, to.z);
          if (start.z < -0.15 && end.z < -0.15) continue;
          const shimmer = motionQuery.matches ? 0.2 : 0.16 + Math.sin(time * 0.002 + from.noise) * 0.07;
          context.strokeStyle = `rgba(109, 235, 248, ${shimmer})`;
          context.beginPath();
          context.moveTo(start.x, start.y);
          context.lineTo(end.x, end.y);
          context.stroke();
        }
      }

      const projected = particles.map((particle) => {
        const x = particle.x * cosY - particle.z * sinY;
        const z = particle.x * sinY + particle.z * cosY;
        const y = particle.y * cosX - z * sinX;
        return { particle, x, y, z };
      }).sort((a, b) => a.z - b.z);

      for (const point of projected) {
        const depth = (point.z + 1) / 2;
        const flicker = 0.62 + Math.sin(time * 0.002 + point.particle.noise) * 0.28;
        const alpha = (0.12 + depth * 0.78) * flicker;
        const x = cx + point.x * radius * pulse;
        const y = cy + point.y * radius * pulse;
        const dotSize = point.particle.size * (0.65 + depth * 0.5);
        const cyan = Math.max(0, 1 - Math.abs(point.particle.noise % (Math.PI * 2) - Math.PI) / Math.PI);
        const red = Math.round(197 + cyan * 41);
        const green = Math.round(223 + cyan * 28);
        context.fillStyle = `rgba(${red}, ${green}, 255, ${alpha})`;
        context.fillRect(x, y, dotSize, dotSize);
      }

      const scanY = motionQuery.matches ? 0.2 : Math.sin(time * 0.00065) * 0.78;
      const scanRadius = Math.sqrt(1 - scanY * scanY);
      context.beginPath();
      for (let index = 0; index <= 80; index += 1) {
        const angle = (index / 80) * Math.PI;
        const point = project(Math.cos(angle) * scanRadius, scanY, Math.sin(angle) * scanRadius);
        if (index === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      }
      context.strokeStyle = "rgba(140, 242, 255, 0.9)";
      context.shadowColor = "rgba(52, 213, 255, 0.95)";
      context.shadowBlur = 6;
      context.lineWidth = 1;
      context.stroke();
      context.shadowBlur = 0;

      if (!motionQuery.matches) animationFrame = window.requestAnimationFrame(render);
    };

    if (motionQuery.matches) render(0);
    else animationFrame = window.requestAnimationFrame(render);
    const handleMotionChange = () => {
      window.cancelAnimationFrame(animationFrame);
      if (motionQuery.matches) render(0);
      else animationFrame = window.requestAnimationFrame(render);
    };
    motionQuery.addEventListener("change", handleMotionChange);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      motionQuery.removeEventListener("change", handleMotionChange);
    };
  }, [connections]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}

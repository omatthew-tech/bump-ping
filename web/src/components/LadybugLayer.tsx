import { useEffect, useMemo, useRef, useState } from 'react';
import LadybugSvg from './LadybugSvg';

type Bug = {
  id: string;
  variant: 'red' | 'green';
  size: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  headingDeg: number;
  legPhase: number;
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const rand = (min: number, max: number) => min + Math.random() * (max - min);

export default function LadybugLayer() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [bounds, setBounds] = useState({ w: 0, h: 0 });

  const [bugs, setBugs] = useState<Bug[]>(() => [
    {
      id: 'red',
      variant: 'red',
      size: 84,
      x: 80,
      y: 120,
      vx: 35,
      vy: 28,
      headingDeg: 0,
      legPhase: 0,
    },
    {
      id: 'green',
      variant: 'green',
      size: 74,
      x: 220,
      y: 320,
      vx: -30,
      vy: 32,
      headingDeg: 0,
      legPhase: 0,
    },
  ]);

  // Resize observer for bounds
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (!r) return;
      setBounds({ w: Math.floor(r.width), h: Math.floor(r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const margin = useMemo(() => 18, []);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const tick = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;

      setBugs((prev) => {
        if (!bounds.w || !bounds.h) return prev;

        // Update legs
        let next = prev.map((b) => ({ ...b, legPhase: (b.legPhase + dt * 1.8) % 1 }));

        // Movement + edge bounce
        next = next.map((b) => {
          const maxX = bounds.w - b.size - margin;
          const maxY = bounds.h - b.size - margin;

          let x = b.x + b.vx * dt;
          let y = b.y + b.vy * dt;
          let vx = b.vx;
          let vy = b.vy;

          if (x < margin) {
            x = margin;
            vx = Math.abs(vx);
          } else if (x > maxX) {
            x = maxX;
            vx = -Math.abs(vx);
          }

          if (y < margin) {
            y = margin;
            vy = Math.abs(vy);
          } else if (y > maxY) {
            y = maxY;
            vy = -Math.abs(vy);
          }

          // Gentle wander: tiny random steering, very infrequent.
          if (Math.random() < 0.01) {
            vx += rand(-8, 8);
            vy += rand(-8, 8);
          }

          // Clamp speed
          const speed = Math.hypot(vx, vy);
          const targetSpeed = clamp(speed, 26, 48);
          if (speed > 0.001) {
            vx = (vx / speed) * targetSpeed;
            vy = (vy / speed) * targetSpeed;
          }

          const headingDeg = (Math.atan2(vy, vx) * 180) / Math.PI + 90; // svg faces up

          return { ...b, x, y, vx, vy, headingDeg };
        });

        // Simple bump: if they overlap, nudge velocities apart slightly (no teleporting)
        if (next.length >= 2) {
          const a = next[0];
          const b = next[1];
          const ax = a.x + a.size / 2;
          const ay = a.y + a.size / 2;
          const bx = b.x + b.size / 2;
          const by = b.y + b.size / 2;
          const dx = ax - bx;
          const dy = ay - by;
          const dist = Math.hypot(dx, dy);
          const minDist = (a.size + b.size) * 0.28;
          if (dist > 0 && dist < minDist) {
            const nx = dx / dist;
            const ny = dy / dist;
            next = [
              { ...a, vx: a.vx + nx * 18, vy: a.vy + ny * 18 },
              { ...b, vx: b.vx - nx * 18, vy: b.vy - ny * 18 },
            ];
          }
        }

        return next;
      });

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [bounds.h, bounds.w, margin]);

  return (
    <div ref={ref} className="ladybugLayer" aria-hidden="true">
      {bugs.map((b) => (
        <div
          key={b.id}
          className="ladybug"
          style={{
            width: b.size,
            height: b.size,
            transform: `translate3d(${b.x}px, ${b.y}px, 0) rotate(${b.headingDeg}deg)`,
          }}
        >
          <LadybugSvg variant={b.variant} size={b.size} legPhase={b.legPhase} />
        </div>
      ))}
    </div>
  );
}



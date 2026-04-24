'use client';
import { useEffect, useRef, useCallback } from 'react';
import { createNoise2D } from 'simplex-noise';

export default function Waves({ dark, strokeColor, className = '' }) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const mouseRef = useRef({ x: -10, y: 0, lx: 0, ly: 0, sx: 0, sy: 0, v: 0, vs: 0, a: 0, set: false });
  const pathsRef = useRef([]);
  const linesRef = useRef([]);
  const noiseRef = useRef(null);
  const rafRef = useRef(null);
  const boundingRef = useRef(null);

  const stroke = strokeColor || (dark ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.05)');

  useEffect(() => {
    if (!containerRef.current || !svgRef.current) return;
    noiseRef.current = createNoise2D();

    const setSize = () => {
      boundingRef.current = containerRef.current.getBoundingClientRect();
      const { width, height } = boundingRef.current;
      svgRef.current.style.width = width + 'px';
      svgRef.current.style.height = height + 'px';
    };

    const setLines = () => {
      if (!boundingRef.current) return;
      const { width, height } = boundingRef.current;
      linesRef.current = [];
      pathsRef.current.forEach(p => p.remove());
      pathsRef.current = [];

      const xGap = 10;
      const yGap = 10;
      const oW = width + 200;
      const oH = height + 30;
      const totalLines = Math.ceil(oW / xGap);
      const totalPoints = Math.ceil(oH / yGap);
      const xStart = (width - xGap * totalLines) / 2;
      const yStart = (height - yGap * totalPoints) / 2;

      for (let i = 0; i < totalLines; i++) {
        const points = [];
        for (let j = 0; j < totalPoints; j++) {
          points.push({
            x: xStart + xGap * i,
            y: yStart + yGap * j,
            wave: { x: 0, y: 0 },
            cursor: { x: 0, y: 0, vx: 0, vy: 0 },
          });
        }
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', stroke);
        path.setAttribute('stroke-width', '1');
        svgRef.current.appendChild(path);
        pathsRef.current.push(path);
        linesRef.current.push(points);
      }
    };

    const onResize = () => { setSize(); setLines(); };

    const updateMouse = (x, y) => {
      if (!boundingRef.current) return;
      const m = mouseRef.current;
      m.x = x - boundingRef.current.left;
      m.y = y - boundingRef.current.top + window.scrollY;
      if (!m.set) { m.sx = m.x; m.sy = m.y; m.lx = m.x; m.ly = m.y; m.set = true; }
    };

    const onMouseMove = (e) => updateMouse(e.pageX, e.pageY);
    const onTouchMove = (e) => { e.preventDefault(); updateMouse(e.touches[0].clientX, e.touches[0].clientY); };

    const moved = (p, withCursor = true) => ({
      x: p.x + p.wave.x + (withCursor ? p.cursor.x : 0),
      y: p.y + p.wave.y + (withCursor ? p.cursor.y : 0),
    });

    const tick = (time) => {
      const m = mouseRef.current;
      const noise = noiseRef.current;
      if (!noise) return;

      m.sx += (m.x - m.sx) * 0.1;
      m.sy += (m.y - m.sy) * 0.1;
      const dx = m.x - m.lx;
      const dy = m.y - m.ly;
      m.v = Math.hypot(dx, dy);
      m.vs += (m.v - m.vs) * 0.1;
      m.vs = Math.min(100, m.vs);
      m.lx = m.x;
      m.ly = m.y;
      m.a = Math.atan2(dy, dx);

      linesRef.current.forEach((points) => {
        points.forEach((p) => {
          const mv = noise((p.x + time * 0.008) * 0.003, (p.y + time * 0.003) * 0.002) * 8;
          p.wave.x = Math.cos(mv) * 12;
          p.wave.y = Math.sin(mv) * 6;

          const pdx = p.x - m.sx;
          const pdy = p.y - m.sy;
          const d = Math.hypot(pdx, pdy);
          const l = Math.max(175, m.vs);
          if (d < l) {
            const s = 1 - d / l;
            const f = Math.cos(d * 0.001) * s;
            p.cursor.vx += Math.cos(m.a) * f * l * m.vs * 0.00035;
            p.cursor.vy += Math.sin(m.a) * f * l * m.vs * 0.00035;
          }
          p.cursor.vx += -p.cursor.x * 0.01;
          p.cursor.vy += -p.cursor.y * 0.01;
          p.cursor.vx *= 0.95;
          p.cursor.vy *= 0.95;
          p.cursor.x = Math.min(50, Math.max(-50, p.cursor.x + p.cursor.vx));
          p.cursor.y = Math.min(50, Math.max(-50, p.cursor.y + p.cursor.vy));
        });
      });

      linesRef.current.forEach((points, idx) => {
        if (points.length < 2 || !pathsRef.current[idx]) return;
        const first = moved(points[0], false);
        let d = `M ${first.x} ${first.y}`;
        for (let i = 1; i < points.length; i++) {
          const c = moved(points[i]);
          d += `L ${c.x} ${c.y}`;
        }
        pathsRef.current[idx].setAttribute('d', d);
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    setSize();
    setLines();
    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', onMouseMove);
    containerRef.current.addEventListener('touchmove', onTouchMove, { passive: false });
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouseMove);
      containerRef.current?.removeEventListener('touchmove', onTouchMove);
    };
  }, [stroke]);

  return (
    <div ref={containerRef} className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      <svg ref={svgRef} className="block w-full h-full" xmlns="http://www.w3.org/2000/svg" />
    </div>
  );
}

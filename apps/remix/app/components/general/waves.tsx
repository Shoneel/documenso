import { useEffect, useRef } from 'react';

/**
 * Animated Perlin-noise wave field, rendered to a canvas.
 *
 * Adapted from the React Bits `Waves` component. Changes from the upstream
 * source, and why:
 *
 * - Ported to TypeScript. This app typechecks with `tsc` and does not enable
 *   `allowJs`, so the original `.jsx` would not compile.
 * - Dropped the `console.log('Waves mounted')` left in the source.
 * - The `Noise` instance is created lazily instead of `useRef(new Noise(...))`,
 *   which allocated a fresh instance (and called `Math.random()`) on every
 *   render and during SSR, only to throw it away.
 * - Dropped the `.waves::before` cursor dot. Its transform read
 *   `translate3d(calc(var(-0.5rem) - 50%), calc(var(50%) - 50%), 0)` — `var()`
 *   takes a custom-property name, so those are invalid declarations that no
 *   browser applies. The intent was clearly `var(--x)` / `var(--y)`, but the
 *   dot is `#160000` on a `#0d1117` panel, so it would be invisible anyway.
 * - `touchmove` is registered `passive: true`. The source passed
 *   `passive: false`, which tells the browser to expect `preventDefault()` and
 *   blocks scroll optimisation — the handler never calls it.
 * - Uses a `ResizeObserver` on the container rather than only `window.resize`,
 *   so the field re-lays-out when the panel changes size for any reason.
 * - Pauses when the container has zero size. The sign-in panel is
 *   `hidden md:flex`, so on mobile this mounts at 0x0 and the original would
 *   have run a `requestAnimationFrame` loop forever drawing nothing.
 * - Honours `prefers-reduced-motion`: draws one static frame instead of
 *   animating.
 *
 * The canvas is decorative and marked `aria-hidden`.
 */

class Grad {
  constructor(
    public x: number,
    public y: number,
    public z: number,
  ) {}

  dot2(x: number, y: number): number {
    return this.x * x + this.y * y;
  }
}

const PERMUTATION = [
  151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21,
  10, 23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33, 88, 237, 149,
  56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229,
  122, 60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209,
  76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217,
  226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42,
  223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98,
  108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179,
  162, 241, 81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121, 50,
  45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180,
];

class Noise {
  private grad3: Grad[];
  private perm = new Array<number>(512);
  private gradP = new Array<Grad>(512);

  constructor(seed = 0) {
    this.grad3 = [
      new Grad(1, 1, 0),
      new Grad(-1, 1, 0),
      new Grad(1, -1, 0),
      new Grad(-1, -1, 0),
      new Grad(1, 0, 1),
      new Grad(-1, 0, 1),
      new Grad(1, 0, -1),
      new Grad(-1, 0, -1),
      new Grad(0, 1, 1),
      new Grad(0, -1, 1),
      new Grad(0, 1, -1),
      new Grad(0, -1, -1),
    ];
    this.seed(seed);
  }

  seed(seed: number): void {
    if (seed > 0 && seed < 1) {
      seed *= 65536;
    }
    seed = Math.floor(seed);
    if (seed < 256) {
      seed |= seed << 8;
    }

    for (let i = 0; i < 256; i++) {
      const v = i & 1 ? PERMUTATION[i] ^ (seed & 255) : PERMUTATION[i] ^ ((seed >> 8) & 255);
      this.perm[i] = this.perm[i + 256] = v;
      this.gradP[i] = this.gradP[i + 256] = this.grad3[v % 12];
    }
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(a: number, b: number, t: number): number {
    return (1 - t) * a + t * b;
  }

  perlin2(x: number, y: number): number {
    let X = Math.floor(x);
    let Y = Math.floor(y);

    x -= X;
    y -= Y;
    X &= 255;
    Y &= 255;

    const n00 = this.gradP[X + this.perm[Y]].dot2(x, y);
    const n01 = this.gradP[X + this.perm[Y + 1]].dot2(x, y - 1);
    const n10 = this.gradP[X + 1 + this.perm[Y]].dot2(x - 1, y);
    const n11 = this.gradP[X + 1 + this.perm[Y + 1]].dot2(x - 1, y - 1);

    const u = this.fade(x);

    return this.lerp(this.lerp(n00, n10, u), this.lerp(n01, n11, u), this.fade(y));
  }
}

type Point = {
  x: number;
  y: number;
  wave: { x: number; y: number };
  cursor: { x: number; y: number; vx: number; vy: number };
};

export type WavesProps = {
  /**
   * Any CSS colour. Defaults to `currentColor`, which resolves against the
   * container's computed colour — set it with a Tailwind text utility on the
   * element so the brand ramp stays the single source of truth.
   */
  lineColor?: string;
  backgroundColor?: string;
  waveSpeedX?: number;
  waveSpeedY?: number;
  waveAmpX?: number;
  waveAmpY?: number;
  xGap?: number;
  yGap?: number;
  friction?: number;
  tension?: number;
  maxCursorMove?: number;
  style?: React.CSSProperties;
  className?: string;
};

export const Waves = ({
  lineColor = 'currentColor',
  backgroundColor = 'transparent',
  waveSpeedX = 0.0125,
  waveSpeedY = 0.005,
  waveAmpX = 32,
  waveAmpY = 16,
  xGap = 10,
  yGap = 32,
  friction = 0.925,
  tension = 0.005,
  maxCursorMove = 100,
  style = {},
  className = '',
}: WavesProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const configRef = useRef({
    lineColor,
    waveSpeedX,
    waveSpeedY,
    waveAmpX,
    waveAmpY,
    friction,
    tension,
    maxCursorMove,
    xGap,
    yGap,
  });

  useEffect(() => {
    configRef.current = {
      lineColor,
      waveSpeedX,
      waveSpeedY,
      waveAmpX,
      waveAmpY,
      friction,
      tension,
      maxCursorMove,
      xGap,
      yGap,
    };
  }, [lineColor, waveSpeedX, waveSpeedY, waveAmpX, waveAmpY, friction, tension, maxCursorMove, xGap, yGap]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;

    if (!container || !canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return;
    }

    const noise = new Noise(Math.random());
    const bounding = { width: 0, height: 0, left: 0, top: 0 };
    const mouse = { x: -10, y: 0, lx: 0, ly: 0, sx: 0, sy: 0, v: 0, vs: 0, a: 0, set: false };

    let lines: Point[][] = [];
    let frameId: number | null = null;

    // `currentColor` is meaningful in CSS but not to the canvas 2D context, so
    // resolve it once against the container's computed colour.
    const strokeColor = () => {
      const configured = configRef.current.lineColor;

      return configured === 'currentColor' ? getComputedStyle(container).color : configured;
    };

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const setSize = () => {
      const rect = container.getBoundingClientRect();

      bounding.width = rect.width;
      bounding.height = rect.height;
      bounding.left = rect.left;
      bounding.top = rect.top;

      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    const setLines = () => {
      const { width, height } = bounding;
      const { xGap, yGap } = configRef.current;

      lines = [];

      const oWidth = width + 200;
      const oHeight = height + 30;
      const totalLines = Math.ceil(oWidth / xGap);
      const totalPoints = Math.ceil(oHeight / yGap);
      const xStart = (width - xGap * totalLines) / 2;
      const yStart = (height - yGap * totalPoints) / 2;

      for (let i = 0; i <= totalLines; i++) {
        const points: Point[] = [];

        for (let j = 0; j <= totalPoints; j++) {
          points.push({
            x: xStart + xGap * i,
            y: yStart + yGap * j,
            wave: { x: 0, y: 0 },
            cursor: { x: 0, y: 0, vx: 0, vy: 0 },
          });
        }

        lines.push(points);
      }
    };

    const movePoints = (time: number) => {
      const { waveSpeedX, waveSpeedY, waveAmpX, waveAmpY, friction, tension, maxCursorMove } = configRef.current;

      lines.forEach((points) => {
        points.forEach((p) => {
          const move = noise.perlin2((p.x + time * waveSpeedX) * 0.002, (p.y + time * waveSpeedY) * 0.0015) * 12;

          p.wave.x = Math.cos(move) * waveAmpX;
          p.wave.y = Math.sin(move) * waveAmpY;

          const dx = p.x - mouse.sx;
          const dy = p.y - mouse.sy;
          const dist = Math.hypot(dx, dy);
          const l = Math.max(175, mouse.vs);

          if (dist < l) {
            const s = 1 - dist / l;
            const f = Math.cos(dist * 0.001) * s;

            p.cursor.vx += Math.cos(mouse.a) * f * l * mouse.vs * 0.00065;
            p.cursor.vy += Math.sin(mouse.a) * f * l * mouse.vs * 0.00065;
          }

          p.cursor.vx += (0 - p.cursor.x) * tension;
          p.cursor.vy += (0 - p.cursor.y) * tension;
          p.cursor.vx *= friction;
          p.cursor.vy *= friction;
          p.cursor.x += p.cursor.vx * 2;
          p.cursor.y += p.cursor.vy * 2;
          p.cursor.x = Math.min(maxCursorMove, Math.max(-maxCursorMove, p.cursor.x));
          p.cursor.y = Math.min(maxCursorMove, Math.max(-maxCursorMove, p.cursor.y));
        });
      });
    };

    const moved = (point: Point, withCursor = true) => ({
      x: Math.round((point.x + point.wave.x + (withCursor ? point.cursor.x : 0)) * 10) / 10,
      y: Math.round((point.y + point.wave.y + (withCursor ? point.cursor.y : 0)) * 10) / 10,
    });

    const drawLines = () => {
      const { width, height } = bounding;

      ctx.clearRect(0, 0, width, height);
      ctx.beginPath();
      ctx.strokeStyle = strokeColor();

      lines.forEach((points) => {
        let p1 = moved(points[0], false);

        ctx.moveTo(p1.x, p1.y);

        points.forEach((p, idx) => {
          const isLast = idx === points.length - 1;

          p1 = moved(p, !isLast);

          const p2 = moved(points[idx + 1] || points[points.length - 1], !isLast);

          ctx.lineTo(p1.x, p1.y);

          if (isLast) {
            ctx.moveTo(p2.x, p2.y);
          }
        });
      });

      ctx.stroke();
    };

    const tick = (t: number) => {
      mouse.sx += (mouse.x - mouse.sx) * 0.1;
      mouse.sy += (mouse.y - mouse.sy) * 0.1;

      const dx = mouse.x - mouse.lx;
      const dy = mouse.y - mouse.ly;
      const d = Math.hypot(dx, dy);

      mouse.v = d;
      mouse.vs += (d - mouse.vs) * 0.1;
      mouse.vs = Math.min(100, mouse.vs);
      mouse.lx = mouse.x;
      mouse.ly = mouse.y;
      mouse.a = Math.atan2(dy, dx);

      container.style.setProperty('--x', `${mouse.sx}px`);
      container.style.setProperty('--y', `${mouse.sy}px`);

      movePoints(t);
      drawLines();

      frameId = requestAnimationFrame(tick);
    };

    const stop = () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
    };

    // The panel this lives in is `hidden md:flex`, so on small viewports the
    // container measures 0x0. Running the loop there would burn frames drawing
    // nothing.
    const start = () => {
      if (frameId !== null || bounding.width === 0 || bounding.height === 0) {
        return;
      }

      if (prefersReducedMotion) {
        movePoints(0);
        drawLines();
        return;
      }

      frameId = requestAnimationFrame(tick);
    };

    const relayout = () => {
      setSize();
      setLines();

      if (bounding.width === 0 || bounding.height === 0) {
        stop();
      } else if (prefersReducedMotion) {
        movePoints(0);
        drawLines();
      } else {
        start();
      }
    };

    const updateMouse = (x: number, y: number) => {
      mouse.x = x - bounding.left;
      mouse.y = y - bounding.top;

      if (!mouse.set) {
        mouse.sx = mouse.x;
        mouse.sy = mouse.y;
        mouse.lx = mouse.x;
        mouse.ly = mouse.y;
        mouse.set = true;
      }
    };

    const onMouseMove = (e: MouseEvent) => updateMouse(e.clientX, e.clientY);

    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];

      if (touch) {
        updateMouse(touch.clientX, touch.clientY);
      }
    };

    relayout();

    const resizeObserver = new ResizeObserver(relayout);

    resizeObserver.observe(container);

    window.addEventListener('resize', relayout);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove, { passive: true });

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', relayout);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      stop();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full overflow-hidden ${className}`}
      style={{ backgroundColor, ...style }}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
};

export default Waves;

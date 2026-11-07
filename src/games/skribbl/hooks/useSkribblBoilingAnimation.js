/**
 * Skribbl "Boiling Line" Stop-Motion Glitch Animation
 * 
 * Rules:
 * - Logo: 5 FPS (200ms), 6 pre-generated transform variants looped, ±0.5px container shake,
 *   SVG feTurbulence + feDisplacementMap edge wobble.
 * - Avatars: 10 FPS (~100ms with independent 90–130ms intervals per avatar and phase offset),
 *   swapping between 4–5 face frames (eyes & mouths).
 * - Crown on purple mascot jitters ±1–2px on each tick.
 * - Discrete hard cuts: no tweening, no interpolation, no CSS transitions.
 * - Respects prefers-reduced-motion.
 */

import { useEffect } from 'react';
import { getEyeTransform, getMouthTransform } from '../utils/skribblAvatarLayout.js';

export const BOILING_CONFIG = {
  logo: {
    fps: 5,                  // 5 FPS (every 200ms)
    intervalMs: 200,
    variantCount: 6,         // 6 pre-generated variants in looped pool
    jitterTranslate: 0,      // No displacement (zero translate)
    jitterRotate: 0,         // No displacement (zero rotate)
    scaleMin: 0.99,
    scaleMax: 1.01,
    containerShake: 0,       // No displacement
    baseFrequency: 0.02,     // SVG feTurbulence
    displacementScale: 2,    // Subtle edge wobble
  },
  avatars: {
    fps: 10,                 // ~10 FPS (~100ms)
    minIntervalMs: 90,       // 90–130ms slightly different per avatar
    maxIntervalMs: 130,
    crownJitter: 0,          // No displacement
  }
};

// Pre-generated pool of 6 variants for logo with zero displacement (breathing scale only)
export const LOGO_VARIANTS = Array.from({ length: BOILING_CONFIG.logo.variantCount }, (_, i) => ({
  x: 0,
  y: 0,
  rot: 0,
  scale: i % 2 === 0 ? 1.01 : 0.99,
  seed: 42 + i * 37
}));

// 4–5 expressive face frames per avatar
export const AVATAR_FRAMES = [
  // 1: Red (angry / fierce)
  [
    { eyes: 16, mouth: 14 },
    { eyes: 5,  mouth: 14 },
    { eyes: 16, mouth: 17 },
    { eyes: 16, mouth: 15 },
    { eyes: 4,  mouth: 14 }
  ],
  // 2: Orange (quirky)
  [
    { eyes: 3, mouth: 2 },
    { eyes: 2, mouth: 3 },
    { eyes: 4, mouth: 1 },
    { eyes: 3, mouth: 6 },
    { eyes: 1, mouth: 2 }
  ],
  // 3: Yellow (skeptical / deadpan)
  [
    { eyes: 6, mouth: 3 },
    { eyes: 7, mouth: 2 },
    { eyes: 6, mouth: 4 },
    { eyes: 8, mouth: 3 },
    { eyes: 6, mouth: 1 }
  ],
  // 4: Green (cool sunglasses / grin)
  [
    { eyes: 10, mouth: 6 },
    { eyes: 10, mouth: 7 },
    { eyes: 9,  mouth: 6 },
    { eyes: 10, mouth: 8 },
    { eyes: 10, mouth: 11 }
  ],
  // 5: Cyan (intense)
  [
    { eyes: 7, mouth: 7 },
    { eyes: 8, mouth: 6 },
    { eyes: 7, mouth: 8 },
    { eyes: 6, mouth: 7 },
    { eyes: 7, mouth: 9 }
  ],
  // 6: Blue (surprised derp / wide open)
  [
    { eyes: 8, mouth: 8 },
    { eyes: 1, mouth: 8 },
    { eyes: 8, mouth: 10 },
    { eyes: 2, mouth: 8 },
    { eyes: 8, mouth: 11 }
  ],
  // 7: Purple (ninja / crowned)
  [
    { eyes: 11, mouth: 10 },
    { eyes: 12, mouth: 10 },
    { eyes: 11, mouth: 12 },
    { eyes: 13, mouth: 10 },
    { eyes: 11, mouth: 13 }
  ],
  // 8: Pink (cool shades / smirk)
  [
    { eyes: 12, mouth: 12 },
    { eyes: 12, mouth: 14 },
    { eyes: 13, mouth: 12 },
    { eyes: 12, mouth: 15 },
    { eyes: 12, mouth: 7 }
  ]
];

export const BOIL_SEEDS = [17, 43, 89, 137, 211, 307];

/**
 * Ensures the SVG feTurbulence filters for both logo and avatar line-boil exist in the DOM.
 */
export function ensureSvgFilters() {
  if (typeof document === 'undefined') return { logoTurb: null, avatarTurb: null };

  let logoTurb = document.getElementById('sk-boil-turb');
  let avatarTurb = document.getElementById('sk-avatar-turb');

  if (logoTurb && avatarTurb) {
    return { logoTurb, avatarTurb };
  }

  let svg = document.getElementById('sk-shared-boil-svg');
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('id', 'sk-shared-boil-svg');
    svg.setAttribute('style', 'position: absolute; width: 0; height: 0; pointer-events: none;');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = `
      <defs>
        <filter id="sk-boil-filter" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence id="sk-boil-turb" type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="42" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="sk-avatar-boil" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence id="sk-avatar-turb" type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="42" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    `;
    document.body.appendChild(svg);
  }

  logoTurb = document.getElementById('sk-boil-turb');
  avatarTurb = document.getElementById('sk-avatar-turb');
  return { logoTurb, avatarTurb };
}

/**
 * Initializes and starts the boiling stop-motion animation loop.
 * Updates line-boil filter seeds at ~11 FPS (every 90ms) for authentic hand-drawn border jitter.
 */
export function initSkribblBoilingAnimation() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};

  // Respect prefers-reduced-motion
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return () => {};
  }

  const { logoTurb, avatarTurb } = ensureSvgFilters();
  const container = document.querySelector('.sk-home-header');
  if (container) container.classList.add('sk-boil-active');

  let seedIdx = 0;
  let lastTime = performance.now();
  let accumulator = 0;
  const intervalMs = 90; // ~11 FPS stop-motion redraw rate
  let rafId;

  const tick = (now) => {
    const delta = now - lastTime;
    lastTime = now;
    accumulator += delta;

    if (accumulator >= intervalMs) {
      accumulator %= intervalMs;
      seedIdx = (seedIdx + 1) % BOIL_SEEDS.length;
      const seed = BOIL_SEEDS[seedIdx];

      if (avatarTurb) {
        avatarTurb.setAttribute('seed', seed.toString());
      }
      if (logoTurb) {
        logoTurb.setAttribute('seed', (seed + 29).toString());
      }
    }

    rafId = requestAnimationFrame(tick);
  };

  rafId = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(rafId);
    if (container) {
      container.classList.remove('sk-boil-active');
    }
  };
}

/**
 * React Hook for component integration
 */
export default function useSkribblBoilingAnimation() {
  useEffect(() => {
    const cleanup = initSkribblBoilingAnimation();
    return cleanup;
  }, []);
}


'use client';

import React, { useRef, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import TuwEmblem from './TuwEmblem';

// The intro plays once per browser session, on the homepage only, so deep
// links (shared product pages) and repeat visits open straight to content.
// The root layout reads a cookie (written below when the intro finishes) and
// gates this component on the server, so repeat visitors get no overlay at all.
import { INTRO_SEEN_KEY, markIntroSeen } from '@storefront/lib/intro';
import { introFlags, nextIntroPhase, type IntroPhase } from '@storefront/lib/intro-machine';

const BRAND_WORDS = [
  { word: 'THE', chars: ['T', 'H', 'E'] },
  { word: 'UNPLUGGED', chars: ['U', 'N', 'P', 'L', 'U', 'G', 'G', 'E', 'D'] },
  { word: 'WEAR', chars: ['W', 'E', 'A', 'R'] },
];

export default function BrandIntro() {
  // Homespace ID Staggered Letter-by-Letter Architecture:
  // 1. Initial State (0ms - 100ms): Dark stage; official leaping deer stag emblem blooms
  // 2. Letter-by-Letter Load (320ms - 1100ms): 16 letters ascend sequentially through masked viewports (45ms stagger)
  // 3. Brand Crest Settle (1250ms): Gold accent rule and slow-living atelier sub-mark fade in
  // 4. Shutter Up Curtain Transition (2050ms): Shutter sweeps straight UP (translateY -120vh) unveiling the home page
  // 5. Completion (3000ms): Clean unmount from DOM, restoring viewport scrolling
  const [phase, setPhase] = useState<IntroPhase>('staged');
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const { emblemVisible, lettersVisible, taglineVisible, shutterUp, done } = introFlags(phase);
  const isHome = usePathname() === '/';

  useEffect(() => {
    const clearTimers = () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
    const restoreScroll = () => {
      if (typeof window !== 'undefined') document.body.style.overflow = '';
    };

    if (!isHome) {
      setPhase('done');
      return;
    }
    let seenThisSession = false;
    if (typeof window !== 'undefined') {
      try {
        seenThisSession = sessionStorage.getItem(INTRO_SEEN_KEY) === '1';
      } catch {
        
      }
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || seenThisSession) {
        setPhase('done');
        return;
      }
      document.body.style.overflow = 'hidden';
    }

    timersRef.current = [
      setTimeout(() => setPhase('emblem'), 100),
      setTimeout(() => setPhase('letters'), 320),
      setTimeout(() => setPhase('tagline'), 1250),
      setTimeout(() => setPhase('shutter'), 2050),
      setTimeout(() => { markIntroSeen(); setPhase('done'); }, 3000),
    ];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      clearTimers();
      restoreScroll();
      markIntroSeen();
      setPhase('done');
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimers();
      restoreScroll();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isHome]);

  if (!isHome || done) {
    return null;
  }

  const handleSkip = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    if (typeof window !== 'undefined') {
      document.body.style.overflow = '';
    }
    markIntroSeen();
    setPhase('done');
  };

  // Compute global running letter index for smooth cross-word staggering
  let globalCharIndex = 0;

  return (
    <>
    <aside
      aria-label="The Unplugged Wear Brand Introduction"
      aria-live="polite"
      onClick={handleSkip}
      className={`intro-shutter-wrap select-none cursor-pointer ${
        shutterUp ? 'intro-shutter-up' : ''
      }`}
    >
      {/* Centered Brand Presentation matching Homespace ID standard */}
      <div className="relative z-10 flex flex-col items-center justify-center px-4 max-w-5xl mx-auto text-center pointer-events-none">
        {/* Official Leaping Deer Stag Emblem */}
        <div
          className={`intro-emblem-motion flex items-center justify-center mb-5 sm:mb-6 ${
            emblemVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-8 scale-90'
          }`}
        >
          <TuwEmblem className="w-16 h-16 sm:w-20 sm:h-20 text-white drop-shadow-2xl" />
        </div>

        {/* Brand Text Wrapper with Staggered Letter-by-Letter Masks.
            Rendered as <p> rather than <h1> so the page keeps exactly one
            content heading (the hero) for crawlers and screen readers. */}
        <p className="flex flex-wrap items-center justify-center gap-x-4 sm:gap-x-6 gap-y-2 intro-brand-typography font-heading font-medium text-white tracking-tight">
          {BRAND_WORDS.map((item, wordIdx) => (
            <span key={wordIdx} className="inline-flex items-center whitespace-nowrap">
              {item.chars.map((char, charIdx) => {
                const currentDelay = globalCharIndex * 45;
                globalCharIndex += 1;
                return (
                  <span
                    key={charIdx}
                    className={`intro-letter-mask ${
                      lettersVisible ? 'intro-letter-revealed' : ''
                    }`}
                  >
                    <span
                      style={{
                        transitionDelay: lettersVisible ? `${currentDelay}ms` : '0ms',
                      }}
                      className="intro-letter-char"
                    >
                      {char}
                    </span>
                  </span>
                );
              })}
            </span>
          ))}
        </p>

        {/* Architectural Subtitle & Refined Gold Accent Rule */}
        <div
          className={`flex flex-col items-center space-y-3 mt-5 sm:mt-6 transition-all duration-700 ${
            taglineVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <div className="w-16 h-px bg-store-gold opacity-80" />
          <p className="font-sans font-medium text-sm  uppercase tracking-widest text-white/70">
            Slow-Living Luxury • Architectural Form
          </p>
        </div>
      </div>

      {/* Architectural Shutter Bottom Lip (20vh tail extending below panel) */}
      <div className="intro-shutter-lip">
        <div className="w-full h-px bg-gradient-to-r from-transparent via-store-gold/40 to-transparent" />
      </div>

      {/* Accessible Skip Button */}
      <button
        type="button"
        onClick={handleSkip}
        className="absolute top-6 right-6 min-h-6 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-sans uppercase tracking-wider text-white/80 hover:text-white transition-colors z-20 cursor-pointer pointer-events-auto"
      >
        Skip [Esc]
      </button>
    </aside>
    </>
  );
}

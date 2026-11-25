'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ChevronLeft, ChevronRight, Maximize2, Play } from 'lucide-react';
import ImageWithFallback from '@storefront/components/ui/ImageWithFallback';
import Modal from '@storefront/components/ui/Modal';
import { isPlaceholderImage } from '@storefront/lib/product';

export interface ProductGalleryProps {
  images: {
    url: string;
    alt: string;
    color?: string;
    label?: string;
  }[];
  title: string;
  videoUrl?: string;
  selectedColorValue?: string;
  /** Colour names by value, so the gallery can say which colour a photo shows. */
  colors?: { value: string; name: string }[];
}

type Slide =
  | { kind: 'image'; url: string; alt: string; label?: string; color?: string }
  | { kind: 'video'; url: string; alt: string };

const navButton =
  'w-9 h-9 rounded-full bg-white/85 backdrop-blur-xs border border-store-card-border flex items-center justify-center text-store-charcoal hover:bg-white transition active:scale-90 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-gold';

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Desktop: every photo stacked full height down the left while the details
// panel stays in view on the right; click a photo to enlarge it. Phone: a swipeable strip
// with tappable dots. Choosing a colour shows that colour's photos first; if
// it has none of its own, every photo stays and a note says which colour they
// show. The lightbox steps with the arrow keys.
export default function ProductGallery({
  images,
  title,
  videoUrl,
  selectedColorValue,
  colors = [],
}: ProductGalleryProps) {
  const colourKey = selectedColorValue?.toLowerCase() ?? '';

  const { slides, shownColour } = useMemo(() => {
    const tagged = colourKey ? images.filter((img) => img.color?.toLowerCase() === colourKey) : [];
    const ordered = tagged.length ? [...tagged, ...images.filter((img) => !img.color)] : images;
    const list: Slide[] = ordered.map((img) => ({ kind: 'image', ...img }));
    if (videoUrl) list.push({ kind: 'video', url: videoUrl, alt: `${title} video` });
    // Every photo is of another colour: say which one, rather than imply it's this one.
    const otherColour =
      colourKey && !tagged.length ? images.find((img) => img.color && img.color.toLowerCase() !== colourKey)?.color : undefined;
    const name = otherColour ? colors.find((c) => c.value.toLowerCase() === otherColour.toLowerCase())?.name ?? otherColour : undefined;
    return { slides: list, shownColour: name };
  }, [images, videoUrl, title, colourKey, colors]);

  // The position resets to the first photo whenever the colour changes.
  const [position, setPosition] = useState({ key: colourKey, index: 0 });
  const activeIndex = position.key === colourKey ? Math.min(position.index, Math.max(0, slides.length - 1)) : 0;
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const total = slides.length;
  const active = slides[activeIndex];

  // Phone strip: scrolled by swiping; the dots and arrows scroll it too.
  const trackRef = useRef<HTMLDivElement>(null);
  const scrollTrackTo = useCallback((index: number, smooth = true) => {
    const track = trackRef.current;
    if (!track || track.offsetWidth === 0) return; // hidden on desktop
    track.scrollTo({ left: index * track.offsetWidth, behavior: smooth && !reducedMotion() ? 'smooth' : 'auto' });
  }, []);

  const goTo = useCallback(
    (index: number) => {
      if (total === 0) return;
      const next = (index + total) % total;
      setPosition({ key: colourKey, index: next });
      scrollTrackTo(next);
    },
    [total, colourKey, scrollTrackTo]
  );

  // Desktop stack: a new colour puts its photos first, so bring the top of
  // the stack back into view if the shopper has scrolled past it.
  const stackRef = useRef<HTMLUListElement>(null);
  const firstColour = useRef(colourKey);
  useEffect(() => {
    scrollTrackTo(0, false);
    if (firstColour.current === colourKey) return; // not on first render
    firstColour.current = colourKey;
    const stack = stackRef.current;
    if (stack && stack.offsetHeight > 0 && stack.getBoundingClientRect().top < 0) {
      stack.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    }
  }, [colourKey, scrollTrackTo]);

  const onTrackScroll = () => {
    const track = trackRef.current;
    if (!track || track.offsetWidth === 0) return;
    const index = Math.round(track.scrollLeft / track.offsetWidth);
    if (index !== activeIndex && index >= 0 && index < total) setPosition({ key: colourKey, index });
  };

  // Lightbox: left/right arrow keys step through.
  useEffect(() => {
    if (!isZoomOpen || total < 2) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') goTo(activeIndex + 1);
      else if (event.key === 'ArrowLeft') goTo(activeIndex - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isZoomOpen, total, activeIndex, goTo]);

  // No photography yet: say so plainly instead of showing a borrowed picture.
  if (total === 0 || !active) {
    return (
      <div className="w-full aspect-4/5 bg-store-cream border border-store-card-border flex flex-col items-center justify-center gap-3 text-center p-8">
        <Camera size={28} className="text-store-text-secondary" aria-hidden="true" />
        <p className="text-sm font-medium text-store-charcoal">Photos coming soon</p>
        <p className="text-sm text-store-text-secondary max-w-xs">
          We’re photographing the {title}. Colours below show the shades it’s printed in.
        </p>
      </div>
    );
  }

  const positionText = `${active.kind === 'video' ? 'Video' : 'Photo'} ${activeIndex + 1} of ${total}`;

  const overlays = (slide: Slide) => (
    <>
      {slide.kind === 'image' && slide.label && (
        <span className="absolute top-4 left-4 text-xs font-mono tracking-wider font-semibold uppercase text-store-charcoal/90 bg-white/90 backdrop-blur-xs px-2.5 py-1 pointer-events-none shadow-2xs border border-store-card-border/60 z-10">
          {slide.label}
        </span>
      )}
      {slide.kind === 'image' && (isPlaceholderImage(slide.alt) || shownColour) && (
        <span className="absolute bottom-0 inset-x-0 bg-store-charcoal/80 text-white text-xs px-4 py-2 pointer-events-none">
          {[
            shownColour ? `Photo shows ${shownColour}` : null,
            isPlaceholderImage(slide.alt) ? 'Sample photo — final product photography coming soon' : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      )}
    </>
  );

  const media = (slide: Slide, fit: 'cover' | 'contain', eager?: boolean) =>
    slide.kind === 'video' ? (
      <video
        src={slide.url}
        controls
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={slide.alt}
        className={`w-full h-full ${fit === 'cover' ? 'object-cover' : 'object-contain'}`}
      />
    ) : (
      <ImageWithFallback
        src={slide.url}
        alt={slide.alt}
        loading={eager ? 'eager' : 'lazy'}
        className={`w-full h-full ${fit === 'cover' ? 'object-cover' : 'object-contain'}`}
      />
    );

  return (
    <div className="w-full" aria-roledescription="gallery" aria-label={`${title} photos`}>
      {/* Spoken when the photo changes, by any route (thumbnail, swipe, arrows). */}
      <p className="sr-only" aria-live="polite">
        {total > 1 ? `${positionText}: ${active.alt}` : ''}
      </p>

      {/* 1. DESKTOP: every photo stacked full height, scrolled past while the
          details panel stays in view (editorial layout). Click to enlarge. */}
      <ul ref={stackRef} className="hidden lg:flex flex-col gap-1 scroll-mt-24" aria-label={`${title} photos`}>
        {slides.map((slide, idx) => (
          <li
            key={`${slide.url}-${idx}`}
            className="relative w-full h-[calc(100svh-6rem)] min-h-[32rem] max-h-[68rem] overflow-hidden bg-store-cream group"
          >
            {slide.kind === 'video' ? (
              media(slide, 'cover', idx === 0)
            ) : (
              <button
                type="button"
                onClick={() => {
                  setPosition({ key: colourKey, index: idx });
                  setIsZoomOpen(true);
                }}
                aria-label={`Enlarge photo ${idx + 1} of ${total}: ${slide.alt}`}
                className="block w-full h-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-store-gold"
              >
                <ImageWithFallback
                  src={slide.url}
                  alt=""
                  loading={idx === 0 ? 'eager' : 'lazy'}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.015] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                />
              </button>
            )}
            {overlays(slide)}
            {total > 1 && (
              <span className="absolute top-4 right-4 text-xs font-medium tuw-tabular-nums text-store-charcoal/80 bg-white/85 backdrop-blur-xs px-2 py-0.5 pointer-events-none" aria-hidden="true">
                {idx + 1} / {total}
              </span>
            )}
          </li>
        ))}
      </ul>

      {/* 2. PHONE & TABLET: swipeable strip */}
      <div className="lg:hidden relative w-full aspect-3/4 bg-store-cream border border-store-card-border overflow-hidden">
        <div
          ref={trackRef}
          onScroll={onTrackScroll}
          className="flex h-full overflow-x-auto snap-x snap-mandatory overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {slides.map((slide, idx) => (
            <div
              key={`${slide.url}-${idx}`}
              className="relative w-full h-full shrink-0 snap-center snap-always"
              aria-hidden={idx !== activeIndex}
              inert={idx !== activeIndex}
            >
              {media(slide, 'cover', idx === 0)}
              {overlays(slide)}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setIsZoomOpen(true)}
          aria-label={`Enlarge ${active.alt}`}
          className={`absolute top-4 right-4 ${navButton} w-10! h-10!`}
        >
          <Maximize2 size={16} aria-hidden="true" />
        </button>

        {total > 1 && (
          <>
            <button type="button" onClick={() => goTo(activeIndex - 1)} aria-label="Previous photo" className={`absolute left-3 top-1/2 -translate-y-1/2 ${navButton}`}>
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => goTo(activeIndex + 1)} aria-label="Next photo" className={`absolute right-3 top-1/2 -translate-y-1/2 ${navButton}`}>
              <ChevronRight size={18} aria-hidden="true" />
            </button>

            {/* Dots: real buttons with a 24px tap area around the visible dot. */}
            <div
              className={`absolute left-1/2 -translate-x-1/2 flex items-center ${
                active.kind === 'image' && (isPlaceholderImage(active.alt) || shownColour) ? 'bottom-10' : 'bottom-2'
              }`}
            >
              {slides.map((slide, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`Show ${slide.kind === 'video' ? 'video' : `photo ${i + 1}`} of ${total}`}
                  aria-current={i === activeIndex ? 'true' : undefined}
                  className="h-6 min-w-6 px-1 flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-gold rounded-full"
                >
                  <span
                    className={`block h-2 rounded-full transition-all ${
                      i === activeIndex ? 'bg-store-charcoal w-5' : 'bg-store-charcoal/30 w-2'
                    }`}
                  />
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 3. LIGHTBOX */}
      <Modal
        isOpen={isZoomOpen}
        onClose={() => setIsZoomOpen(false)}
        maxWidth="max-w-4xl"
        title={title}
        subtitle={`${positionText} · ${active.alt}${total > 1 ? ' · Use ← → to move' : ''}`}
      >
        <div className="relative aspect-3/4 sm:aspect-4/3 w-full overflow-hidden bg-store-canvas">
          {media(active, 'contain', true)}

          {total > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/90 backdrop-blur-xs px-2 py-1 rounded-full border border-store-card-border shadow-xs">
              <button
                type="button"
                onClick={() => goTo(activeIndex - 1)}
                aria-label="Previous photo"
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-store-cream cursor-pointer text-store-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-gold"
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <span className="text-xs font-semibold text-store-charcoal tuw-tabular-nums">
                {activeIndex + 1} / {total}
              </span>
              <button
                type="button"
                onClick={() => goTo(activeIndex + 1)}
                aria-label="Next photo"
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-store-cream cursor-pointer text-store-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-gold"
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

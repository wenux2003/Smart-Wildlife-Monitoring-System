import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion.js";
import "./ParallaxCarousel.css";

export type StorySlide = {
  id: string;
  src: string;
  alt: string;
  category: string;
  title: string;
  description: string;
  credit: string;
  creditUrl: string;
  license: string;
  licenseUrl: string;
};

// Original carousel: automatic movement pauses for user interaction.
export function ParallaxCarousel({ slides }: { slides: StorySlide[] }) {
  const reduced = usePrefersReducedMotion();
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; scroll: number } | null>(null);
  const paused = useRef({
    hover: false,
    focus: false,
    pointer: false,
    until: 0,
  });
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const viewport = track.current;
    if (!viewport) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const bounds = viewport.getBoundingClientRect();
      viewport
        .querySelectorAll<HTMLElement>(".parallax-slide")
        .forEach((card) => {
          const box = card.getBoundingClientRect();
          const offset =
            (box.left + box.width / 2 - bounds.left - bounds.width / 2) /
            Math.max(bounds.width, 1);
          card.style.setProperty(
            "--photo-shift",
            reduced ? "0px" : `${Math.max(-24, Math.min(24, -offset * 32))}px`,
          );
        });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    // ResizeObserver is missing in older browsers and test environments; the parallax is decorative.
    const resize =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    resize?.observe(viewport);
    viewport.addEventListener("scroll", schedule, { passive: true });
    update();
    return () => {
      cancelAnimationFrame(frame);
      resize?.disconnect();
      viewport.removeEventListener("scroll", schedule);
    };
  }, [reduced, slides]);

  useEffect(() => {
    const viewport = track.current;
    // Without IntersectionObserver we cannot tell whether the carousel is on screen, so it stays still.
    if (
      !viewport ||
      reduced ||
      slides.length < 2 ||
      typeof IntersectionObserver === "undefined"
    )
      return;
    let frame = 0;
    let last = 0;
    let remainder = 0;
    let direction = 1;
    let visible = false;
    // Do not animate offscreen content or a background browser tab.
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    observer.observe(viewport);
    const advance = (now: number) => {
      const elapsed = last ? Math.min(now - last, 64) : 0;
      last = now;
      const interaction = paused.current;
      if (
        visible &&
        !document.hidden &&
        !interaction.hover &&
        !interaction.focus &&
        !interaction.pointer &&
        now >= interaction.until
      ) {
        const end = viewport.scrollWidth - viewport.clientWidth;
        if (end > 0) {
          // Turn gently at either end, with no jump or duplicate story cards.
          if (viewport.scrollLeft >= end - 1) direction = -1;
          else if (viewport.scrollLeft <= 0) direction = 1;
          remainder += (elapsed * 32 * direction) / 1000;
          const pixels = Math.trunc(remainder);
          if (pixels) {
            viewport.scrollLeft = Math.max(
              0,
              Math.min(end, viewport.scrollLeft + pixels),
            );
            remainder -= pixels;
          }
        }
      } else {
        remainder = 0;
      }
      frame = requestAnimationFrame(advance);
    };
    frame = requestAnimationFrame(advance);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [reduced, slides.length]);

  const moveTo = (index: number) => {
    const viewport = track.current;
    const card =
      viewport?.querySelectorAll<HTMLElement>(".parallax-slide")[index];
    if (!viewport || !card) return;
    viewport.scrollTo({
      left:
        viewport.scrollLeft +
        card.getBoundingClientRect().left -
        viewport.getBoundingClientRect().left,
      behavior: reduced ? "instant" : "smooth",
    });
  };
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "Home") moveTo(0);
    else if (event.key === "End") moveTo(slides.length - 1);
    else {
      const viewport = track.current!;
      const start = viewport.getBoundingClientRect().left;
      const cards = [
        ...viewport.querySelectorAll<HTMLElement>(".parallax-slide"),
      ];
      const nearest = cards.reduce(
        (best, card, index) =>
          Math.abs(card.getBoundingClientRect().left - start) <
          Math.abs(cards[best].getBoundingClientRect().left - start)
            ? index
            : best,
        0,
      );
      moveTo(
        Math.max(
          0,
          Math.min(
            slides.length - 1,
            nearest + (event.key === "ArrowRight" ? 1 : -1),
          ),
        ),
      );
    }
  };
  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    paused.current.pointer = true;
    // Touch keeps native scrolling and vertical page gestures.
    if (
      event.pointerType !== "mouse" ||
      !track.current ||
      (event.target as HTMLElement).closest("a")
    )
      return;
    event.preventDefault();
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      scroll: track.current.scrollLeft,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };
  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    paused.current.pointer = false;
    paused.current.until = performance.now() + 1500;
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  if (!slides.length) return null;
  return (
    <div
      className="parallax-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="Conservation stories"
    >
      <div
        ref={track}
        className={`parallax-carousel-track${dragging ? " is-dragging" : ""}`}
        tabIndex={0}
        role="group"
        aria-label="Illustrative conservation stories. Hover or focus to pause. Drag or swipe to explore, or use arrow keys, Home and End."
        onKeyDown={keyDown}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") paused.current.hover = true;
        }}
        onPointerLeave={() => {
          paused.current.hover = false;
          paused.current.pointer = !!drag.current;
        }}
        onFocusCapture={() => {
          paused.current.focus = true;
        }}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            paused.current.focus = false;
        }}
        onWheel={() => {
          paused.current.until = performance.now() + 1500;
        }}
        onPointerDown={startDrag}
        onPointerMove={(event) => {
          if (
            !drag.current ||
            drag.current.id !== event.pointerId ||
            !track.current
          )
            return;
          track.current.scrollLeft =
            drag.current.scroll - (event.clientX - drag.current.x);
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={() => {
          drag.current = null;
          paused.current.pointer = false;
          setDragging(false);
        }}
      >
        <ol className="parallax-carousel-slides">
          {slides.map((slide, index) => (
            <li
              key={slide.id}
              className="parallax-slide"
              aria-label={`Illustrative story ${index + 1} of ${slides.length}`}
            >
              <figure className="parallax-carousel-card">
                <div className="parallax-photo">
                  <img
                    src={slide.src}
                    alt={slide.alt}
                    width={1200}
                    height={1000}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                  />
                  <span className="story-photo-index" aria-hidden="true">
                    0{index + 1}
                  </span>
                </div>
                <figcaption>
                  <p className="story-category">{slide.category}</p>
                  <h3>{slide.title}</h3>
                  <p className="story-description">{slide.description}</p>
                  <p className="story-photo-credit">
                    Photo:{" "}
                    <a href={slide.creditUrl} target="_blank" rel="noreferrer">
                      {slide.credit}
                    </a>
                    {" · "}
                    <a href={slide.licenseUrl} target="_blank" rel="noreferrer">
                      {slide.license}
                    </a>
                    {" · Cropped"}
                  </p>
                </figcaption>
              </figure>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

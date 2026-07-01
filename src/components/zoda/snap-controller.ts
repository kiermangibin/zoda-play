// Lightweight snap controller distilled from circuit-script.ts.
// Intercepts wheel / keyboard / touch and steps one panel at a time
// inside a [data-snap-track] element. Returns a cleanup function.

export type SnapControllerOptions = {
  trackSelector?: string;
  panelSelector?: string;
  dotSelector?: string;
  lockMs?: number;
  previousPath?: string;
  nextPath?: string;
  loopToStart?: boolean;
  onAccordionChange?: (panel: HTMLElement, index: number) => void;
  disableMobileTouchSnap?: boolean;
  allowPreviousPathFromHero?: boolean;
  onBeforeStep?: (direction: number, panel: HTMLElement, activeIndex: number) => boolean;
};

export function initSnapController(
  root: HTMLElement,
  opts: SnapControllerOptions = {},
): () => void {
  const {
    trackSelector = "[data-snap-track]",
    panelSelector = "[data-snap-panel]",
    dotSelector = "[data-snap-dot]",
    lockMs = 720,
    previousPath,
    nextPath,
    loopToStart = false,
    onAccordionChange,
    disableMobileTouchSnap = false,
    allowPreviousPathFromHero = false,
    onBeforeStep,
  } = opts;

  const track = root.querySelector<HTMLElement>(trackSelector);
  if (!track) return () => {};
  const panels = Array.from(root.querySelectorAll<HTMLElement>(panelSelector));
  if (!panels.length) return () => {};
  const dots = Array.from(root.querySelectorAll<HTMLElement>(dotSelector));

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMobile = () => window.matchMedia("(max-width: 760px)").matches;

  let activeIndex = 0;
  let locked = false;
  let lockTimer: number | null = null;
  let touchStartY = 0;
  let touchStartX = 0;
  const accordionState = new WeakMap<HTMLElement, number>();

  const getAccordionItems = (panel: HTMLElement) =>
    Array.from(panel.querySelectorAll<HTMLElement>("[data-snap-accordion-item]"));

  const setAccordionIndex = (panel: HTMLElement, index: number) => {
    const items = getAccordionItems(panel);
    if (!items.length) return;
    const active = index < 0 ? -1 : Math.max(0, Math.min(index, items.length - 1));
    accordionState.set(panel, active);
    items.forEach((item, itemIndex) => {
      const isOpen = itemIndex === active;
      item.classList.toggle("is-open", isOpen);
      if (item instanceof HTMLDetailsElement) item.open = isOpen;
      item
        .querySelector<HTMLElement>("[data-snap-accordion-trigger]")
        ?.setAttribute("aria-expanded", String(isOpen));
    });
    onAccordionChange?.(panel, active);
  };

  const syncAccordionFromDom = (panel: HTMLElement, preferredIndex: number) => {
    const items = getAccordionItems(panel);
    if (!items.length) return;
    const preferredItem = items[preferredIndex];
    const active =
      preferredItem instanceof HTMLDetailsElement && preferredItem.open
        ? preferredIndex
        : items.findIndex((item) => item instanceof HTMLDetailsElement && item.open);
    accordionState.set(panel, active);
    items.forEach((item, itemIndex) => {
      const isOpen = itemIndex === active;
      item.classList.toggle("is-open", isOpen);
      if (item instanceof HTMLDetailsElement && item.open !== isOpen) item.open = isOpen;
      item
        .querySelector<HTMLElement>("[data-snap-accordion-trigger]")
        ?.setAttribute("aria-expanded", String(isOpen));
    });
  };

  const stepAccordion = (direction: number): boolean => {
    const panel = panels[activeIndex];
    if (!panel?.hasAttribute("data-snap-accordion")) return false;
    const items = getAccordionItems(panel);
    if (!items.length) return false;
    const current = accordionState.get(panel) ?? 0;
    if (current < 0) {
      setAccordionIndex(panel, direction > 0 ? 0 : items.length - 1);
      return true;
    }
    if (direction > 0 && current < items.length - 1) {
      setAccordionIndex(panel, current + 1);
      return true;
    }
    if (direction < 0 && current > 0) {
      setAccordionIndex(panel, current - 1);
      return true;
    }
    return false;
  };

  const setActive = (index: number) => {
    activeIndex = Math.max(0, Math.min(index, panels.length - 1));
    root.dataset.snapActivePanel = String(activeIndex + 1);
    panels.forEach((p, i) => p.classList.toggle("is-active", i === activeIndex));
    const panel = panels[activeIndex];
    if (panel?.hasAttribute("data-snap-accordion") && !accordionState.has(panel)) {
      setAccordionIndex(panel, 0);
    }
    dots.forEach((d, i) => {
      const isActive = i === activeIndex;
      d.classList.toggle("is-active", isActive);
      if (isActive) d.setAttribute("aria-current", "true");
      else d.removeAttribute("aria-current");
    });
  };

  const scrollToIndex = (index: number) => {
    const next = Math.max(0, Math.min(index, panels.length - 1));
    if (next === activeIndex && Math.abs(track.scrollTop - panels[next].offsetTop) < 4) return;
    locked = true;
    setActive(next);
    track.scrollTo({ top: panels[next].offsetTop, behavior: "smooth" });
    if (lockTimer) window.clearTimeout(lockTimer);
    lockTimer = window.setTimeout(() => {
      locked = false;
    }, lockMs);
  };

  const step = (direction: number) => {
    if (locked) return;
    const panel = panels[activeIndex];
    if (panel && onBeforeStep?.(direction, panel, activeIndex)) {
      locked = true;
      if (lockTimer) window.clearTimeout(lockTimer);
      lockTimer = window.setTimeout(
        () => {
          locked = false;
        },
        Math.min(lockMs, 420),
      );
      return;
    }
    if (stepAccordion(direction)) {
      locked = true;
      if (lockTimer) window.clearTimeout(lockTimer);
      lockTimer = window.setTimeout(
        () => {
          locked = false;
        },
        Math.min(lockMs, 420),
      );
      return;
    }
    if (direction < 0 && activeIndex <= 0) {
      if (previousPath && allowPreviousPathFromHero) {
        locked = true;
        window.location.assign(previousPath);
      }
      return;
    }
    if (direction > 0 && activeIndex >= panels.length - 1) {
      if (loopToStart) {
        scrollToIndex(0);
        return;
      }
      if (nextPath) {
        locked = true;
        window.location.assign(nextPath);
      }
      return;
    }
    scrollToIndex(activeIndex + direction);
  };

  // Allow scrolling inside nested scrollers (e.g. overflowing directory grid)
  const isInsideInternalScroller = (target: EventTarget | null, deltaY: number): boolean => {
    if (!(target instanceof Element)) return false;
    let el: Element | null = target;
    const panel = panels[activeIndex];
    while (el && el !== track && el !== document.body) {
      if (el === panel) return false;
      const style = window.getComputedStyle(el as HTMLElement);
      const oy = style.overflowY;
      if (
        (oy === "auto" || oy === "scroll") &&
        (el as HTMLElement).scrollHeight > (el as HTMLElement).clientHeight
      ) {
        const node = el as HTMLElement;
        const atTop = node.scrollTop <= 0;
        const atBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 1;
        if (deltaY < 0 && !atTop) return true;
        if (deltaY > 0 && !atBottom) return true;
      }
      el = el.parentElement;
    }
    return false;
  };

  const onWheel = (event: WheelEvent) => {
    if (Math.abs(event.deltaY) < 6) return;
    if (isInsideInternalScroller(event.target, event.deltaY)) return;
    event.preventDefault();
    if (locked) return;
    step(event.deltaY > 0 ? 1 : -1);
  };

  const onKeydown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
    )
      return;
    switch (event.key) {
      case "ArrowDown":
      case "PageDown":
      case " ":
        event.preventDefault();
        step(1);
        break;
      case "ArrowUp":
      case "PageUp":
        event.preventDefault();
        step(-1);
        break;
      case "Home":
        event.preventDefault();
        scrollToIndex(0);
        break;
      case "End":
        event.preventDefault();
        scrollToIndex(panels.length - 1);
        break;
    }
  };

  const onTouchStart = (event: TouchEvent) => {
    const t = event.touches[0];
    touchStartY = t.clientY;
    touchStartX = t.clientX;
  };

  const onTouchMove = (event: TouchEvent) => {
    if (locked) {
      event.preventDefault();
      return;
    }
    const t = event.touches[0];
    const dy = touchStartY - t.clientY;
    const dx = touchStartX - t.clientX;

    if (disableMobileTouchSnap && isMobile()) return;
    if (Math.abs(dy) < 28 || Math.abs(dx) > Math.abs(dy)) return;
    if (isInsideInternalScroller(event.target, dy)) return;
    event.preventDefault();
    step(dy > 0 ? 1 : -1);
    touchStartY = t.clientY;
  };

  // Sync activeIndex if user reaches via hash / programmatic scroll
  const onScroll = () => {
    if (locked) return;
    const top = track.scrollTop;
    let nearest = 0;
    let best = Infinity;
    panels.forEach((p, i) => {
      const d = Math.abs(p.offsetTop - top);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    if (nearest !== activeIndex) setActive(nearest);
  };

  const dotHandlers: Array<(e: Event) => void> = [];
  dots.forEach((dot, i) => {
    const h = (e: Event) => {
      e.preventDefault();
      scrollToIndex(i);
    };
    dotHandlers.push(h);
    dot.addEventListener("click", h);
  });

  const accordionToggleHandlers: Array<{ item: HTMLElement; handler: (e: Event) => void }> = [];
  panels.forEach((panel) => {
    if (!panel.hasAttribute("data-snap-accordion")) return;
    const items = getAccordionItems(panel);
    if (!items.length) return;
    setAccordionIndex(panel, 0);
    items.forEach((item, index) => {
      if (item instanceof HTMLDetailsElement) {
        const toggleHandler = () => {
          window.setTimeout(() => syncAccordionFromDom(panel, index), 0);
        };
        accordionToggleHandlers.push({ item, handler: toggleHandler });
        item.addEventListener("toggle", toggleHandler);
      }
    });
  });

  if (!reduceMotion) {
    track.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKeydown);
    track.addEventListener("touchstart", onTouchStart, { passive: true });
    track.addEventListener("touchmove", onTouchMove, { passive: false });
  }
  track.addEventListener("scroll", onScroll, { passive: true });

  setActive(0);
  onScroll();

  // Expose a goTo method on the root for hash links etc.
  (root as HTMLElement & { __snapGoTo?: (id: string) => void }).__snapGoTo = (id: string) => {
    const idx = panels.findIndex((p) => p.id === id);
    if (idx >= 0) scrollToIndex(idx);
  };

  return () => {
    if (!reduceMotion) {
      track.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeydown);
      track.removeEventListener("touchstart", onTouchStart);
      track.removeEventListener("touchmove", onTouchMove);
    }
    track.removeEventListener("scroll", onScroll);
    dots.forEach((d, i) => d.removeEventListener("click", dotHandlers[i]));
    accordionToggleHandlers.forEach(({ item, handler }) =>
      item.removeEventListener("toggle", handler),
    );
    if (lockTimer) window.clearTimeout(lockTimer);
    delete root.dataset.snapActivePanel;
    delete (root as HTMLElement & { __snapGoTo?: (id: string) => void }).__snapGoTo;
  };
}

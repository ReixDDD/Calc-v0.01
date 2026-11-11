import { useEffect } from 'react';

export interface AdaptiveCardScaleMetrics {
  tiltAngleDeg: number;
  scale: number;
  visualScale: number;
}

export interface AdaptiveCardTiltOptions {
  flat?: boolean;
}

const SUBTLE_TILT_ANGLE_DEG = -0.5;
const FLAT_TILT_ANGLE_DEG = 0;
const TARGET_EXPANSION_PX = 5.2;
const MIN_HOVER_SCALE = 1.014;
const MAX_HOVER_SCALE = 1.024;
const LEAVING_SETTLE_MS = 360;

const CARD_HOVER_SELECTOR = '.ui-hover-card, .ui-hover-card-compact, .ui-kind-card';
const FLAT_CARD_ANCESTOR_SELECTOR = '.ui-header-shell';

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/**
 * Определяет, должна ли карточка масштабироваться в плоском 2D-режиме без 3D-наклона
 * (например, карточки внутри выпадающего мега-меню шапки).
 */
export function shouldUseFlatCardHover(params: {
  flatDatasetValue?: string;
  isInsideHeader?: boolean;
}): boolean {
  return params.flatDatasetValue === 'true' || Boolean(params.isInsideHeader);
}

/**
 * Вычисляет деликатное увеличение карточки при наведении:
 * - для карточек каталога и боковой панели добавляет лёгкий наклон -0.5°;
 * - для плоских карточек в шапке (flat: true) оставляет 0° без 3D-наклона, сохраняя увеличение.
 */
export function computeAdaptiveCardTilt(
  widthPx: number,
  heightPx: number,
  options?: AdaptiveCardTiltOptions
): AdaptiveCardScaleMetrics | null {
  if (
    !Number.isFinite(widthPx) ||
    !Number.isFinite(heightPx) ||
    widthPx <= 0 ||
    heightPx <= 0
  ) {
    return null;
  }

  const maxSpan = Math.max(widthPx, heightPx);
  const rawScale = 1 + TARGET_EXPANSION_PX / maxSpan;
  const scale = roundTo(
    Math.max(MIN_HOVER_SCALE, Math.min(MAX_HOVER_SCALE, rawScale)),
    4
  );
  const visualScale = roundTo(Math.min(1.032, scale + 0.006), 4);
  const tiltAngleDeg = options?.flat ? FLAT_TILT_ANGLE_DEG : SUBTLE_TILT_ANGLE_DEG;

  return {
    tiltAngleDeg,
    scale,
    visualScale,
  };
}

export function formatAdaptiveCardTiltCssVars(
  metrics: AdaptiveCardScaleMetrics
): Record<string, string> {
  return {
    '--card-tilt-angle': `${metrics.tiltAngleDeg}deg`,
    '--card-hover-scale': String(metrics.scale),
    '--card-visual-scale': String(metrics.visualScale),
  };
}

/**
 * Проверяет, действительно ли курсор покинул карточку (а не перешёл между дочерними узлами внутри неё).
 */
export function isTrueCardPointerLeave(
  fromCard: unknown,
  toCard: unknown
): boolean {
  return Boolean(fromCard) && fromCard !== toCard;
}

export function applyAdaptiveTiltToElement(el: HTMLElement): void {
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  if (w <= 0 || h <= 0) return;

  const isFlat = shouldUseFlatCardHover({
    flatDatasetValue: el.dataset.flatCard,
    isInsideHeader: Boolean(el.closest(FLAT_CARD_ANCESTOR_SELECTOR)),
  });
  const sizeKey = `${w}x${h}:${isFlat ? 'flat' : '3d'}`;
  if (el.dataset.tiltSize === sizeKey) return;

  const metrics = computeAdaptiveCardTilt(w, h, { flat: isFlat });
  if (!metrics) return;

  const vars = formatAdaptiveCardTiltCssVars(metrics);
  for (const [prop, val] of Object.entries(vars)) {
    el.style.setProperty(prop, val);
  }
  el.dataset.tiltSize = sizeKey;
}

export function useAdaptiveCardTilt(): void {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const observed = new WeakSet<HTMLElement>();
    const leavingTimers = new WeakMap<HTMLElement, number>();

    const clearLeavingTimer = (card: HTMLElement) => {
      const prev = leavingTimers.get(card);
      if (prev !== undefined) {
        window.clearTimeout(prev);
        leavingTimers.delete(card);
      }
    };

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver((entries) => {
            for (const entry of entries) {
              if (entry.target instanceof HTMLElement) {
                applyAdaptiveTiltToElement(entry.target);
              }
            }
          })
        : null;

    const scanAndBindCards = (root: ParentNode = document) => {
      const cards = root.querySelectorAll<HTMLElement>(CARD_HOVER_SELECTOR);
      cards.forEach((card) => {
        applyAdaptiveTiltToElement(card);
        if (resizeObserver && !observed.has(card)) {
          observed.add(card);
          resizeObserver.observe(card);
        }
      });
    };

    scanAndBindCards();

    const mutationObserver =
      typeof MutationObserver !== 'undefined'
        ? new MutationObserver((mutations) => {
            for (const m of mutations) {
              if (m.addedNodes.length > 0) {
                scanAndBindCards();
                break;
              }
            }
          })
        : null;

    mutationObserver?.observe(document.body, {
      childList: true,
      subtree: true,
    });

    const handlePointerOver = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const card = target.closest(CARD_HOVER_SELECTOR);
      if (card instanceof HTMLElement) {
        clearLeavingTimer(card);
        delete card.dataset.leaving;
        applyAdaptiveTiltToElement(card);
      }
    };

    const handlePointerOut = (e: PointerEvent) => {
      const fromCard =
        e.target instanceof Element ? e.target.closest(CARD_HOVER_SELECTOR) : null;
      if (!(fromCard instanceof HTMLElement)) return;

      const toCard =
        e.relatedTarget instanceof Element
          ? e.relatedTarget.closest(CARD_HOVER_SELECTOR)
          : null;
      if (!isTrueCardPointerLeave(fromCard, toCard)) return;

      clearLeavingTimer(fromCard);
      fromCard.dataset.leaving = 'true';
      const timerId = window.setTimeout(() => {
        delete fromCard.dataset.leaving;
        leavingTimers.delete(fromCard);
      }, LEAVING_SETTLE_MS);
      leavingTimers.set(fromCard, timerId);
    };

    document.addEventListener('pointerover', handlePointerOver, { passive: true });
    document.addEventListener('pointerout', handlePointerOut, { passive: true });

    return () => {
      document.removeEventListener('pointerover', handlePointerOver);
      document.removeEventListener('pointerout', handlePointerOut);
      mutationObserver?.disconnect();
      resizeObserver?.disconnect();
    };
  }, []);
}

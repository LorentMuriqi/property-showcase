/**
 * AURA360 Hotel Demo Hotspot - reference-matched visual (V2).
 * Designed from the user's still image of the 15-second hotel demo.
 *
 * Only the presentation is changed. The surrounding VirtualTour360 / AdminVirtualTour
 * components continue handling the true yaw/pitch position, click events, scene
 * transitions, and original permissions. No database migration is needed.
 */

export type AuraArrowHotspotVariant = "default" | "editing" | "draft";

const STYLE_ID = "aura360-hotel-arrow-hotspot-reference-v2";
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * Maintain the same min/max size behavior of V1, adjusting only its aspect
 * ratio to 320 x 158 so the oval matches the actual hotel-video reference.
 * This does not alter the stored marker position.
 */
export function getAuraArrowHotspotSize(pitch: number, compact = false) {
  const safePitch = Number.isFinite(pitch) ? pitch : 0;
  const down = Math.max(0, -safePitch);
  const near = clamp01((down - 0.06) / 0.95);
  const mobile = typeof window !== "undefined" && window.innerWidth <= 640;
  const min = compact ? 66 : mobile ? 74 : 94;
  const max = compact ? 126 : mobile ? 122 : 188;
  const width = Math.round(min + (max - min) * near);
  const height = Math.round(width * (158 / 320));
  return { width, height };
}

/**
 * Recreates the hotspot in the provided hotel-video screenshot:
 * - 2:1 flattened oval with a softly lit ivory ring
 * - translucent charcoal tint with real panorama visible underneath
 * - wide upward gold chevron (not an icon-font arrow)
 * - no solid brown background, glow color, label or unnecessary circles
 */
export function getAuraArrowHotspotHtml(
  hotspotId: number | string,
  variant: AuraArrowHotspotVariant = "default",
) {
  const id = String(hotspotId).replace(/[^a-zA-Z0-9_-]/g, "_");
  const variantClass =
    variant === "editing" ? "is-editing" : variant === "draft" ? "is-draft" : "";

  return `
    <span class="aura360-arrow-visual ${variantClass}">
      <svg xmlns="http://www.w3.org/2000/svg" class="aura360-arrow-svg"
           viewBox="0 0 320 158" preserveAspectRatio="xMidYMid meet"
           aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="aura-gold-${id}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#FFF4C7"/>
            <stop offset="32%" stop-color="#FFE59A"/>
            <stop offset="66%" stop-color="#F6CE68"/>
            <stop offset="100%" stop-color="#D4A140"/>
          </linearGradient>
          <filter id="aura-chevron-shadow-${id}" x="-12%" y="-30%" width="124%" height="170%">
            <feGaussianBlur stdDeviation="1.6"/>
            <feOffset dy="3"/>
          </filter>
          <filter id="aura-ring-soft-${id}" x="-6%" y="-12%" width="112%" height="124%">
            <feGaussianBlur stdDeviation="1.25"/>
          </filter>
        </defs>

        <ellipse class="aura360-arrow-disc" cx="160" cy="79" rx="144" ry="67"
                 fill="#21180F" fill-opacity="0.30"/>
        <ellipse cx="160" cy="80" rx="144" ry="67" fill="none"
                 stroke="#21180F" stroke-width="7" stroke-opacity="0.21"
                 filter="url(#aura-ring-soft-${id})"/>
        <ellipse cx="160" cy="79" rx="144" ry="67" fill="none"
                 stroke="#FFFFFF" stroke-width="6" stroke-opacity="0.30"
                 filter="url(#aura-ring-soft-${id})"/>
        <ellipse class="aura360-arrow-outline" cx="160" cy="79" rx="144" ry="67"
                 fill="none" stroke="#FFFDFC" stroke-width="5.8" stroke-opacity="0.99"/>

        <path d="M79 86 L153 38 Q160 33 167 38 L241 86 L241 102 L160 66 L79 102 Z"
              fill="#1A1006" opacity="0.31"
              filter="url(#aura-chevron-shadow-${id})"/>
        <path class="aura360-arrow-symbol"
              d="M79 86 L153 38 Q160 33 167 38 L241 86 L241 102 L160 66 L79 102 Z"
              fill="url(#aura-gold-${id})"/>
        <path d="M79 86 L153 38 Q160 33 167 38 L241 86"
              fill="none" stroke="#FFF4CE" stroke-width="1.35" stroke-opacity="0.70"/>
      </svg>
    </span>
  `;
}

/** The VirtualTourPlugin still navigates; only its native visible arrows are hidden. */
export function getHiddenAuraVtArrowStyle() {
  return {
    className: "aura360-hidden-vt-arrow",
    size: { width: 1, height: 1 },
  };
}

export function ensureAuraArrowHotspotStyles() {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .aura360-hidden-vt-arrow {
      opacity: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
      width: 1px !important;
      height: 1px !important;
      filter: none !important;
    }
    .aura360-arrow-marker {
      background: transparent !important;
      border: 0 !important;
      box-shadow: none !important;
      cursor: pointer !important;
      overflow: visible !important;
      -webkit-tap-highlight-color: transparent;
    }
    .aura360-arrow-visual {
      display: block;
      width: 100%;
      height: 100%;
      opacity: 1;
      pointer-events: none;
      user-select: none;
      -webkit-user-select: none;
    }
    .aura360-arrow-svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
      pointer-events: none;
    }
    .aura360-arrow-outline,
    .aura360-arrow-disc,
    .aura360-arrow-symbol {
      transition: stroke-width 160ms ease, stroke-opacity 160ms ease,
                  fill-opacity 160ms ease, filter 160ms ease;
    }
    .aura360-arrow-marker:hover .aura360-arrow-outline,
    .aura360-arrow-marker:focus-visible .aura360-arrow-outline {
      stroke: #FFFFFF;
      stroke-width: 7;
      stroke-opacity: 1;
    }
    .aura360-arrow-marker:hover .aura360-arrow-disc,
    .aura360-arrow-marker:focus-visible .aura360-arrow-disc {
      fill-opacity: 0.27;
    }
    .aura360-arrow-marker:hover .aura360-arrow-symbol,
    .aura360-arrow-marker:focus-visible .aura360-arrow-symbol {
      filter: brightness(1.06);
    }
    .aura360-arrow-visual.is-editing .aura360-arrow-outline {
      stroke: #F87171;
      stroke-width: 7;
    }
    .aura360-arrow-visual.is-draft .aura360-arrow-outline {
      stroke: #F8CD79;
      stroke-width: 7;
      stroke-dasharray: 9 5;
    }
    @media (prefers-reduced-motion: reduce) {
      .aura360-arrow-outline,
      .aura360-arrow-disc,
      .aura360-arrow-symbol { transition: none !important; }
    }
  `;
  document.head.appendChild(style);
}

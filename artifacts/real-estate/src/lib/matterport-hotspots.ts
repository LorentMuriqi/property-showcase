export type MatterportHotspotVariant = "default" | "editing" | "draft";

type MatterportHotspotMetrics = {
  ringWidth: number;
  ringHeight: number;
  ringThickness: number;
  hoverThickness: number;
  hitWidth: number;
  hitHeight: number;
  opacity: number;
};

const MATTERPORT_HOTSPOT_STYLE_ID = "aura-matterport-hotspot-styles-v4";

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/**
 * Visual-only approximation of Matterport floor navigation rings.
 * Saved panorama yaw/pitch are never changed here.
 *
 * A hotspot closer to the horizon is treated visually as farther away:
 * it becomes smaller, flatter and more transparent.
 * A hotspot farther below the horizon is treated visually as closer:
 * it becomes larger, less flattened and more opaque.
 */
const getMatterportHotspotMetrics = (pitch: number): MatterportHotspotMetrics => {
  const safePitch = Number.isFinite(pitch) ? pitch : 0;
  const downwardAngle = Math.max(0, -safePitch);
  const nearness = clamp01((downwardAngle - 0.03) / 0.98);

  // Strong perspective difference, matching the visual language of Matterport:
  // far points are small + very flat; near points are large + wider ellipses.
  const ringWidth = Math.round(34 + nearness * 112); // 34 -> 146px
  const flattenRatio = 0.30 + nearness * 0.38; // 0.30 -> 0.68
  const ringHeight = Math.max(11, Math.round(ringWidth * flattenRatio));

  // The ring is a real transparent donut made with border, not nested circles.
  const ringThickness = Math.max(2, Math.round(2 + nearness * 10)); // 2 -> 12px
  const hoverThickness = ringThickness + Math.max(1, Math.round(ringThickness * 0.16));

  return {
    ringWidth,
    ringHeight,
    ringThickness,
    hoverThickness,
    hitWidth: Math.max(54, ringWidth + 26),
    hitHeight: Math.max(42, ringHeight + 24),
    opacity: 0.34 + nearness * 0.62,
  };
};

const getVariantClass = (variant: MatterportHotspotVariant) => {
  if (variant === "editing") return "is-editing";
  if (variant === "draft") return "is-draft";
  return "is-default";
};

export const getMatterportHotspotSize = (pitch: number) => {
  const metrics = getMatterportHotspotMetrics(pitch);

  return {
    width: metrics.hitWidth,
    height: metrics.hitHeight,
  };
};

export const getMatterportHotspotHtml = (
  pitch: number,
  variant: MatterportHotspotVariant = "default",
) => {
  const metrics = getMatterportHotspotMetrics(pitch);

  return `
    <span
      class="aura-mp-hotspot ${getVariantClass(variant)}"
      style="
        --aura-mp-ring-w:${metrics.ringWidth}px;
        --aura-mp-ring-h:${metrics.ringHeight}px;
        --aura-mp-ring-thickness:${metrics.ringThickness}px;
        --aura-mp-hover-thickness:${metrics.hoverThickness}px;
        --aura-mp-opacity:${metrics.opacity};
      "
      aria-hidden="true"
    >
      <span class="aura-mp-hotspot__surface">
        <span class="aura-mp-hotspot__ring"></span>
      </span>
    </span>
  `;
};

/**
 * VirtualTourPlugin remains active only for navigation, transitions and preload.
 * Its native arrows stay hidden; visible points are panorama-locked MarkersPlugin markers.
 */
export const getHiddenVirtualTourArrowStyle = () => ({
  className: "aura-vt-link-hidden",
  size: { width: 1, height: 1 },
});

export const ensureMatterportHotspotStyles = () => {
  if (typeof document === "undefined") return;
  if (document.getElementById(MATTERPORT_HOTSPOT_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = MATTERPORT_HOTSPOT_STYLE_ID;
  style.textContent = `
    .aura-vt-link-hidden {
      opacity: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
      width: 1px !important;
      height: 1px !important;
      filter: none !important;
    }

    .aura-mp-marker {
      overflow: visible !important;
      cursor: pointer !important;
      background: transparent !important;
      border: 0 !important;
      box-shadow: none !important;
      -webkit-tap-highlight-color: transparent;
    }

    .aura-mp-hotspot {
      position: relative;
      display: flex;
      width: 100%;
      height: 100%;
      align-items: center;
      justify-content: center;
      overflow: visible;
      opacity: var(--aura-mp-opacity);
      pointer-events: none;
      user-select: none;
      -webkit-user-select: none;
      transition: opacity 120ms ease;
    }

    .aura-mp-hotspot__surface {
      position: relative;
      display: block;
      width: var(--aura-mp-ring-w);
      height: var(--aura-mp-ring-h);
      pointer-events: none;
    }

    /* Matterport-style floor donut: one clean, thick, white elliptical ring. */
    .aura-mp-hotspot__ring {
      position: absolute;
      inset: 0;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      border: var(--aura-mp-ring-thickness) solid rgba(255,255,255,.82);
      background: transparent;
      box-shadow:
        0 1px 2px rgba(0,0,0,.08),
        inset 0 0 0 1px rgba(255,255,255,.06);
      transition:
        border-color 120ms ease,
        border-width 120ms ease,
        box-shadow 120ms ease;
      pointer-events: none;
    }

    /* Hover: ONLY whiter + bolder. No blue, no gold, no scale, no glow. */
    .aura-mp-marker:hover .aura-mp-hotspot,
    .aura-mp-marker:focus-visible .aura-mp-hotspot {
      opacity: 1;
    }

    .aura-mp-marker:hover .aura-mp-hotspot__ring,
    .aura-mp-marker:focus-visible .aura-mp-hotspot__ring {
      border-color: rgba(255,255,255,1);
      border-width: var(--aura-mp-hover-thickness);
      box-shadow:
        0 0 0 1px rgba(255,255,255,.18),
        0 1px 3px rgba(0,0,0,.08);
    }

    .aura-mp-marker:active .aura-mp-hotspot__ring {
      border-color: rgba(255,255,255,1);
    }

    /* Admin-only states remain distinguishable while preserving the same geometry. */
    .aura-mp-hotspot.is-editing .aura-mp-hotspot__ring {
      border-color: rgba(248,113,113,.96);
    }

    .aura-mp-hotspot.is-draft .aura-mp-hotspot__ring {
      border-color: rgba(251,191,36,.96);
      border-style: dashed;
    }

    @media (pointer: coarse) {
      .aura-mp-hotspot {
        opacity: max(.44, var(--aura-mp-opacity));
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .aura-mp-hotspot,
      .aura-mp-hotspot__ring {
        transition: none !important;
      }
    }
  `;

  document.head.appendChild(style);
};

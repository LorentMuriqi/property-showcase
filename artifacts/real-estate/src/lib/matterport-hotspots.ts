export type MatterportHotspotVariant = "default" | "editing" | "draft";

type MatterportHotspotMetrics = {
  ringWidth: number;
  ringHeight: number;
  hitWidth: number;
  hitHeight: number;
  ringOpacity: number;
};

const MATTERPORT_HOTSPOT_STYLE_ID = "aura-matterport-hotspot-styles-v5";

const OLD_STYLE_IDS = [
  "aura-matterport-hotspot-styles-v2",
  "aura-matterport-hotspot-styles-v3",
  "aura-matterport-hotspot-styles-v4",
];

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/**
 * Visual-only Matterport-style sizing.
 * The saved yaw/pitch are NEVER changed here.
 *
 * A point closer to the horizon is visually farther away:
 * smaller, flatter and more transparent.
 * A point farther below the horizon is visually closer:
 * larger, rounder and more opaque.
 */
const getMatterportHotspotMetrics = (pitch: number): MatterportHotspotMetrics => {
  const safePitch = Number.isFinite(pitch) ? pitch : 0;
  const downwardAngle = Math.max(0, -safePitch);
  const nearness = clamp01((downwardAngle - 0.025) / 0.95);

  // Matterport reference: distant rings are visibly flattened,
  // nearby rings become large and almost circular while remaining floor ellipses.
  const ringWidth = Math.round(46 + nearness * 104); // 46 -> 150px
  const flattenRatio = 0.43 + nearness * 0.43; // 0.43 -> 0.86
  const ringHeight = Math.max(20, Math.round(ringWidth * flattenRatio));

  return {
    ringWidth,
    ringHeight,
    hitWidth: Math.max(62, ringWidth + 20),
    hitHeight: Math.max(48, ringHeight + 18),
    ringOpacity: 0.28 + nearness * 0.64, // 0.28 -> 0.92
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
        --aura-mp-ring-opacity:${metrics.ringOpacity};
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
 * VirtualTourPlugin remains active for navigation/transitions/preload only.
 * Visible navigation points are panorama-locked MarkersPlugin markers.
 */
export const getHiddenVirtualTourArrowStyle = () => ({
  className: "aura-vt-link-hidden",
  size: { width: 1, height: 1 },
});

export const ensureMatterportHotspotStyles = () => {
  if (typeof document === "undefined") return;

  // Avoid stale CSS during Vite HMR after upgrading from earlier attempts.
  OLD_STYLE_IDS.forEach((id) => document.getElementById(id)?.remove());

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
      pointer-events: none;
      user-select: none;
      -webkit-user-select: none;
    }

    .aura-mp-hotspot__surface {
      position: relative;
      display: block;
      width: var(--aura-mp-ring-w);
      height: var(--aura-mp-ring-h);
      pointer-events: none;
    }

    /*
     * IMPORTANT:
     * Matterport's visible point is a FILLED translucent annulus, not a thin border.
     * The mask cuts a real transparent hole through the middle so the floor remains visible.
     */
    .aura-mp-hotspot__ring {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: rgba(255, 255, 255, var(--aura-mp-ring-opacity));
      pointer-events: none;

      -webkit-mask-image: radial-gradient(
        ellipse at center,
        transparent 0%,
        transparent 61%,
        rgba(0,0,0,.22) 62%,
        rgba(0,0,0,.72) 63%,
        #000 64%,
        #000 100%
      );
      mask-image: radial-gradient(
        ellipse at center,
        transparent 0%,
        transparent 61%,
        rgba(0,0,0,.22) 62%,
        rgba(0,0,0,.72) 63%,
        #000 64%,
        #000 100%
      );

      transition:
        background 110ms ease,
        filter 110ms ease;
    }

    /*
     * Hover is Matterport-style: only whiter and visually bolder.
     * No blue, no gold, no glow and no scale jump.
     * The slightly smaller inner hole makes the annulus thicker.
     */
    .aura-mp-marker:hover .aura-mp-hotspot__ring,
    .aura-mp-marker:focus-visible .aura-mp-hotspot__ring {
      background: rgba(255,255,255,1);
      filter: brightness(1.03);

      -webkit-mask-image: radial-gradient(
        ellipse at center,
        transparent 0%,
        transparent 56%,
        rgba(0,0,0,.24) 57%,
        rgba(0,0,0,.76) 58%,
        #000 59%,
        #000 100%
      );
      mask-image: radial-gradient(
        ellipse at center,
        transparent 0%,
        transparent 56%,
        rgba(0,0,0,.24) 57%,
        rgba(0,0,0,.76) 58%,
        #000 59%,
        #000 100%
      );
    }

    .aura-mp-marker:active .aura-mp-hotspot__ring {
      background: rgba(255,255,255,1);
    }

    /* Admin-only states keep identical geometry; only color identifies state. */
    .aura-mp-hotspot.is-editing .aura-mp-hotspot__ring {
      background: rgba(248,113,113,.92);
    }

    .aura-mp-hotspot.is-draft .aura-mp-hotspot__ring {
      background: rgba(251,191,36,.90);
    }

    @media (pointer: coarse) {
      .aura-mp-hotspot__ring {
        filter: none;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .aura-mp-hotspot__ring {
        transition: none !important;
      }
    }
  `;

  document.head.appendChild(style);
};

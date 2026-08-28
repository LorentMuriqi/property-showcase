export type MatterportHotspotVariant = "default" | "editing" | "draft";

type MatterportHotspotMetrics = {
  ringWidth: number;
  ringHeight: number;
  hitWidth: number;
  hitHeight: number;
  opacity: number;
};

const MATTERPORT_HOTSPOT_STYLE_ID = "aura-matterport-hotspot-styles-v2";

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/**
 * We do not invent a new distance field in the database.
 * For floor navigation points, pitch already gives a useful visual clue:
 * points closer to the camera are usually farther below the horizon.
 * This function changes only presentation size, never saved yaw/pitch.
 */
const getMatterportHotspotMetrics = (pitch: number): MatterportHotspotMetrics => {
  const safePitch = Number.isFinite(pitch) ? pitch : 0;
  const downwardAngle = Math.max(0, -safePitch);
  const nearness = clamp01((downwardAngle - 0.03) / 0.98);

  const ringWidth = Math.round(30 + nearness * 66);
  const flattenRatio = 0.52 + nearness * 0.14;
  const ringHeight = Math.max(16, Math.round(ringWidth * flattenRatio));

  return {
    ringWidth,
    ringHeight,
    hitWidth: Math.max(50, ringWidth + 16),
    hitHeight: Math.max(44, ringHeight + 18),
    opacity: 0.8 + nearness * 0.18,
  };
};

const getVariantClass = (variant: MatterportHotspotVariant) => {
  if (variant === "editing") return "is-editing";
  if (variant === "draft") return "is-draft";
  return "is-default";
};

const MATTERPORT_HOTSPOT_INNER_HTML = `
  <span class="aura-mp-hotspot__surface">
    <span class="aura-mp-hotspot__halo"></span>
    <span class="aura-mp-hotspot__outer"></span>
    <span class="aura-mp-hotspot__inner"></span>
    <span class="aura-mp-hotspot__center"></span>
  </span>
`;

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
        --aura-mp-opacity:${metrics.opacity};
      "
      aria-hidden="true"
    >
      ${MATTERPORT_HOTSPOT_INNER_HTML}
    </span>
  `;
};

/**
 * VirtualTourPlugin remains responsible for scene transitions/preloading,
 * but its native 3D arrows are hidden. Visible navigation is rendered by
 * MarkersPlugin so each point is locked to its exact panorama yaw/pitch.
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
      transition: opacity 150ms ease;
    }

    .aura-mp-hotspot__surface {
      position: relative;
      display: block;
      width: var(--aura-mp-ring-w);
      height: var(--aura-mp-ring-h);
      transform-origin: 50% 50%;
      transition:
        transform 150ms cubic-bezier(.2,.8,.2,1),
        filter 150ms ease;
      will-change: transform, filter;
      pointer-events: none;
    }

    .aura-mp-hotspot__outer,
    .aura-mp-hotspot__inner,
    .aura-mp-hotspot__halo,
    .aura-mp-hotspot__center {
      position: absolute;
      left: 50%;
      top: 50%;
      box-sizing: border-box;
      border-radius: 9999px;
      transform: translate(-50%, -50%);
      pointer-events: none;
    }

    .aura-mp-hotspot__outer {
      width: 100%;
      height: 100%;
      border: 2px solid rgba(255,255,255,.96);
      background: rgba(255,255,255,.025);
      box-shadow:
        0 1px 0 rgba(255,255,255,.16) inset,
        0 2px 5px rgba(0,0,0,.15);
      transition:
        border-color 150ms ease,
        background 150ms ease,
        box-shadow 150ms ease;
    }

    .aura-mp-hotspot__inner {
      width: 46%;
      height: 46%;
      border: 1.6px solid rgba(255,255,255,.88);
      background: rgba(255,255,255,.035);
      box-shadow: 0 0 0 1px rgba(0,0,0,.025);
      transition:
        border-color 150ms ease,
        background 150ms ease,
        box-shadow 150ms ease;
    }

    .aura-mp-hotspot__center {
      width: 4px;
      height: 4px;
      background: rgba(255,255,255,.94);
      box-shadow: 0 0 0 2px rgba(255,255,255,.09);
      transition:
        background 150ms ease,
        box-shadow 150ms ease;
    }

    .aura-mp-hotspot__halo {
      width: calc(100% + 18px);
      height: calc(100% + 14px);
      background:
        radial-gradient(
          ellipse at center,
          rgba(97,170,242,.24) 0%,
          rgba(97,170,242,.12) 38%,
          rgba(97,170,242,.04) 58%,
          rgba(97,170,242,0) 76%
        );
      opacity: 0;
      filter: blur(2px);
      transition: opacity 150ms ease;
    }

    .aura-mp-marker:hover .aura-mp-hotspot,
    .aura-mp-marker:focus-visible .aura-mp-hotspot {
      opacity: 1;
    }

    .aura-mp-marker:hover .aura-mp-hotspot__surface,
    .aura-mp-marker:focus-visible .aura-mp-hotspot__surface {
      transform: scale(1.055);
      filter: brightness(1.06);
    }

    .aura-mp-marker:hover .aura-mp-hotspot__outer,
    .aura-mp-marker:focus-visible .aura-mp-hotspot__outer {
      border-color: rgb(97,170,242);
      background: rgba(97,170,242,.055);
      box-shadow:
        0 0 0 1px rgba(255,255,255,.14) inset,
        0 0 0 1px rgba(97,170,242,.20),
        0 0 15px rgba(97,170,242,.30),
        0 2px 5px rgba(0,0,0,.14);
    }

    .aura-mp-marker:hover .aura-mp-hotspot__inner,
    .aura-mp-marker:focus-visible .aura-mp-hotspot__inner {
      border-color: rgba(220,239,255,.98);
      background: rgba(97,170,242,.07);
      box-shadow: 0 0 9px rgba(97,170,242,.15);
    }

    .aura-mp-marker:hover .aura-mp-hotspot__center,
    .aura-mp-marker:focus-visible .aura-mp-hotspot__center {
      background: rgb(220,239,255);
      box-shadow: 0 0 0 3px rgba(97,170,242,.16);
    }

    .aura-mp-marker:hover .aura-mp-hotspot__halo,
    .aura-mp-marker:focus-visible .aura-mp-hotspot__halo {
      opacity: 1;
    }

    .aura-mp-marker:active .aura-mp-hotspot__surface {
      transform: scale(.975);
    }

    .aura-mp-hotspot.is-editing .aura-mp-hotspot__outer {
      border-color: rgba(248,113,113,.98);
      background: rgba(239,68,68,.08);
      box-shadow:
        0 0 0 1px rgba(255,255,255,.14) inset,
        0 0 0 5px rgba(239,68,68,.08),
        0 0 13px rgba(239,68,68,.20);
    }

    .aura-mp-hotspot.is-editing .aura-mp-hotspot__inner {
      border-color: rgba(254,226,226,.98);
    }

    .aura-mp-hotspot.is-draft .aura-mp-hotspot__outer {
      border-style: dashed;
      border-color: rgba(251,191,36,.98);
      background: rgba(251,191,36,.07);
      box-shadow:
        0 0 0 1px rgba(255,255,255,.12) inset,
        0 0 0 5px rgba(251,191,36,.07),
        0 0 13px rgba(251,191,36,.17);
    }

    .aura-mp-hotspot.is-draft .aura-mp-hotspot__inner {
      border-color: rgba(254,243,199,.96);
    }

    @media (pointer: coarse) {
      .aura-mp-hotspot {
        opacity: .92;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .aura-mp-hotspot,
      .aura-mp-hotspot__surface,
      .aura-mp-hotspot__outer,
      .aura-mp-hotspot__inner,
      .aura-mp-hotspot__center,
      .aura-mp-hotspot__halo {
        transition: none !important;
      }
    }
  `;

  document.head.appendChild(style);
};

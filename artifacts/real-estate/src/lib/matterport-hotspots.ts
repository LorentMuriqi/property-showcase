export type MatterportHotspotVariant = "default" | "editing" | "draft";

type MatterportHotspotMetrics = {
  ringWidth: number;
  ringHeight: number;
  hitWidth: number;
  hitHeight: number;
  opacity: number;
};

const MATTERPORT_HOTSPOT_STYLE_ID = "aura-matterport-hotspot-styles";

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const getMatterportHotspotMetrics = (pitch: number): MatterportHotspotMetrics => {
  const safePitch = Number.isFinite(pitch) ? pitch : 0;

  // In PSV, floor points placed farther away are normally closer to the horizon
  // (pitch near 0). Points placed nearer to the camera sit farther below the
  // horizon (more negative pitch). We use that geometry only for presentation;
  // the saved yaw/pitch is never modified.
  const downwardAngle = Math.max(0, -safePitch);
  const nearness = clamp01((downwardAngle - 0.025) / 0.95);

  const ringWidth = Math.round(31 + nearness * 67);
  const flattenRatio = 0.36 + nearness * 0.13;
  const ringHeight = Math.max(12, Math.round(ringWidth * flattenRatio));

  return {
    ringWidth,
    ringHeight,
    hitWidth: Math.max(48, ringWidth + 14),
    hitHeight: Math.max(42, ringHeight + 20),
    opacity: 0.76 + nearness * 0.22,
  };
};

const getVariantClass = (variant: MatterportHotspotVariant) => {
  if (variant === "editing") return "is-editing";
  if (variant === "draft") return "is-draft";
  return "is-default";
};

const applyMatterportHotspotVariables = (
  element: HTMLElement,
  metrics: MatterportHotspotMetrics,
) => {
  element.style.setProperty("--aura-mp-ring-w", `${metrics.ringWidth}px`);
  element.style.setProperty("--aura-mp-ring-h", `${metrics.ringHeight}px`);
  element.style.setProperty("--aura-mp-hit-w", `${metrics.hitWidth}px`);
  element.style.setProperty("--aura-mp-hit-h", `${metrics.hitHeight}px`);
  element.style.setProperty("--aura-mp-opacity", String(metrics.opacity));
};

const MATTERPORT_HOTSPOT_INNER_HTML = `
  <span class="aura-mp-hotspot__surface">
    <span class="aura-mp-hotspot__halo"></span>
    <span class="aura-mp-hotspot__outer"></span>
    <span class="aura-mp-hotspot__inner"></span>
    <span class="aura-mp-hotspot__center"></span>
  </span>
`;

export const createMatterportHotspotElement = (
  pitch: number,
  variant: MatterportHotspotVariant = "default",
): HTMLElement => {
  const metrics = getMatterportHotspotMetrics(pitch);
  const element = document.createElement("span");

  element.className = `aura-mp-hotspot ${getVariantClass(variant)}`;
  element.setAttribute("aria-hidden", "true");
  applyMatterportHotspotVariables(element, metrics);
  element.innerHTML = MATTERPORT_HOTSPOT_INNER_HTML;

  return element;
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
        --aura-mp-hit-w:${metrics.hitWidth}px;
        --aura-mp-hit-h:${metrics.hitHeight}px;
        --aura-mp-opacity:${metrics.opacity};
      "
      aria-hidden="true"
    >
      ${MATTERPORT_HOTSPOT_INNER_HTML}
    </span>
  `;
};

export const getMatterportArrowStyle = (pitch: number) => {
  const metrics = getMatterportHotspotMetrics(pitch);

  return {
    className: "aura-mp-link",
    size: {
      width: metrics.hitWidth,
      height: metrics.hitHeight,
    },
    element: () => createMatterportHotspotElement(pitch, "default"),
  };
};

export const ensureMatterportHotspotStyles = () => {
  if (typeof document === "undefined") return;
  if (document.getElementById(MATTERPORT_HOTSPOT_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = MATTERPORT_HOTSPOT_STYLE_ID;
  style.textContent = `
    .aura-mp-link {
      overflow: visible !important;
      background: transparent !important;
      border: 0 !important;
      box-shadow: none !important;
      filter: none !important;
      cursor: pointer !important;
      -webkit-tap-highlight-color: transparent;
    }

    .aura-mp-hotspot {
      position: relative;
      display: inline-flex;
      width: var(--aura-mp-hit-w);
      height: var(--aura-mp-hit-h);
      align-items: center;
      justify-content: center;
      overflow: visible;
      opacity: var(--aura-mp-opacity);
      pointer-events: auto;
      cursor: pointer;
      user-select: none;
      -webkit-user-select: none;
      -webkit-tap-highlight-color: transparent;
    }

    .aura-mp-hotspot__surface {
      position: relative;
      display: block;
      width: var(--aura-mp-ring-w);
      height: var(--aura-mp-ring-h);
      transform-origin: 50% 50%;
      transition:
        transform 150ms cubic-bezier(.2,.8,.2,1),
        filter 150ms ease,
        opacity 150ms ease;
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
      border-radius: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
    }

    .aura-mp-hotspot__outer {
      width: 100%;
      height: 100%;
      border: 2px solid rgba(255,255,255,.96);
      background:
        radial-gradient(
          ellipse at center,
          rgba(255,255,255,.11) 0%,
          rgba(255,255,255,.055) 44%,
          rgba(255,255,255,.015) 68%,
          rgba(255,255,255,0) 72%
        );
      box-shadow:
        0 1px 0 rgba(255,255,255,.2) inset,
        0 1px 3px rgba(0,0,0,.18),
        0 7px 16px rgba(0,0,0,.16);
      transition:
        border-color 150ms ease,
        background 150ms ease,
        box-shadow 150ms ease;
    }

    .aura-mp-hotspot__inner {
      width: 53%;
      height: 53%;
      border: 1.5px solid rgba(255,255,255,.88);
      background: rgba(255,255,255,.045);
      box-shadow: 0 0 0 1px rgba(0,0,0,.035);
      transition:
        border-color 150ms ease,
        background 150ms ease,
        box-shadow 150ms ease;
    }

    .aura-mp-hotspot__center {
      width: 5px;
      height: 5px;
      background: rgba(255,255,255,.92);
      box-shadow: 0 0 0 2px rgba(255,255,255,.10);
      transition:
        background 150ms ease,
        box-shadow 150ms ease;
    }

    .aura-mp-hotspot__halo {
      width: calc(100% + 16px);
      height: calc(100% + 12px);
      background:
        radial-gradient(
          ellipse at center,
          rgba(97,170,242,.27) 0%,
          rgba(97,170,242,.14) 38%,
          rgba(97,170,242,.055) 56%,
          rgba(97,170,242,0) 74%
        );
      opacity: 0;
      filter: blur(2px);
      transition: opacity 150ms ease;
    }

    .aura-mp-link:hover .aura-mp-hotspot,
    .aura-mp-link:focus-visible .aura-mp-hotspot,
    .aura-mp-hotspot:hover,
    .aura-mp-hotspot:focus-visible {
      opacity: 1;
    }

    .aura-mp-link:hover .aura-mp-hotspot__surface,
    .aura-mp-link:focus-visible .aura-mp-hotspot__surface,
    .aura-mp-hotspot:hover .aura-mp-hotspot__surface,
    .aura-mp-hotspot:focus-visible .aura-mp-hotspot__surface {
      transform: scale(1.055);
      filter: brightness(1.08);
    }

    .aura-mp-link:hover .aura-mp-hotspot__outer,
    .aura-mp-link:focus-visible .aura-mp-hotspot__outer,
    .aura-mp-hotspot:hover .aura-mp-hotspot__outer,
    .aura-mp-hotspot:focus-visible .aura-mp-hotspot__outer {
      border-color: rgb(97,170,242);
      background:
        radial-gradient(
          ellipse at center,
          rgba(97,170,242,.18) 0%,
          rgba(97,170,242,.075) 52%,
          rgba(97,170,242,0) 72%
        );
      box-shadow:
        0 0 0 1px rgba(255,255,255,.20) inset,
        0 0 0 1px rgba(97,170,242,.25),
        0 0 15px rgba(97,170,242,.38),
        0 7px 16px rgba(0,0,0,.16);
    }

    .aura-mp-link:hover .aura-mp-hotspot__inner,
    .aura-mp-link:focus-visible .aura-mp-hotspot__inner,
    .aura-mp-hotspot:hover .aura-mp-hotspot__inner,
    .aura-mp-hotspot:focus-visible .aura-mp-hotspot__inner {
      border-color: rgba(220,239,255,.98);
      background: rgba(97,170,242,.08);
      box-shadow: 0 0 10px rgba(97,170,242,.20);
    }

    .aura-mp-link:hover .aura-mp-hotspot__center,
    .aura-mp-link:focus-visible .aura-mp-hotspot__center,
    .aura-mp-hotspot:hover .aura-mp-hotspot__center,
    .aura-mp-hotspot:focus-visible .aura-mp-hotspot__center {
      background: rgb(220,239,255);
      box-shadow: 0 0 0 3px rgba(97,170,242,.18);
    }

    .aura-mp-link:hover .aura-mp-hotspot__halo,
    .aura-mp-link:focus-visible .aura-mp-hotspot__halo,
    .aura-mp-hotspot:hover .aura-mp-hotspot__halo,
    .aura-mp-hotspot:focus-visible .aura-mp-hotspot__halo {
      opacity: 1;
    }

    .aura-mp-link:active .aura-mp-hotspot__surface,
    .aura-mp-hotspot:active .aura-mp-hotspot__surface {
      transform: scale(.975);
    }

    .aura-mp-hotspot.is-editing .aura-mp-hotspot__outer {
      border-color: rgba(248,113,113,.98);
      background: rgba(239,68,68,.10);
      box-shadow:
        0 0 0 1px rgba(255,255,255,.16) inset,
        0 0 0 5px rgba(239,68,68,.10),
        0 0 16px rgba(239,68,68,.24);
    }

    .aura-mp-hotspot.is-editing .aura-mp-hotspot__inner {
      border-color: rgba(254,226,226,.98);
    }

    .aura-mp-hotspot.is-draft .aura-mp-hotspot__outer {
      border-style: dashed;
      border-color: rgba(251,191,36,.98);
      background: rgba(251,191,36,.09);
      box-shadow:
        0 0 0 1px rgba(255,255,255,.14) inset,
        0 0 0 5px rgba(251,191,36,.09),
        0 0 16px rgba(251,191,36,.20);
    }

    .aura-mp-hotspot.is-draft .aura-mp-hotspot__inner {
      border-color: rgba(254,243,199,.96);
    }

    @media (pointer: coarse) {
      .aura-mp-hotspot {
        opacity: .9;
      }
    }

    @media (prefers-reduced-motion: reduce) {
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

import { AbstractPlugin, type Viewer, type events } from "@photo-sphere-viewer/core";

const REFERENCE_PITCH = 35 * Math.PI / 180;
const hotspotAngle = (pitch: number) =>
  Math.min(Math.PI / 2, Math.abs(pitch));

/** A bounded visual estimate; pitch is not a measured 3D distance on stairs. */
export function getAura360HotspotDepthScale(pitch: number): number {
  if (!Number.isFinite(pitch)) return 1;

  const perspective = Math.min(
    1,
    Math.sin(hotspotAngle(pitch)) / Math.sin(REFERENCE_PITCH),
  );

  const minimumScale = pitch < 0 ? 0.34 : 0.52;

  return Math.max(minimumScale, perspective);
}

export function getAura360HotspotFlattening(pitch: number): number {
  if (!Number.isFinite(pitch)) return 1;
  return Math.max(0.7, Math.min(2.1,
    Math.sin(hotspotAngle(pitch)) / Math.sin(REFERENCE_PITCH),
  ));
}

/** Register BEFORE VirtualTourPlugin/MarkersPlugin in each viewer's plugin list. */
export class AuraHotspotPickingPlugin extends AbstractPlugin {
  static override readonly id = "aura-hotspot-picking";

  constructor(viewer: Viewer) {
    super(viewer);
    // VirtualTourPlugin installs its click handler in its constructor too.
    // Registration here ensures this correction runs before its navigation.
    viewer.addEventListener("click", this.onClick);
  }

  private readonly onClick = (event: events.ClickEvent) => {
    const data = event.data;
    if (!this.viewer.state.ready || data.rightclick ||
        !Number.isFinite(data.clientX) || !Number.isFinite(data.clientY)) return;
    const target = data.target instanceof Element ? data.target : null;
    if (target?.closest(".psv--capture-event,button,a,input,select,textarea,[role='button']")) return;

    const root = this.viewer.container;
    const viewport = root.getBoundingClientRect();
    const x = data.clientX, y = data.clientY;
    if (x < viewport.left || x > viewport.right || y < viewport.top || y > viewport.bottom) return;
    const touch = data.originalEvent?.type.startsWith("touch") ?? false;
    const padding = touch ? 14 : 8;
    let best: HTMLElement | null = null;
    let bestDistance = Infinity;

    for (const visual of root.querySelectorAll<HTMLElement>(".aura360-navigation-hotspot__visual")) {
      if (!visual.getClientRects().length || getComputedStyle(visual).visibility !== "visible") continue;
      const rect = visual.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0 || rect.right < viewport.left ||
          rect.left > viewport.right || rect.bottom < viewport.top || rect.top > viewport.bottom) continue;
      const dx = x - (rect.left + rect.width / 2);
      const dy = y - (rect.top + rect.height / 2);
      // These radii match the existing SVG ring, including its empty centre.
      // Add a small, bounded tolerance instead of using its 180x108 wrapper.
      const rx = Math.max(16, rect.width * 37 / 92) + padding;
      const ry = Math.max(14, rect.height * 15 / 54) + padding;
      if ((dx / rx) ** 2 + (dy / ry) ** 2 > 1) continue;
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) {
        best = visual;
        bestDistance = distance;
      }
    }

    if (best) {
      // Preserve the plugin's own link/marker callback, calibration and transition.
      data.target = best;
    } else if (target?.closest(".aura360-navigation-hotspot")) {
      data.target = root;
    }
  };

  override destroy(): void {
    this.viewer.removeEventListener("click", this.onClick);
    super.destroy();
  }
}

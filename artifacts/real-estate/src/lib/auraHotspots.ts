import { AbstractPlugin, CONSTANTS, SYSTEM, type Viewer, type events } from "@photo-sphere-viewer/core";

const REFERENCE_PITCH = 35 * Math.PI / 180;
const hotspotAngle = (pitch: number) =>
  Math.min(Math.PI / 2, Math.abs(pitch));
const isViewerControl = (target: EventTarget | null) =>
  target instanceof Element && !!target.closest(
    ".psv--capture-event,button,a,input,select,textarea,[role='button']",
  );

/** A bounded visual estimate; pitch is not a measured 3D distance on stairs. */
export function getAura360HotspotDepthScale(pitch: number): number {
  if (!Number.isFinite(pitch)) return 1;
  const perspective = Math.min(1,
    Math.sin(hotspotAngle(pitch)) / Math.sin(REFERENCE_PITCH),
  );
  // Floor rings may shrink further; keep elevated links readable on stairs.
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

  private readonly feedbackStyle: HTMLStyleElement;
  private highlighted: HTMLElement | null = null;
  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly pointers = new Set<number>();
  private press: { id: number; x: number; y: number; cancelled: boolean } | null = null;

  constructor(viewer: Viewer) {
    super(viewer);
    // VirtualTourPlugin installs its click handler in its constructor too.
    // Registration here ensures this correction runs before its navigation.
    viewer.addEventListener("click", this.onClick);

    // Scope feedback to this viewer. No changes to either component's CSS are needed.
    this.feedbackStyle = document.createElement("style");
    this.feedbackStyle.textContent = `
      .aura360-hotspot-feedback .aura360-navigation-hotspot
      .aura360-navigation-hotspot__visual:is(:hover, :active) .aura360-hotspot-ring {
        fill: rgba(255, 255, 255, 0.30);
      }
      .aura360-hotspot-feedback .aura360-navigation-hotspot
      .aura360-navigation-hotspot__visual:is([data-aura-feedback="hover"], :focus-visible)
      .aura360-hotspot-ring {
        fill: rgba(255, 255, 255, 0.42);
      }
      .aura360-hotspot-feedback .aura360-navigation-hotspot
      .aura360-navigation-hotspot__visual[data-aura-feedback="press"] .aura360-hotspot-ring {
        fill: rgba(255, 255, 255, 0.62);
      }
    `;
    viewer.container.classList.add("aura360-hotspot-feedback");
    viewer.container.append(this.feedbackStyle);
    viewer.container.addEventListener("pointerdown", this.onPointerDown, { capture: true, passive: true });
    viewer.container.addEventListener("pointerleave", this.onPointerLeave);
    window.addEventListener("pointermove", this.onPointerMove, { capture: true, passive: true });
    window.addEventListener("pointerup", this.onPointerUp, { capture: true, passive: true });
    window.addEventListener("pointercancel", this.onPointerCancel, { capture: true, passive: true });
    window.addEventListener("blur", this.resetInteraction);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    viewer.addEventListener("panorama-load", this.resetInteraction);
    viewer.addEventListener("panorama-loaded", this.resetInteraction);
    viewer.addEventListener("panorama-error", this.resetInteraction);
    viewer.addEventListener("position-updated", this.onViewChange);
    viewer.addEventListener("zoom-updated", this.onViewChange);
    viewer.addEventListener("size-updated", this.onViewChange);
  }

  /** Shared by the visual feedback and the existing click correction. */
  private findNearest(x: number, y: number, target: EventTarget | null, touch: boolean): HTMLElement | null {
    if (!this.viewer.state.ready || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    if (isViewerControl(target)) return null;
    const root = this.viewer.container;
    const viewport = root.getBoundingClientRect();
    if (x < viewport.left || x > viewport.right || y < viewport.top || y > viewport.bottom) return null;
    const padding = touch ? 32 : 24;
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

    return best;
  }

  private setFeedback(visual: HTMLElement | null, phase: "hover" | "press" = "hover"): void {
    if (this.feedbackTimer !== null) {
      clearTimeout(this.feedbackTimer);
      this.feedbackTimer = null;
    }
    if (this.highlighted !== visual) this.highlighted?.removeAttribute("data-aura-feedback");
    this.highlighted = visual;
    if (visual) visual.dataset.auraFeedback = phase;
  }

  private flashFeedback(visual: HTMLElement | null, touch: boolean): void {
    this.setFeedback(visual, "press");
    if (visual) {
      this.feedbackTimer = setTimeout(() => {
        this.setFeedback(!touch && visual.isConnected ? visual : null);
      }, 180);
    }
  }

  private moved(x: number, y: number): boolean {
    const threshold = CONSTANTS.MOVE_THRESHOLD * SYSTEM.pixelRatio;
    return !!this.press && (Math.abs(x - this.press.x) >= threshold ||
      Math.abs(y - this.press.y) >= threshold);
  }

  private readonly onPointerDown = (event: PointerEvent) => {
    this.pointers.add(event.pointerId);
    if (this.pointers.size !== 1 || event.button !== 0) {
      if (this.press) this.press.cancelled = true;
      this.setFeedback(null);
      return;
    }
    this.press = { id: event.pointerId, x: event.clientX, y: event.clientY,
      cancelled: isViewerControl(event.target) };
    this.setFeedback(this.findNearest(event.clientX, event.clientY, event.target,
      event.pointerType === "touch"), "press");
  };

  private readonly onPointerMove = (event: PointerEvent) => {
    if (this.press) {
      if (this.press.id !== event.pointerId) return;
      if (this.moved(event.clientX, event.clientY)) this.press.cancelled = true;
      if (this.press.cancelled) {
        this.setFeedback(null);
        return;
      }
      this.setFeedback(this.findNearest(event.clientX, event.clientY, event.target,
        event.pointerType === "touch"), "press");
    } else if (event.pointerType !== "touch" && event.buttons === 0 && this.pointers.size === 0) {
      const inside = event.target instanceof Node && this.viewer.container.contains(event.target);
      this.setFeedback(inside ? this.findNearest(event.clientX, event.clientY, event.target, false) : null);
    }
  };

  private readonly onPointerUp = (event: PointerEvent) => {
    this.pointers.delete(event.pointerId);
    if (!this.press || this.press.id !== event.pointerId) return;
    const cancelled = this.press.cancelled || this.moved(event.clientX, event.clientY);
    this.press = null;
    if (cancelled) this.setFeedback(null);
    else this.flashFeedback(this.findNearest(event.clientX, event.clientY, event.target,
      event.pointerType === "touch"), event.pointerType === "touch");
    // Navigation is still handled only by the viewer's own completed click event.
  };

  private readonly onPointerCancel = (event: PointerEvent) => {
    this.pointers.delete(event.pointerId);
    if (this.press?.id === event.pointerId) this.press = null;
    this.setFeedback(null);
  };

  private readonly onPointerLeave = () => {
    if (this.press) this.press.cancelled = true;
    this.setFeedback(null);
  };

  private readonly onViewChange = () => {
    if (this.press) this.press.cancelled = true;
    this.setFeedback(null);
  };

  private readonly resetInteraction = () => {
    this.press = null;
    this.pointers.clear();
    this.setFeedback(null);
  };

  private readonly onVisibilityChange = () => {
    if (document.hidden) this.resetInteraction();
  };

  private readonly onClick = (event: events.ClickEvent) => {
    const data = event.data;
    if (!this.viewer.state.ready || data.rightclick ||
        !Number.isFinite(data.clientX) || !Number.isFinite(data.clientY)) return;
    const target = data.target instanceof Element ? data.target : null;
    if (isViewerControl(target)) return;
    const touch = data.originalEvent?.type.startsWith("touch") ?? false;
    const best = this.findNearest(data.clientX, data.clientY, target, touch);
    this.flashFeedback(best, touch);
    if (best) {
      // Preserve the plugin's own link/marker callback, calibration and transition.
      data.target = best;
    } else if (target?.closest(".aura360-navigation-hotspot")) {
      data.target = this.viewer.container;
    }
  };

  override destroy(): void {
    this.resetInteraction();
    this.viewer.removeEventListener("click", this.onClick);
    this.viewer.removeEventListener("panorama-load", this.resetInteraction);
    this.viewer.removeEventListener("panorama-loaded", this.resetInteraction);
    this.viewer.removeEventListener("panorama-error", this.resetInteraction);
    this.viewer.removeEventListener("position-updated", this.onViewChange);
    this.viewer.removeEventListener("zoom-updated", this.onViewChange);
    this.viewer.removeEventListener("size-updated", this.onViewChange);
    this.viewer.container.removeEventListener("pointerdown", this.onPointerDown, true);
    this.viewer.container.removeEventListener("pointerleave", this.onPointerLeave);
    window.removeEventListener("pointermove", this.onPointerMove, true);
    window.removeEventListener("pointerup", this.onPointerUp, true);
    window.removeEventListener("pointercancel", this.onPointerCancel, true);
    window.removeEventListener("blur", this.resetInteraction);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.viewer.container.classList.remove("aura360-hotspot-feedback");
    this.feedbackStyle.remove();
    super.destroy();
  }
}

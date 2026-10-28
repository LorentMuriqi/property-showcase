import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Cache,
  Viewer,
  EquirectangularAdapter,
} from "@photo-sphere-viewer/core";
import { VirtualTourPlugin } from "@photo-sphere-viewer/virtual-tour-plugin";
import "@photo-sphere-viewer/core/index.css";
import "@photo-sphere-viewer/virtual-tour-plugin/index.css";
import { Maximize, Minimize, Map as MapIcon, X } from "lucide-react";

interface VirtualTour360Props {
  scenes: Array<{
    id: number;
    title: string;
    imageUrl: string;
    thumbnailUrl?: string | null;
    isDefault: boolean;
    sortOrder: number;
    positionX?: number | null;
    positionY?: number | null;
    initialYaw?: number | null;
    initialPitch?: number | null;
    hotspots: Array<{
      id: number;
      fromSceneId: number;
      toSceneId: number;
      yaw: number;
      pitch: number;
      targetYaw?: number | null;
      targetPitch?: number | null;
      label?: string | null;
      // Runtime fallback if a parent passes raw Supabase rows instead of mapped camelCase props.
      scene_id?: number | null;
      to_scene_id?: number | null;
      target_yaw?: number | null;
      target_pitch?: number | null;
    }>;
  }>;
  defaultSceneId?: number | null;
  onClose?: () => void;
  
  showAura360Branding?: boolean;
}

type SceneType = VirtualTour360Props["scenes"][number];
type Orientation = { yaw: number; pitch: number };
type PreloadPriority = "high" | "low";

type DeviceProfile = {
  width: number;
  memory: number;
  cores: number;
  isMobile: boolean;
  isLowMemory: boolean;
  isSlowConnection: boolean;
  isDesktop: boolean;
};

const FIRST_LOAD_HINT_MS = 6500;
const TOUR_THUMBNAIL_PLACEHOLDER = "/tour-thumbnail-placeholder.svg";

const CACHE_TTL_SECONDS = 30 * 60;
const NAVIGATION_TRANSITION = {
  showLoader: false,
  effect: "fade" as const,
  speed: 640,
  rotation: false,
};

// Wider first view, without the edge distortion of maximum zoom-out.
const TOUR_MIN_FOV = 28;
const getTourLens = (isMobile: boolean) => {
  const maxFov = isMobile ? 108 : 100;
  const openingFov = isMobile ? 92 : 85;
  return { maxFov, openingZoom: (maxFov - openingFov) / (maxFov - TOUR_MIN_FOV) * 100 };
};

const prefersReducedTourMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const HOTSPOT_BASE_WIDTH = 112;
const HOTSPOT_BASE_HEIGHT = 66;

// Flat-floor perspective: camera height / slant distance = sin(-pitch).
// Use the stored pitch, never the current viewing direction or cluster offset.
// This estimates depth; the tour does not contain measured 3D distances.
const getAura360HotspotDepthScale = (pitch: number) => {
  if (!Number.isFinite(pitch)) return 1;
  const depression = Math.max(0, Math.min(Math.PI / 2, -pitch));
  const referencePitch = (35 * Math.PI) / 180;
  return Math.max(0.18, Math.min(1, Math.sin(depression) / Math.sin(referencePitch)));
};

const setAura360HotspotSize = (element: HTMLElement, zoomScale: number) => {
  const depthScale = Number(element.dataset.auraDepthScale) || 1;
  const scale = depthScale * zoomScale;
  const flattening = Number(element.dataset.auraFlattening) || 1;
  element.style.setProperty("--aura-hotspot-width", `${(HOTSPOT_BASE_WIDTH * scale).toFixed(2)}px`);
  element.style.setProperty("--aura-hotspot-height", `${(HOTSPOT_BASE_HEIGHT * scale * flattening).toFixed(2)}px`);
};

const createAura360NavigationHotspot = (
  pitch: number,
  zoomScale = 1,
  label = "Hap pamjen tjetër",
  onActivate?: () => void,
  onIntent?: () => void,
) => {
  const element = document.createElement("div");

  element.className = "aura360-navigation-hotspot";
  element.dataset.auraDepthScale = String(getAura360HotspotDepthScale(pitch));
  // Preserve the familiar ring at 35 degrees; flatten distant floor rings.
  const depression = Number.isFinite(pitch) ? Math.max(0, Math.min(Math.PI / 2, -pitch)) : 35 * Math.PI / 180;
  element.dataset.auraFlattening = String(Math.max(0.5, Math.min(2.1,
    Math.sin(depression) / Math.sin(35 * Math.PI / 180),
  )));
  setAura360HotspotSize(element, zoomScale);

element.innerHTML = `
  <div class="aura360-navigation-hotspot__visual">
    <svg
      viewBox="0 -3 92 54"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        class="aura360-hotspot-ring"
        fill-rule="evenodd"
        d="
          M 46 9
          C 67 9, 83 15.5, 83 24
          C 83 32.5, 67 39, 46 39
          C 25 39, 9 32.5, 9 24
          C 9 15.5, 25 9, 46 9
          Z

          M 46 15.5
          C 58.5 15.5, 68 19.2, 68 24
          C 68 28.8, 58.5 32.5, 46 32.5
          C 33.5 32.5, 24 28.8, 24 24
          C 24 19.2, 33.5 15.5, 46 15.5
          Z
        "
      />
    </svg>
  </div>
`;

  const visual = element.querySelector<HTMLElement>(".aura360-navigation-hotspot__visual");
  if (visual) {
    visual.tabIndex = 0;
    visual.setAttribute("role", "link");
    visual.setAttribute("aria-label", label);
    if (onIntent) {
      visual.addEventListener("focus", onIntent);
      visual.addEventListener("pointerenter", onIntent);
      visual.addEventListener("pointerdown", onIntent);
    }
    visual.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      event.stopPropagation();
      onActivate?.();
    });
  }
  return element;
};



type NavigationTransitionOptions = typeof NAVIGATION_TRANSITION & {
  rotateTo?: Orientation;
  zoomTo?: number;
};


const getDeviceProfile = (): DeviceProfile => {
  const width = typeof window !== "undefined" ? window.innerWidth : 1200;
  const memory =
    typeof navigator !== "undefined" ? (navigator as any).deviceMemory || 4 : 4;
  const cores =
    typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 4 : 4;
  const connection =
    typeof navigator !== "undefined" ? (navigator as any).connection : null;

  const saveData = !!connection?.saveData;
  const effectiveType = connection?.effectiveType || "";
  const isSlowConnection =
    saveData || effectiveType === "slow-2g" || effectiveType === "2g";

  const isMobile = width <= 768;
  const isLowMemory = memory <= 2 || cores <= 2;

  return {
    width,
    memory,
    cores,
    isMobile,
    isLowMemory,
    isSlowConnection,
    isDesktop: width >= 1024,
  };
};

const getViewerResolution = () => {
  const profile = getDeviceProfile();

  if (profile.isMobile || profile.isLowMemory || profile.isSlowConnection) {
    return 64;
  }

  return 128;
};

const getCacheMaxItems = () => {
  const profile = getDeviceProfile();

  if (profile.isSlowConnection || profile.isLowMemory) return 4;
  if (profile.isMobile) return 8;
  return 14;
};

type PreloadPlan = {
  immediate: number;
  total: number;
  gapMs: number;
  positionDebounceMs: number;
};

const getPreloadPlan = (): PreloadPlan => {
  const profile = getDeviceProfile();

  if (profile.isSlowConnection) {
    return {
      immediate: 1,
      total: 2,
      gapMs: 260,
      positionDebounceMs: 280,
    };
  }

  if (profile.isLowMemory) {
    return {
      immediate: 1,
      total: 3,
      gapMs: 220,
      positionDebounceMs: 240,
    };
  }

  if (profile.isMobile) {
    return {
      immediate: 1,
      total: 6,
      gapMs: 150,
      positionDebounceMs: 190,
    };
  }

  return {
    immediate: 2,
    total: 10,
    gapMs: 110,
    positionDebounceMs: 150,
  };
};

// One shared queue per viewer, including hover/focus and changing look direction.
// The clicked destination may use one reserved slot; background work cannot.
const createTourPreloadScheduler = (backgroundLimit: number) => {
  type Job = {
    key: string; priority: number; started: boolean;
    run: () => Promise<void>; resolve: () => void; reject: (error: unknown) => void;
    promise: Promise<void>;
  };
  const jobs = new Map<string, Job>();
  let queue: Job[] = [];
  let active = 0;
  let stopped = false;
  const maxQueued = backgroundLimit === 1 ? 6 : 10;
  const drain = () => {
    if (stopped) return;
    queue.sort((a, b) => b.priority - a.priority);
    while (queue.length) {
      const job = queue[0];
      const limit = backgroundLimit + (job.priority === 2 ? 1 : 0);
      if (active >= limit) break;
      queue.shift();
      job.started = true;
      active += 1;
      void Promise.resolve().then(job.run).then(job.resolve, job.reject).finally(() => {
        active -= 1;
        if (jobs.get(job.key) === job) jobs.delete(job.key);
        drain();
      });
    }
  };
  const cancelQueued = () => {
    queue = queue.filter((job) => {
      if (job.priority === 2) return true;
      jobs.delete(job.key);
      job.resolve();
      return false;
    });
  };
  return {
    request(key: string, run: () => Promise<void>, priority: number) {
      if (stopped) return Promise.resolve();
      const existing = jobs.get(key);
      if (existing) {
        existing.priority = Math.max(existing.priority, priority);
        if (!existing.started && priority > 0) {
          queue = queue.filter((entry) => entry !== existing);
          queue.unshift(existing);
        }
        drain();
        return existing.promise;
      }
      let resolve!: () => void;
      let reject!: (error: unknown) => void;
      const promise = new Promise<void>((ok, fail) => { resolve = ok; reject = fail; });
      const job: Job = { key, run, priority, promise, resolve, reject, started: false };
      jobs.set(key, job);
      // New user intent goes before older speculation of the same priority.
      if (priority > 0) queue.unshift(job); else queue.push(job);
      while (queue.length > maxQueued) {
        const removable = queue.map((entry, index) => ({ entry, index }))
          .filter(({ entry }) => entry.priority < 2)
          .sort((a, b) => a.entry.priority - b.entry.priority || b.index - a.index)[0];
        if (!removable) break;
        queue.splice(removable.index, 1);
        jobs.delete(removable.entry.key);
        removable.entry.resolve();
      }
      drain();
      return promise;
    },
    cancelQueued,
    stop() {
      stopped = true;
      queue.forEach((job) => { jobs.delete(job.key); job.resolve(); });
      queue = [];
    },
  };
};

// A full-width phone swipe should turn roughly 145 degrees at the opening
// view. PSV applies its normal FOV scaling when the visitor zooms in.
const getTourMoveSpeed = (width: number, height: number, isTouch: boolean, openingFov: number) => {
  if (!isTouch) return 1;
  const horizontalFov = 2 * Math.atan(Math.tan(openingFov * Math.PI / 360) * width / Math.max(1, height)) * 180 / Math.PI;
  return Math.max(1.3, Math.min(2.8, 145 / Math.max(1, horizontalFov)));
};

const waitForPreloadGap = (delay: number): Promise<void> => {
  if (typeof window === "undefined" || delay <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    window.setTimeout(resolve, delay);
  });
};

const isFiniteOrientation = (orientation: Orientation | null): orientation is Orientation => {
  return (
    !!orientation &&
    Number.isFinite(orientation.yaw) &&
    Number.isFinite(orientation.pitch)
  );
};

const TWO_PI = Math.PI * 2;
const MIN_SAFE_PITCH = -Math.PI / 2 + 0.02;
const MAX_SAFE_PITCH = Math.PI / 2 - 0.02;

const normalizeYaw = (yaw: number) => {
  if (!Number.isFinite(yaw)) return 0;

  let normalized = ((yaw + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI;

  if (Math.abs(normalized + Math.PI) < 1e-10) normalized = Math.PI;

  return normalized;
};

const clampPitch = (pitch: number) => {
  if (!Number.isFinite(pitch)) return 0;
  return Math.max(MIN_SAFE_PITCH, Math.min(MAX_SAFE_PITCH, pitch));
};

const toFiniteNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const uniqueNumbers = (items: number[]) => {
  return items.filter((id, index, arr) => arr.indexOf(id) === index);
};

type RuntimeHotspot = SceneType["hotspots"][number] & Record<string, unknown>;

const getRuntimeHotspotId = (hotspot: RuntimeHotspot) => {
  return toFiniteNumber(hotspot.id) ?? 0;
};

const getRuntimeHotspotSourceSceneId = (hotspot: RuntimeHotspot, fallbackSceneId: number) => {
  return toFiniteNumber(hotspot.fromSceneId ?? hotspot.scene_id) ?? fallbackSceneId;
};

const getRuntimeHotspotTargetSceneId = (hotspot: RuntimeHotspot) => {
  return toFiniteNumber(hotspot.toSceneId ?? hotspot.to_scene_id);
};

const getRuntimeHotspotYaw = (hotspot: RuntimeHotspot) => {
  return normalizeYaw(toFiniteNumber(hotspot.yaw) ?? 0);
};

const getRuntimeHotspotPitch = (hotspot: RuntimeHotspot) => {
  return clampPitch(toFiniteNumber(hotspot.pitch) ?? 0);
};

const getRuntimeHotspotTargetYaw = (hotspot: RuntimeHotspot) => {
  return toFiniteNumber(hotspot.targetYaw ?? hotspot.target_yaw);
};

const getRuntimeHotspotTargetPitch = (hotspot: RuntimeHotspot) => {
  return toFiniteNumber(hotspot.targetPitch ?? hotspot.target_pitch);
};


type HotspotLike = {
  id: number;
  yaw: number;
  pitch: number;
};

type ClusteredHotspotPosition = {
  yaw: number;
  pitch: number;
  rawYaw: number;
  rawPitch: number;
  clusterIndex: number;
  clusterSize: number;
  isClustered: boolean;
};

const HOTSPOT_CLUSTER_RADIUS = 0.04;
const HOTSPOT_FAN_YAW_STEP = 0.052;
const HOTSPOT_FAN_PITCH_STEP = 0.018;

const getYawDistance = (a: number, b: number) => {
  return Math.abs(normalizeYaw(a - b));
};

const getHotspotDistance = (a: HotspotLike, b: HotspotLike) => {
  const dyaw = getYawDistance(a.yaw, b.yaw);
  const dpitch = Math.abs(a.pitch - b.pitch);
  return Math.sqrt(dyaw * dyaw + dpitch * dpitch);
};

const getHotspotClusterKey = (hotspot: HotspotLike) => {
  return `${Math.round(normalizeYaw(hotspot.yaw) / HOTSPOT_CLUSTER_RADIUS)}:${Math.round(
    clampPitch(hotspot.pitch) / HOTSPOT_CLUSTER_RADIUS,
  )}`;
};

const getClusteredHotspotPositions = <T extends HotspotLike>(
  hotspots: T[],
): Map<number, ClusteredHotspotPosition> => {
  const clusters: T[][] = [];

  hotspots.forEach((hotspot) => {
    const existingCluster = clusters.find((cluster) => {
      return cluster.some(
        (clusterHotspot) => getHotspotDistance(clusterHotspot, hotspot) <= HOTSPOT_CLUSTER_RADIUS,
      );
    });

    if (existingCluster) {
      existingCluster.push(hotspot);
    } else {
      clusters.push([hotspot]);
    }
  });

  const positions = new Map<number, ClusteredHotspotPosition>();

  clusters.forEach((cluster) => {
    const orderedCluster = [...cluster].sort((a, b) => {
      const keyA = getHotspotClusterKey(a);
      const keyB = getHotspotClusterKey(b);
      if (keyA !== keyB) return keyA.localeCompare(keyB);
      return Number(a.id) - Number(b.id);
    });

    if (orderedCluster.length === 1) {
      const hotspot = orderedCluster[0];
      positions.set(Number(hotspot.id), {
        yaw: normalizeYaw(hotspot.yaw),
        pitch: clampPitch(hotspot.pitch),
        rawYaw: normalizeYaw(hotspot.yaw),
        rawPitch: clampPitch(hotspot.pitch),
        clusterIndex: 0,
        clusterSize: 1,
        isClustered: false,
      });
      return;
    }

    const centerIndex = (orderedCluster.length - 1) / 2;

    orderedCluster.forEach((hotspot, index) => {
      const offset = index - centerIndex;
      const verticalDirection = index % 2 === 0 ? 1 : -1;

      positions.set(Number(hotspot.id), {
        yaw: normalizeYaw(hotspot.yaw + offset * HOTSPOT_FAN_YAW_STEP),
        pitch: clampPitch(
          hotspot.pitch + Math.abs(offset) * HOTSPOT_FAN_PITCH_STEP * verticalDirection,
        ),
        rawYaw: normalizeYaw(hotspot.yaw),
        rawPitch: clampPitch(hotspot.pitch),
        clusterIndex: index,
        clusterSize: orderedCluster.length,
        isClustered: true,
      });
    });
  });

  return positions;
};

const preloadBrowserImage = (
  src?: string | null,
  priority: PreloadPriority = "low",
): Promise<void> => {
  if (!src || typeof Image === "undefined") return Promise.resolve();

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";

    try {
      (img as any).fetchPriority = priority;
    } catch {
      // fetchPriority is not supported in every browser.
    }

    img.onload = async () => {
      try {
        if (typeof img.decode === "function") await img.decode();
      } catch {
        // A decoded image is better, but a loaded image can still be usable.
      }

      resolve();
    };

    img.onerror = () => resolve();
    img.src = src;
  });
};

const addResourceHint = (
  src?: string | null,
  options: { rel: "preload" | "prefetch"; as?: string; priority?: PreloadPriority } = {
    rel: "preload",
    as: "image",
    priority: "high",
  },
) => {
  if (!src || typeof document === "undefined") return () => undefined;

  const href = src;
  const existing = Array.from(
    document.head.querySelectorAll<HTMLLinkElement>(
      `link[data-virtual-tour-hint="${options.rel}"]`,
    ),
  ).find((item) => item.getAttribute("href") === href || item.href === href);

  if (existing) return () => undefined;

  const link = document.createElement("link");
  link.rel = options.rel;
  link.href = href;
  link.dataset.virtualTourHint = options.rel;

  if (options.as) link.as = options.as;
  if (options.as === "image") link.crossOrigin = "anonymous";

  try {
    (link as any).fetchPriority = options.priority || "high";
  } catch {
    // fetchPriority is not supported in every browser.
  }

  document.head.appendChild(link);

  return () => {
    try {
      link.remove();
    } catch {
      // Ignore cleanup errors.
    }
  };
};

const addPreconnectHint = (src?: string | null) => {
  if (!src || typeof document === "undefined" || typeof window === "undefined") {
    return () => undefined;
  }

  let url: URL;

  try {
    url = new URL(src, window.location.href);
  } catch {
    return () => undefined;
  }

  if (url.origin === window.location.origin) return () => undefined;

  const existing = Array.from(
    document.head.querySelectorAll<HTMLLinkElement>(
      'link[data-virtual-tour-preconnect="true"]',
    ),
  ).find((item) => item.getAttribute("href") === url.origin || item.href === url.origin);

  if (existing) return () => undefined;

  const link = document.createElement("link");
  link.rel = "preconnect";
  link.href = url.origin;
  link.crossOrigin = "anonymous";
  link.dataset.virtualTourPreconnect = "true";
  document.head.appendChild(link);

  return () => {
    try {
      link.remove();
    } catch {
      // Ignore cleanup errors.
    }
  };
};

const scheduleIdleTask = (callback: () => void, delay = 80) => {
  if (typeof window === "undefined") return () => undefined;

  let cancelled = false;
  const run = () => {
    if (!cancelled) callback();
  };

  const idleCallback = (window as any).requestIdleCallback;
  const cancelIdleCallback = (window as any).cancelIdleCallback;

  if (typeof idleCallback === "function") {
    const handle = idleCallback(run, { timeout: 900 });

    return () => {
      cancelled = true;
      if (typeof cancelIdleCallback === "function") cancelIdleCallback(handle);
    };
  }

  const timeoutId = window.setTimeout(run, delay);

  return () => {
    cancelled = true;
    window.clearTimeout(timeoutId);
  };
};

const scheduleDelayedIdleTask = (callback: () => void, delay = 0) => {
  if (typeof window === "undefined") return () => undefined;

  let cancelled = false;
  let idleCleanup: (() => void) | null = null;

  const timeoutId = window.setTimeout(() => {
    if (cancelled) return;
    idleCleanup = scheduleIdleTask(callback, 0);
  }, Math.max(0, delay));

  return () => {
    cancelled = true;
    window.clearTimeout(timeoutId);
    idleCleanup?.();
  };
};

const shouldPluginPreloadLink = () => {
  // Preload-in e menaxhon vetëm radha inteligjente custom.
  // Kjo shmang dy ngarkime paralele për të njëjtën panoramë.
  return false;
};

export function VirtualTour360({
  scenes,
  defaultSceneId,
  onClose,
  showAura360Branding = true,
}: VirtualTour360Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const currentSceneRef = useRef<SceneType | null>(null);
  const isNavigatingRef = useRef(false);
  const pendingEntryOrientationRef = useRef<Orientation | null>(null);
  const sceneButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({});
const browserPreloadPromisesRef = useRef<Map<string, Promise<void>>>(
  new Map(),
);

const preloadSchedulerRef = useRef<ReturnType<typeof createTourPreloadScheduler> | null>(null);
const preparedPlanRef = useRef<((sceneIds: number[]) => void) | null>(null);
const preparedIntentRef = useRef<((sceneId: number) => void) | null>(null);
const isPreparedRef = useRef<((src: string) => boolean) | null>(null);
const preloadRetryAfterRef = useRef<Map<string, number>>(new Map());

const psvReadyPanoramasRef = useRef<Set<string>>(new Set());

const preloadSequenceRef = useRef(0);

const neighborhoodWarmupCleanupRef = useRef<(() => void) | null>(
  null,
);

  const [currentSceneId, setCurrentSceneId] = useState<number | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isViewerVisible, setIsViewerVisible] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showFirstLoadHint, setShowFirstLoadHint] = useState(false);
  const [canUseFullscreen, setCanUseFullscreen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  const sortedScenes = useMemo(
    () => [...scenes].sort((a, b) => a.sortOrder - b.sortOrder),
    [scenes],
  );

  const scenesById = useMemo(() => {
    return new Map(sortedScenes.map((scene) => [Number(scene.id), scene]));
  }, [sortedScenes]);

  const linkedSceneIdsBySceneId = useMemo(() => {
    const map = new Map<number, number[]>();

    sortedScenes.forEach((scene) => {
      const validTargetIds = uniqueNumbers(
        scene.hotspots
          .map((hotspot) => getRuntimeHotspotTargetSceneId(hotspot as RuntimeHotspot))
          .filter((id): id is number => id !== null && scenesById.has(id)),
      );

      map.set(Number(scene.id), validTargetIds);
    });

    return map;
  }, [sortedScenes, scenesById]);


  const nodes = useMemo(() => {
    return sortedScenes.map((scene) => {
      const validHotspots = scene.hotspots
        .map((hotspot) => {
          const runtimeHotspot = hotspot as RuntimeHotspot;
          const toSceneId = getRuntimeHotspotTargetSceneId(runtimeHotspot);

          if (toSceneId === null || !scenesById.has(toSceneId)) return null;

          return {
            ...hotspot,
            id: getRuntimeHotspotId(runtimeHotspot),
            fromSceneId: getRuntimeHotspotSourceSceneId(runtimeHotspot, Number(scene.id)),
            toSceneId,
            yaw: getRuntimeHotspotYaw(runtimeHotspot),
            pitch: getRuntimeHotspotPitch(runtimeHotspot),
            targetYaw: getRuntimeHotspotTargetYaw(runtimeHotspot),
            targetPitch: getRuntimeHotspotTargetPitch(runtimeHotspot),
            label: String(hotspot.label || "").trim() || null,
          };
        })
        .filter((hotspot): hotspot is NonNullable<typeof hotspot> => hotspot !== null);

      const clusteredPositions = getClusteredHotspotPositions(validHotspots);

      return {
        id: String(scene.id),
        panorama: scene.imageUrl,
        thumbnail:
  scene.thumbnailUrl?.trim() ||
  TOUR_THUMBNAIL_PLACEHOLDER,
        name: scene.title,
        caption: scene.title,
        data: {
          initialYaw: scene.initialYaw ?? null,
          initialPitch: scene.initialPitch ?? null,
        },
        links: validHotspots.map((hotspot) => {
          const visualPosition = clusteredPositions.get(Number(hotspot.id));
          const targetTitle = scenesById.get(Number(hotspot.toSceneId))?.title;
          const baseName = hotspot.label || targetTitle || "Lidhje";

          return {
            nodeId: String(hotspot.toSceneId),
position: {
  yaw: hotspot.yaw,
  pitch: hotspot.pitch,
},
            name: visualPosition?.isClustered
              ? `${baseName} · ${Number(visualPosition.clusterIndex) + 1}/${visualPosition.clusterSize}`
              : baseName,
            data: {
              hotspotId: hotspot.id,
              fromSceneId: hotspot.fromSceneId,
              toSceneId: hotspot.toSceneId,
              targetYaw: hotspot.targetYaw ?? null,
              targetPitch: hotspot.targetPitch ?? null,
              rawYaw: visualPosition?.rawYaw ?? hotspot.yaw,
              rawPitch: visualPosition?.rawPitch ?? hotspot.pitch,
displayYaw: hotspot.yaw,
displayPitch: hotspot.pitch,
              isClustered: !!visualPosition?.isClustered,
              clusterIndex: visualPosition?.clusterIndex ?? 0,
              clusterSize: visualPosition?.clusterSize ?? 1,
            },
          };
        }),
      };
    });
  }, [sortedScenes, scenesById]);

  const hasMap = useMemo(
    () => sortedScenes.some((scene) => scene.positionX != null && scene.positionY != null),
    [sortedScenes],
  );

  const resolvedStartScene = useMemo(() => {
    return (
      sortedScenes.find((scene) => Number(scene.id) === Number(defaultSceneId)) ||
      sortedScenes.find((scene) => scene.isDefault) ||
      sortedScenes[0] ||
      null
    );
  }, [sortedScenes, defaultSceneId]);

  const getSceneById = useCallback(
    (id: number) => scenesById.get(Number(id)) || null,
    [scenesById],
  );


  const getSceneStartOrientation = useCallback(
    (sceneId: number): Orientation | null => {
      const scene = getSceneById(sceneId);
      if (!scene) return null;

      if (
        typeof scene.initialYaw === "number" &&
        typeof scene.initialPitch === "number" &&
        Number.isFinite(scene.initialYaw) &&
        Number.isFinite(scene.initialPitch)
      ) {
        return { yaw: scene.initialYaw, pitch: scene.initialPitch };
      }

      return null;
    },
    [getSceneById],
  );

  const getDirectHotspotEntryOrientation = useCallback(
    (targetSceneId: number, link: any | null): Orientation | null => {
      const targetYaw = toFiniteNumber(link?.data?.targetYaw);
      if (targetYaw === null) return null;

      const targetPitch = toFiniteNumber(link?.data?.targetPitch);
      const sceneStart = getSceneStartOrientation(targetSceneId);

      return {
        yaw: normalizeYaw(targetYaw),
        pitch: clampPitch(targetPitch ?? sceneStart?.pitch ?? 0),
      };
    },
    [getSceneStartOrientation],
  );

  const getReverseHotspotEntryOrientation = useCallback(
    (targetSceneId: number, sourceSceneId?: number | null): Orientation | null => {
      const sourceId = toFiniteNumber(sourceSceneId);
      if (sourceId === null) return null;

      const targetScene = getSceneById(targetSceneId);
      if (!targetScene) return null;

      const reverseHotspots = targetScene.hotspots.filter(
        (hotspot) => getRuntimeHotspotTargetSceneId(hotspot as RuntimeHotspot) === Number(sourceId),
      );
      // Multiple return links are ambiguous: use the saved entry view instead.
      const reverseHotspot = reverseHotspots.length === 1 ? reverseHotspots[0] : null;

      const reverseYaw = reverseHotspot
        ? getRuntimeHotspotYaw(reverseHotspot as RuntimeHotspot)
        : null;
      if (reverseYaw === null) return null;

      const sceneStart = getSceneStartOrientation(targetSceneId);

      // If B has a hotspot back to A, entering B from A should face forward into B,
      // not back toward the door we came from. Therefore we use the opposite yaw.
      return {
        yaw: normalizeYaw(reverseYaw + Math.PI),
        pitch: clampPitch(sceneStart?.pitch ?? 0),
      };
    },
    [getSceneById, getSceneStartOrientation],
  );

  const getNavigationEntryOrientation = useCallback(
    (targetSceneId: number, link: any | null): Orientation | null => {
      const directSavedOrientation = getDirectHotspotEntryOrientation(targetSceneId, link);
      if (directSavedOrientation) return directSavedOrientation;

      // Only hotspot navigation may use a reverse-link fallback. Map/gallery clicks should
      // open the scene with its own start view instead of guessing from the current scene.
      const sourceSceneId = toFiniteNumber(link?.data?.fromSceneId) ?? currentSceneRef.current?.id;
      const reverseOrientation = link
        ? getReverseHotspotEntryOrientation(targetSceneId, sourceSceneId)
        : null;

      if (reverseOrientation) {
        const departure = viewerRef.current?.getPosition();
        const sourceYaw = toFiniteNumber(link?.data?.rawYaw ?? link?.position?.yaw);
        if (departure && sourceYaw !== null) {
          // Preserve where the visitor is looking relative to the travel direction.
          // A saved targetYaw above remains authoritative.
          return {
            yaw: normalizeYaw(reverseOrientation.yaw + normalizeYaw(departure.yaw - sourceYaw)),
            pitch: clampPitch(departure.pitch),
          };
        }
        return reverseOrientation;
      }

      return getSceneStartOrientation(targetSceneId);
    },
    [getDirectHotspotEntryOrientation, getReverseHotspotEntryOrientation, getSceneStartOrientation],
  );

  const preloadBrowserImageOnce = useCallback(
  (
    src?: string | null,
    priority: PreloadPriority = "low",
  ): Promise<void> => {
    if (!src) return Promise.resolve();

    const existingPromise =
      browserPreloadPromisesRef.current.get(src);

    if (existingPromise) {
      return existingPromise;
    }

    const promise = preloadBrowserImage(src, priority).finally(() => {
      browserPreloadPromisesRef.current.delete(src);
    });

    browserPreloadPromisesRef.current.set(src, promise);

    return promise;
  },
  [],
);

const preloadScenePanoramaOnce = useCallback(
  (sceneId: number | null, priority: PreloadPriority = "low", foreground = false): Promise<void> => {
    if (sceneId === null) return Promise.resolve();
    const scene = getSceneById(sceneId);
    if (!scene?.imageUrl) return Promise.resolve();
    const src = scene.imageUrl;
    const viewer = viewerRef.current as any;
    if (Cache.get(src, src) || isPreparedRef.current?.(src)) return Promise.resolve();
    if (!viewer) return Promise.resolve();
    if (!foreground && (preloadRetryAfterRef.current.get(src) ?? 0) > Date.now()) return Promise.resolve();
    if (!preloadSchedulerRef.current) {
      preloadSchedulerRef.current = createTourPreloadScheduler(getPreloadPlan().immediate);
    }
    return preloadSchedulerRef.current.request(src, async () => {
      if (viewerRef.current !== viewer || Cache.get(src, src) || isPreparedRef.current?.(src)) return;
      try {
        if (viewer.textureLoader?.loadFile) {
          await viewer.textureLoader.loadFile(src, undefined, src);
        } else if (viewer.textureLoader?.preloadPanorama) {
          const data = await viewer.textureLoader.preloadPanorama(src);
          // A fallback preload creates a texture. Release it after caching the file.
          viewer.adapter?.disposeTexture?.(data);
        } else {
          await preloadBrowserImageOnce(src, priority);
        }
        preloadRetryAfterRef.current.delete(src);
      } catch (error) {
        if (viewerRef.current === viewer) preloadRetryAfterRef.current.set(src, Date.now() + 15000);
        // A failed speculation must not prevent the real navigation from retrying.
        console.warn("Panorama preload failed:", error);
      }
    }, foreground ? 2 : priority === "high" ? 1 : 0);
  },
  [getSceneById, preloadBrowserImageOnce],
);

const handleSceneIntent = useCallback((sceneId: number) => {
  if (isNavigatingRef.current) return;
  void preloadScenePanoramaOnce(sceneId, "high");
  preparedIntentRef.current?.(sceneId);
}, [preloadScenePanoramaOnce]);

const getPrioritizedLinkedSceneIds = useCallback(
  (sceneId: number | null) => {
    if (sceneId === null) {
      return [] as number[];
    }

    const fallbackTargetIds =
      linkedSceneIdsBySceneId.get(Number(sceneId)) || [];

    const currentNode = nodes.find(
      (node) => Number(node.id) === Number(sceneId),
    );

    if (!currentNode || fallbackTargetIds.length <= 1) {
      return fallbackTargetIds;
    }

    let viewerPosition: Orientation | null = null;

    try {
      const position =
        viewerRef.current?.getPosition?.();

      if (
        position &&
        Number.isFinite(position.yaw) &&
        Number.isFinite(position.pitch)
      ) {
        viewerPosition = {
          yaw: normalizeYaw(position.yaw),
          pitch: clampPitch(position.pitch),
        };
      }
    } catch {
      viewerPosition = null;
    }

    if (!viewerPosition) {
      return fallbackTargetIds;
    }

    const scoresByTargetId = new Map<number, number>();

    /*
     * Përdorim pozicionet vizuale reale të hotspot-eve.
     * Kjo përfshin edhe fan-out-in e hotspot-eve që janë
     * shumë afër njëri-tjetrit.
     */
    currentNode.links.forEach((link: any) => {
      const targetId = toFiniteNumber(link?.nodeId);
      const yaw = toFiniteNumber(link?.position?.yaw);
      const pitch = toFiniteNumber(link?.position?.pitch);

      if (
        targetId === null ||
        yaw === null ||
        pitch === null ||
        !scenesById.has(targetId)
      ) {
        return;
      }

      const yawDistance = getYawDistance(
        yaw,
        viewerPosition.yaw,
      );

      const pitchDistance = Math.abs(
        pitch - viewerPosition.pitch,
      );

      const distance = Math.hypot(
        yawDistance,
        pitchDistance,
      );

      const previousScore =
        scoresByTargetId.get(targetId);

      if (
        previousScore === undefined ||
        distance < previousScore
      ) {
        scoresByTargetId.set(targetId, distance);
      }
    });

    return [...fallbackTargetIds].sort((a, b) => {
      const scoreA =
        scoresByTargetId.get(a) ??
        Number.MAX_SAFE_INTEGER;

      const scoreB =
        scoresByTargetId.get(b) ??
        Number.MAX_SAFE_INTEGER;

      return scoreA - scoreB;
    });
  },
  [
    linkedSceneIdsBySceneId,
    nodes,
    scenesById,
  ],
);

const warmSceneNeighborhood = useCallback(
  (sceneId: number | null) => {
    /*
     * Ndal radhen e vjetër kur:
     * - ndryshon skena;
     * - përdoruesi ndryshon drejtimin;
     * - hotspot-et prioritare ndryshojnë.
     */
    neighborhoodWarmupCleanupRef.current?.();
    neighborhoodWarmupCleanupRef.current = null;

    const sequenceId = ++preloadSequenceRef.current;
    preloadSchedulerRef.current?.cancelQueued();

    if (sceneId === null) {
      return;
    }

    const plan = getPreloadPlan();

    const orderedTargetIds =
      getPrioritizedLinkedSceneIds(sceneId).slice(
        0,
        plan.total,
      );

    preparedPlanRef.current?.(orderedTargetIds);

    if (orderedTargetIds.length === 0) {
      return;
    }

    /*
     * Vetëm hotspot-i më i mundshëm në telefon,
     * ose dy hotspot-et më të mundshme në desktop,
     * fillojnë menjëherë.
     */
    const immediateTargetIds =
      orderedTargetIds.slice(0, plan.immediate);

    const deferredTargetIds =
      orderedTargetIds.slice(plan.immediate);

    const immediatePreload = Promise.all(
      immediateTargetIds.map((targetId) =>
        preloadScenePanoramaOnce(
          targetId,
          "high",
        ),
      ),
    );

    if (deferredTargetIds.length === 0) {
      return;
    }

    /*
     * Panorama të tjera ngarkohen njëra pas tjetrës.
     * Nuk hapim 6–10 request-e të mëdha njëkohësisht.
     */
    neighborhoodWarmupCleanupRef.current =
      scheduleDelayedIdleTask(() => {
        void (async () => {
          await immediatePreload;

          if (
            preloadSequenceRef.current !== sequenceId
          ) {
            return;
          }

          for (const targetId of deferredTargetIds) {
            if (
              preloadSequenceRef.current !== sequenceId
            ) {
              return;
            }

            await preloadScenePanoramaOnce(
              targetId,
              "low",
            );

            if (
              preloadSequenceRef.current !== sequenceId
            ) {
              return;
            }

            await waitForPreloadGap(plan.gapMs);
          }
        })();
      }, 120);
  },
  [
    getPrioritizedLinkedSceneIds,
    preloadScenePanoramaOnce,
  ],
);

  const getTransitionWithEntryOrientation = useCallback(
    (orientation: Orientation | null): NavigationTransitionOptions => {
      const transition: NavigationTransitionOptions = {
        ...NAVIGATION_TRANSITION,
        speed: prefersReducedTourMotion() ? 140 : NAVIGATION_TRANSITION.speed,
        zoomTo: viewerRef.current?.getZoomLevel(),
      };

      if (isFiniteOrientation(orientation)) {
        transition.rotateTo = {
          yaw: normalizeYaw(orientation.yaw),
          pitch: clampPitch(orientation.pitch),
        };
      }

      return transition;
    },
    [],
  );

  const getPluginTransitionOptions = useCallback(
    (toNode: any, _fromNode?: any, fromLink?: any): NavigationTransitionOptions => {
      const targetSceneId = toFiniteNumber(toNode?.id ?? fromLink?.nodeId);
      const entryOrientation =
        targetSceneId !== null
          ? getNavigationEntryOrientation(targetSceneId, fromLink ?? null)
          : null;

      pendingEntryOrientationRef.current = entryOrientation;

      return getTransitionWithEntryOrientation(entryOrientation);
    },
    [getNavigationEntryOrientation, getTransitionWithEntryOrientation],
  );

  const goToScene = useCallback(
    async (targetSceneId: number, forcedOrientation?: Orientation | null) => {
      const viewer = viewerRef.current;
      if (!viewer) return;

      const targetScene = getSceneById(targetSceneId);
      if (!targetScene) return;

      if (currentSceneRef.current?.id === targetSceneId) return;
      if (isNavigatingRef.current) return;

      setLoadError(null);

      const entryOrientation = forcedOrientation ?? getNavigationEntryOrientation(targetSceneId, null);
      pendingEntryOrientationRef.current = entryOrientation;

      try {
        const vtPlugin = viewer.getPlugin(VirtualTourPlugin as any) as any;

        await vtPlugin.setCurrentNode(
          String(targetSceneId),
          getTransitionWithEntryOrientation(entryOrientation),
        );
      } catch (error) {
        console.error("Scene change error:", error);
        setLoadError("Skena nuk u hap. Provoni edhe një herë.");
      }
    },
    [getSceneById, getNavigationEntryOrientation, getTransitionWithEntryOrientation],
  );

  const handleSceneChange = useCallback(
    async (id: number) => {
      await goToScene(id);
    },
    [goToScene],
  );

  const handleCloseTour = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error("Fullscreen error:", error);
    }
  }, []);

  useEffect(() => {
    Cache.enabled = true;
    Cache.ttl = CACHE_TTL_SECONDS;
    Cache.maxItems = getCacheMaxItems();
  }, []);

  useEffect(() => {
    const updateCapabilities = () => {
      setCanUseFullscreen(!!document.fullscreenEnabled);
      setIsDesktop(getDeviceProfile().isDesktop);
    };

    updateCapabilities();

    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    const onResize = () => updateCapabilities();

    document.addEventListener("fullscreenchange", onFullscreenChange);
    window.addEventListener("resize", onResize);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    if (!resolvedStartScene) return;

    const cleanups = [addPreconnectHint(resolvedStartScene.imageUrl)];
    const thumbnail = resolvedStartScene.thumbnailUrl;
    if (thumbnail && thumbnail !== resolvedStartScene.imageUrl) {
      cleanups.push(addResourceHint(thumbnail, { rel: "preload", as: "image", priority: "high" }));
      void preloadBrowserImageOnce(thumbnail, "high");
    }

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [
    resolvedStartScene,
    preloadBrowserImageOnce,
  ]);

  useEffect(() => {
    if (!containerRef.current || !resolvedStartScene || nodes.length === 0) return;

    if (viewerRef.current) {
      viewerRef.current.destroy();
      viewerRef.current = null;
    }

    setIsInitialLoading(true);
    setIsViewerVisible(false);
    setLoadError(null);
    setShowFirstLoadHint(false);

   
   
   const initialOrientation = getSceneStartOrientation(resolvedStartScene.id);

let disposed = false;
let navigationBusy = false;
// The native fade owns the animation clock. Translate its two existing
// panorama spheres on that same clock; never animate a screenshot or zoom.
// Renderer groups are version-sensitive, so unsupported layouts use plain fade.
type WalkState = {
  direction: { x: number; y: number; z: number };
  outgoingMesh: any;
  outgoingContainer: any;
  outgoingOrigin: { x: number; y: number; z: number };
  incomingContainer?: any;
  incomingOrigin?: { x: number; y: number; z: number };
};
let walkState: WalkState | null = null;
const host = containerRef.current;

const clearWalkTransition = () => {
  if (walkState) {
    const { outgoingContainer, outgoingOrigin, incomingContainer, incomingOrigin } = walkState;
    outgoingContainer.position.set(outgoingOrigin.x, outgoingOrigin.y, outgoingOrigin.z);
    if (incomingContainer && incomingOrigin) {
      incomingContainer.position.set(incomingOrigin.x, incomingOrigin.y, incomingOrigin.z);
    }
  }
  walkState = null;
};

let didFinishInitialLoad = false;
let loaderExitTimer: number | null = null;

let firstLoadHintTimer: number | null = window.setTimeout(() => {
  if (!didFinishInitialLoad) {
    setShowFirstLoadHint(true);
  }
}, FIRST_LOAD_HINT_MS);

const clearFirstLoadHintTimer = () => {
  if (firstLoadHintTimer !== null) {
    window.clearTimeout(firstLoadHintTimer);
    firstLoadHintTimer = null;
  }
};

const clearLoaderExitTimer = () => {
  if (loaderExitTimer !== null) {
    window.clearTimeout(loaderExitTimer);
    loaderExitTimer = null;
  }
};

const finishInitialLoad = () => {
  if (didFinishInitialLoad) return;

  didFinishInitialLoad = true;
  clearFirstLoadHintTimer();

  currentSceneRef.current = resolvedStartScene;
  setCurrentSceneId(resolvedStartScene.id);
  psvReadyPanoramasRef.current.add(resolvedStartScene.imageUrl);

  requestAnimationFrame(() => {
    if (disposed) return;
    setIsViewerVisible(true);
    warmSceneNeighborhood(resolvedStartScene.id);

    clearLoaderExitTimer();

    loaderExitTimer = window.setTimeout(() => {
      setIsInitialLoading(false);
      setShowFirstLoadHint(false);
      loaderExitTimer = null;
    }, 380);
  });
};
   

    const deviceProfile = getDeviceProfile();
    const lens = getTourLens(deviceProfile.isMobile);
    const hasTouchInput = navigator.maxTouchPoints > 0 && window.matchMedia("(pointer: coarse)").matches;
    const openingFov = lens.maxFov + (TOUR_MIN_FOV - lens.maxFov) * lens.openingZoom / 100;

    // Match the viewer's configured FOV. Focal-length scaling also shrinks
    // the rings on zoom-out while preserving their relative depth sizes.
    const getHotspotZoomScale = (zoomLevel: number) => {
      const maxFov = lens.maxFov;
      const baseZoom = lens.openingZoom;
      const fovAt = (zoom: number) =>
        maxFov + (TOUR_MIN_FOV - maxFov) * Math.max(0, Math.min(100, zoom)) / 100;
      return Math.tan(fovAt(baseZoom) * Math.PI / 360) /
        Math.tan(fovAt(zoomLevel) * Math.PI / 360);
    };

    const viewer = new Viewer({
      container: containerRef.current,
      navbar: deviceProfile.isDesktop ? ["zoom", "move"] : false,
      adapter: EquirectangularAdapter.withConfig({
        resolution: getViewerResolution(),
        useXmpData: true,
      }),
      defaultYaw: initialOrientation?.yaw ?? 0,
      defaultPitch: initialOrientation?.pitch ?? 0,
      defaultTransition: NAVIGATION_TRANSITION,
      maxFov: lens.maxFov,
      minFov: TOUR_MIN_FOV,
      defaultZoomLvl: lens.openingZoom,
      zoomSpeed: 1.05,
      moveSpeed: getTourMoveSpeed(host.clientWidth, host.clientHeight, hasTouchInput, openingFov),
      moveInertia: 0.82,
      mousewheelCtrlKey: false,
      touchmoveTwoFingers: false,
      rendererParameters: {
        alpha: false,
        antialias: !deviceProfile.isMobile && !deviceProfile.isLowMemory,
        powerPreference: "high-performance",
      },
      plugins: [
        [
          VirtualTourPlugin,
          {
            positionMode: "manual",
            renderMode: "2d",
            startNodeId: String(resolvedStartScene.id),
            nodes,
            preload: shouldPluginPreloadLink,
            transitionOptions: getPluginTransitionOptions,
showLinkTooltip: false,

arrowStyle: {
  element: (link: any) =>
    createAura360NavigationHotspot(
      toFiniteNumber(link.data?.rawPitch ?? link.position?.pitch) ?? NaN,
      getHotspotZoomScale(
        viewerRef.current?.getZoomLevel() ?? lens.openingZoom,
      ),
      `Shko te ${link.name || scenesById.get(Number(link.nodeId))?.title || "pamja tjetër"}`,
      () => {
        const activeViewer = viewerRef.current;
        if (activeViewer && !isNavigatingRef.current) {
          const plugin = activeViewer.getPlugin(VirtualTourPlugin as any) as any;
          void plugin.setCurrentNode(String(link.nodeId), null, link);
        }
      },
      () => handleSceneIntent(Number(link.nodeId)),
    ),

  size: {
    width: 180,
    height: 108,
  },

  className: "aura360-floor-link",
},
            arrowsPosition: {
              minPitch: 0.2,
              maxPitch: Math.PI / 2,
              linkOverlapAngle: 0,
              linkPitchOffset: -0.08,
            },
          },
        ],
      ],
    });

viewerRef.current = viewer;

const updateTouchMoveSpeed = () => {
  if (disposed) return;
  const size = viewer.getSize();
  viewer.setOption("moveSpeed", getTourMoveSpeed(size.width, size.height, hasTouchInput, openingFov));
};
viewer.addEventListener("size-updated", updateTouchMoveSpeed);

const updateAura360HotspotZoomSize = (
  zoomLevel = viewer.getZoomLevel(),
) => {
  const zoomScale = getHotspotZoomScale(zoomLevel);
  containerRef.current
    ?.querySelectorAll<HTMLElement>(".aura360-navigation-hotspot")
    .forEach((hotspot) => setAura360HotspotSize(hotspot, zoomScale));
};

const handleAura360HotspotZoom = () => {
  updateAura360HotspotZoomSize();
};

viewer.addEventListener(
  "zoom-updated",
  handleAura360HotspotZoom,
);

/*
 * Apliko scale edhe pas renderimit të parë.
 */
requestAnimationFrame(() => {
  if (!disposed) updateAura360HotspotZoomSize();
});

// Keep preparation separate from the existing native transition.
// Only a bounded number of likely destinations retain decoded textures.
const adapter = (viewer as any).adapter;
const originalLoadTexture = adapter.loadTexture;
type PreparedTexture = { data: any; pixels: number };
type PreparingTexture = { src: string; claimed: boolean; promise: Promise<any | null> };
const preparedTextures = new Map<string, PreparedTexture>();
const tooLargeToPrepare = new Set<string>();
const preparationCooldown = new Map<string, number>();
const preparedLimit = deviceProfile.isLowMemory ? 0 : deviceProfile.isMobile ? 1 : 2;
const preparedPixelBudget = (deviceProfile.isMobile ? 16 : 32) * 1024 * 1024;
let preparingTexture: PreparingTexture | null = null;
let preparationQueue: number[] = [];
let wantedPreparedUrls = new Set<string>();
let cancelPreparationIdle: (() => void) | null = null;
let lastViewMovement = 0;

const disposePrepared = (src: string) => {
  const entry = preparedTextures.get(src);
  if (!entry) return;
  preparedTextures.delete(src);
  adapter.disposeTexture(entry.data);
};
const abortTexture = () => Object.assign(new Error("Tour closed"), { name: "AbortError" });
const usedPreparedPixels = () => Array.from(preparedTextures.values()).reduce((sum, entry) => sum + entry.pixels, 0);

const schedulePreparation = () => {
  cancelPreparationIdle?.();
  cancelPreparationIdle = null;
  if (disposed || navigationBusy || !preparedLimit || preparingTexture || !preparationQueue.length || document.hidden) return;
  cancelPreparationIdle = scheduleDelayedIdleTask(() => {
    cancelPreparationIdle = null;
    if (disposed || navigationBusy || document.hidden) return;
    if (performance.now() - lastViewMovement < 300) { schedulePreparation(); return; }
    const id = preparationQueue.shift();
    const scene = id !== undefined ? getSceneById(id) : null;
    if (!scene || scene.id === currentSceneRef.current?.id || preparedTextures.has(scene.imageUrl) ||
        tooLargeToPrepare.has(scene.imageUrl) || (preparationCooldown.get(scene.imageUrl) ?? 0) > Date.now()) {
      schedulePreparation(); return;
    }
    const src = scene.imageUrl;
    const job: PreparingTexture = { src, claimed: false, promise: Promise.resolve(null) };
    preparingTexture = job;
    job.promise = (async () => {
      // Reuse the blob queue; never start a second request for the same file.
      await preloadScenePanoramaOnce(id!, "low");
      if (disposed || (!job.claimed && (navigationBusy || !wantedPreparedUrls.has(src))) || !Cache.get(src, src)) return null;
      while (preparedTextures.size >= preparedLimit) disposePrepared(preparedTextures.keys().next().value!);
      const data = await originalLoadTexture.call(adapter, src, false);
      if (disposed) { adapter.disposeTexture(data); return null; }
      // Ownership is transferred exactly once to setPanorama when clicked.
      if (job.claimed) return data;
      if (navigationBusy || !wantedPreparedUrls.has(src)) { adapter.disposeTexture(data); return null; }
      const img = data.texture?.image;
      const pixels = Number(img?.width) * Number(img?.height);
      if (!Number.isFinite(pixels) || pixels <= 0 || pixels > preparedPixelBudget) {
        tooLargeToPrepare.add(src);
        adapter.disposeTexture(data);
        return null;
      }
      while (preparedTextures.size && usedPreparedPixels() + pixels > preparedPixelBudget) {
        disposePrepared(preparedTextures.keys().next().value!);
      }
      // Upload at idle as well, when supported, so clicking avoids this work.
      try { (viewer.renderer as any).renderer?.initTexture?.(data.texture); } catch { /* Native transition can upload it. */ }
      preparedTextures.set(src, { data, pixels });
      return data;
    })().catch(() => {
      preparationCooldown.set(src, Date.now() + 15000);
      return null;
    }).finally(() => {
      if (preparingTexture === job) preparingTexture = null;
      schedulePreparation();
    });
  }, 160);
};

const planPreparedTextures = (sceneIds: number[]) => {
  if (disposed || !preparedLimit) return;
  preparationQueue = uniqueNumbers(sceneIds).slice(0, preparedLimit);
  wantedPreparedUrls = new Set(preparationQueue.map((id) => getSceneById(id)?.imageUrl).filter((src): src is string => !!src));
  // Keep already prepared views until their bounded slots are needed.
  // Turning slightly must not repeatedly dispose and decode the same image.
  for (const src of Array.from(wantedPreparedUrls).reverse()) {
    const entry = preparedTextures.get(src);
    if (entry) { preparedTextures.delete(src); preparedTextures.set(src, entry); }
  }
  schedulePreparation();
};
preparedPlanRef.current = planPreparedTextures;
preparedIntentRef.current = (id) => planPreparedTextures([id, ...getPrioritizedLinkedSceneIds(currentSceneRef.current?.id ?? null)]);
isPreparedRef.current = (src) => preparedTextures.has(src);

adapter.loadTexture = async function (panorama: any, loader = true, panoData?: any, useXmp?: boolean) {
  const compatible = typeof panorama === "string" && panoData == null &&
    (useXmp === undefined || useXmp === adapter.config?.useXmpData);
  if (compatible) {
    const ready = preparedTextures.get(panorama);
    if (ready) {
      preparedTextures.delete(panorama); // The viewer now owns and disposes it.
      return ready.data;
    }
    const pending = preparingTexture;
    if (pending?.src === panorama && !pending.claimed) {
      pending.claimed = true;
      const data = await pending.promise;
      if (disposed) throw abortTexture();
      if (data) return data;
    }
  }
  if (disposed) throw abortTexture();
  return originalLoadTexture.call(adapter, panorama, loader, panoData, useXmp);
};

const resumePreparation = () => {
  if (!document.hidden) schedulePreparation();
};
document.addEventListener("visibilitychange", resumePreparation);

// Preserve user rotation across the panorama coordinate change at arrival.
const transitionRenderer = viewer.renderer as any;
const originalRendererTransition = transitionRenderer.transition;
let stopTrackingTransition: (() => void) | null = null;
transitionRenderer.transition = function (textureData: any, options: any, transition: any) {
  stopTrackingTransition?.();
  if (!options.position || transition.rotation) {
    return originalRendererTransition.call(this, textureData, options, transition);
  }
  const departure = viewer.getPosition();
  const arrival = { ...options.position };
  const liveOptions = { ...options, position: { ...arrival } };
  const trackRotation = () => {
    const position = viewer.getPosition();
    liveOptions.position = {
      yaw: normalizeYaw(arrival.yaw + normalizeYaw(position.yaw - departure.yaw)),
      pitch: clampPitch(arrival.pitch + position.pitch - departure.pitch),
    };
  };
  viewer.addEventListener("position-updated", trackRotation);
  const stop = () => viewer.removeEventListener("position-updated", trackRotation);
  stopTrackingTransition = stop;
  try {
    const animation = originalRendererTransition.call(this, textureData, liveOptions, transition);
    animation.then(() => { stop(); if (stopTrackingTransition === stop) stopTrackingTransition = null; });
    return animation;
  } catch (error) { stop(); throw error; }
};

const originalSetTextureOpacity = adapter.setTextureOpacity;
adapter.setTextureOpacity = function (mesh: any, opacity: number) {
  const state = walkState;
  const parent = mesh?.parent;
  if (!state || mesh === state.outgoingMesh || !parent?.position?.set ||
      parent === state.outgoingContainer ||
      (state.incomingContainer && state.incomingContainer !== parent)) {
    return originalSetTextureOpacity.call(adapter, mesh, opacity);
  }
  if (!state.incomingContainer) {
    state.incomingContainer = parent;
    state.incomingOrigin = { x: parent.position.x, y: parent.position.y, z: parent.position.z };
  }
  const progress = Math.max(0, Math.min(1, opacity));
  const d = state.direction;
  const out = state.outgoingOrigin;
  const into = state.incomingOrigin!;

  // Moving the sphere opposite the travel vector is equivalent to moving
  // the camera forward inside it. The incoming sphere settles at its center.
  // Both images move in the same direction; neither zooms back at arrival.
  const outgoingProgress = progress >= 1 ? 0 : progress;
  state.outgoingContainer.position.set(
    out.x - d.x * outgoingProgress,
    out.y - d.y * outgoingProgress,
    out.z - d.z * outgoingProgress,
  );
  parent.position.set(
    into.x + d.x * (1 - progress),
    into.y + d.y * (1 - progress),
    into.z + d.z * (1 - progress),
  );

  // Keep the start/end visually clean; mix the views mainly mid-step.
  const blend = Math.max(0, Math.min(1, (progress - 0.12) / 0.76));
  const opacityIn = blend * blend * (3 - 2 * blend);
  return originalSetTextureOpacity.call(adapter, mesh, opacityIn);
};

const vtPlugin = viewer.getPlugin(
  VirtualTourPlugin as any,
) as any;

const originalSetCurrentNode =
  vtPlugin.setCurrentNode.bind(vtPlugin);

// One navigation owner for hotspots, keyboard, map and gallery.
vtPlugin.setCurrentNode = async (
  nodeId: string,
  options?: any,
  fromLink?: any,
): Promise<boolean> => {
  if (disposed || navigationBusy) return false;
  if (String(currentSceneRef.current?.id) === nodeId && !options?.forceUpdate) return true;
  const targetSceneId = toFiniteNumber(nodeId);
  const targetScene = targetSceneId !== null ? getSceneById(targetSceneId) : null;
  if (!targetScene) return false;

  navigationBusy = true;
  isNavigatingRef.current = true;
  setLoadError(null);
  const sourceScene = currentSceneRef.current;
  let departure = viewer.getPosition();
  let entryZoom = viewer.getZoomLevel();
  let hasStarted = false;
  const wasInert = host.inert;
  neighborhoodWarmupCleanupRef.current?.();
  neighborhoodWarmupCleanupRef.current = null;
  preloadSequenceRef.current += 1;
  preloadSchedulerRef.current?.cancelQueued();
  cancelPreparationIdle?.();
  cancelPreparationIdle = null;

  try {
    // Reuse the existing blob request. The viewer then decodes the destination
    // and starts its native transition only once the texture is available.
    await preloadScenePanoramaOnce(targetSceneId, "high", true);
    if (disposed) return false;
    departure = viewer.getPosition();
    entryZoom = viewer.getZoomLevel();
    const entry = options?.rotateTo ?? getNavigationEntryOrientation(targetScene.id, fromLink ?? null);
    const reducedMotion = prefersReducedTourMotion();
    const sourceYaw = toFiniteNumber(fromLink?.data?.rawYaw ?? fromLink?.position?.yaw);
    const sourcePitch = toFiniteNumber(fromLink?.data?.rawPitch ?? fromLink?.position?.pitch);
    const renderer = viewer.renderer as any;
    const outgoingContainer = renderer?.meshContainer;
    const outgoingMesh = renderer?.mesh;
    // Floor links define horizontal travel. Never move downward toward the
    // floor marker, and do not infer a travel path for gallery/map jumps.
    if (!reducedMotion && sourceYaw !== null && sourcePitch !== null &&
        outgoingContainer?.position?.set && outgoingMesh && !adapter.config?.shader) {
      const radius = outgoingMesh.geometry?.parameters?.radius;
      const angleFromView = Math.abs(normalizeYaw(sourceYaw - departure.yaw));
      if (Number.isFinite(radius) && radius > 0 && angleFromView < Math.PI / 2) {
        // Conservative, bounded displacement on an approximate sphere.
        // This is not a measured room reconstruction or a real depth map.
        const depression = Math.max(0, Math.min(Math.PI / 2, -sourcePitch));
        const distanceFactor = 0.14 + 0.06 * (1 - Math.sin(depression));
        const vector = viewer.dataHelper.sphericalCoordsToVector3({ yaw: sourceYaw, pitch: 0 });
        const length = Math.hypot(vector.x, vector.y, vector.z) || 1;
        const distance = radius * distanceFactor;
        walkState = {
          direction: { x: vector.x / length * distance, y: 0, z: vector.z / length * distance },
          outgoingMesh,
          outgoingContainer,
          outgoingOrigin: {
            x: outgoingContainer.position.x,
            y: outgoingContainer.position.y,
            z: outgoingContainer.position.z,
          },
        };
      }
    }
    // Keep dragging available; navigationBusy still prevents duplicate jumps.
    host.setAttribute("aria-busy", "true");
    hasStarted = true;
    const completed = await originalSetCurrentNode(nodeId, {
      ...getTransitionWithEntryOrientation(entry),
      ...options,
      zoomTo: entryZoom,
      showLoader: false,
      rotation: false,
      effect: "fade",
      speed: reducedMotion ? 140 : NAVIGATION_TRANSITION.speed,
    }, fromLink);
    if (!completed && !disposed) throw new Error("Panorama transition was interrupted");
    return completed;
  } catch (error) {
    if (disposed) return false;
    console.error("Tour navigation failed:", error);
    clearWalkTransition();
    // The plugin clears arrows before loading. Re-render the previous node on
    // failure so a bad destination never leaves the tour without navigation.
    if (hasStarted && sourceScene) {
      try {
        await originalSetCurrentNode(String(sourceScene.id), {
          forceUpdate: true, showLoader: false, effect: "none", rotation: false,
          rotateTo: departure, zoomTo: entryZoom,
        });
      } catch { /* Keep the gallery available even if recovery also fails. */ }
    }
    if (!disposed) {
      viewer.hideError();
      setLoadError("Pamja nuk u hap. Provo përsëri ose zgjidh një pamje tjetër.");
    }
    return false;
  } finally {
    clearWalkTransition();
    host.inert = wasInert;
    host.removeAttribute("aria-busy");
    navigationBusy = false;
    if (!disposed && viewerRef.current === viewer) {
      isNavigatingRef.current = false;
      warmSceneNeighborhood(currentSceneRef.current?.id ?? null);
    }
  }
};

viewer.addEventListener("panorama-loaded", () => {
      if (disposed) return;
	
      setLoadError(null);
      const currentScene = currentSceneRef.current || resolvedStartScene;
      if (currentScene?.imageUrl) {
        psvReadyPanoramasRef.current.add(currentScene.imageUrl);
      }

      finishInitialLoad();
    });

    viewer.addEventListener("panorama-error", (error: any) => {
      if (disposed) return;
      console.error("Panorama error:", error);
      setLoadError("Panorama nuk u ngarkua si duhet.");
      finishInitialLoad();
    });

let positionWarmupTimer: number | null = null;

const schedulePositionAwareWarmup = () => {
  lastViewMovement = performance.now();
  if (disposed || navigationBusy) return;
  if (positionWarmupTimer !== null) {
    window.clearTimeout(positionWarmupTimer);
  }

  positionWarmupTimer = window.setTimeout(() => {
    positionWarmupTimer = null;
    if (disposed || navigationBusy) return;

    const activeSceneId = toFiniteNumber(
      currentSceneRef.current?.id,
    );

    if (activeSceneId !== null) {
      warmSceneNeighborhood(activeSceneId);
    }
  }, getPreloadPlan().positionDebounceMs);
};

/*
 * Kur përdoruesi ndalon së rrotulluari panoramën,
 * hotspot-et që janë përpara kamerës marrin
 * prioritet më të lartë.
 */
viewer.addEventListener(
  "position-updated",
  schedulePositionAwareWarmup,
);

vtPlugin.addEventListener(
  "enter-arrow",
  ({ link }: any) => {
    const targetSceneId = Number(link?.nodeId);

    if (!disposed && !navigationBusy && Number.isFinite(targetSceneId)) {
      handleSceneIntent(targetSceneId);
    }
  },
);

vtPlugin.addEventListener(
  "node-changed",
  ({ node }: any) => {
      if (disposed) return;
      const nextId = Number(node.id);
      const nextScene = getSceneById(nextId);

      currentSceneRef.current = nextScene;
      setCurrentSceneId(nextId);
      setLoadError(null);

      if (nextScene?.imageUrl) {
        psvReadyPanoramasRef.current.add(nextScene.imageUrl);
      }

pendingEntryOrientationRef.current = null;

/*
 * Lejo viewer-in ta vizatojë skenën e re fillimisht,
 * pastaj fillo preload-in e lidhjeve të radhës.
 */
requestAnimationFrame(() => {
  if (disposed) return;
  if (!navigationBusy) warmSceneNeighborhood(nextId);

  updateAura360HotspotZoomSize();
});
});

return () => {
  disposed = true;
  cancelPreparationIdle?.();
  preparationQueue = [];
  wantedPreparedUrls.clear();
  preparedPlanRef.current = null;
  preparedIntentRef.current = null;
  isPreparedRef.current = null;
  preloadSchedulerRef.current?.stop();
  preloadSchedulerRef.current = null;
  preloadRetryAfterRef.current.clear();
  for (const src of preparedTextures.keys()) disposePrepared(src);
  adapter.loadTexture = originalLoadTexture;
  document.removeEventListener("visibilitychange", resumePreparation);
  viewer.removeEventListener("size-updated", updateTouchMoveSpeed);
  clearWalkTransition();
  host.inert = false;
  host.removeAttribute("aria-busy");
  isNavigatingRef.current = false;
  stopTrackingTransition?.();
  transitionRenderer.transition = originalRendererTransition;
  adapter.setTextureOpacity = originalSetTextureOpacity;
  clearFirstLoadHintTimer();
  clearLoaderExitTimer();

  if (positionWarmupTimer !== null) {
    window.clearTimeout(positionWarmupTimer);
  }

viewer.removeEventListener(
  "zoom-updated",
  handleAura360HotspotZoom,
);

  preloadSequenceRef.current += 1;

  neighborhoodWarmupCleanupRef.current?.();
  neighborhoodWarmupCleanupRef.current = null;

  viewer.destroy();

  viewerRef.current = null;
  currentSceneRef.current = null;
  pendingEntryOrientationRef.current = null;
};
  }, [
    resolvedStartScene,
    nodes,
    getSceneById,
    getSceneStartOrientation,
    preloadScenePanoramaOnce,
    getPrioritizedLinkedSceneIds,
    handleSceneIntent,
    getPluginTransitionOptions,
    getNavigationEntryOrientation,
    getTransitionWithEntryOrientation,
    scenesById,
    warmSceneNeighborhood,
  ]);



  useEffect(() => {
    if (currentSceneId === null) return;

    const activeButton = sceneButtonRefs.current[currentSceneId];
    if (!activeButton) return;

    activeButton.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [currentSceneId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleCloseTour();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleCloseTour]);

  if (sortedScenes.length === 0) {
    return (
      <div className="w-full h-full min-h-[100dvh] md:min-h-[500px] flex items-center justify-center bg-black text-white">
        Asnjë skenë e disponueshme.
      </div>
    );
  }

  const currentScene = currentSceneId !== null ? scenesById.get(currentSceneId) : null;

  return (
    <div className="fixed inset-0 z-[9999] w-screen h-[100dvh] flex flex-col bg-black overflow-hidden font-sans group virtual-tour-shell">
<style>{`
  .virtual-tour-shell .psv-loader-container,
  .virtual-tour-shell .psv-loader {
    display: none !important;
  }


.virtual-tour-shell .psv-virtual-tour-link {
  filter: none !important;
  overflow: visible !important;
}

.virtual-tour-shell .aura360-floor-link {
  cursor: pointer;
  overflow: visible !important;
  -webkit-tap-highlight-color: transparent;
}

/*
 * Canvas fiks.
 * Photo Sphere Viewer kontrollon VETËM pozicionin e këtij elementi.
 * Ne nuk i vendosim ASNJË transform.
 */
.virtual-tour-shell .aura360-navigation-hotspot {
  width: 180px;
  height: 108px;

  position: relative;
  display: block;

  --aura-hotspot-width: 112px;
  --aura-hotspot-height: 66px;

  pointer-events: none;
}

/*
 * Vetëm vizuali ndryshon madhësi.
 * Nuk përdorim scale(), rotate(), skew() apo perspective.
 */
.virtual-tour-shell .aura360-navigation-hotspot__visual {
  position: absolute;

  left: 50%;
  top: 50%;

  width: var(--aura-hotspot-width);
  height: var(--aura-hotspot-height);

  transform: translate(-50%, -50%);

  transform-origin: center center;

  pointer-events: auto;
  outline: none;
  border-radius: 50%;
  cursor: pointer;

  transition:
    width 80ms linear,
    height 80ms linear,
    filter 140ms ease;

  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

/*
 * SVG ruan stilin e unazës; lartësia përshtatet me perspektivën e dyshemesë.
 */
.virtual-tour-shell
.aura360-navigation-hotspot__visual svg {
  display: block;

  width: 100%;
  height: 100%;

  overflow: visible;

  transform: none !important;
  rotate: 0deg !important;
}

/* A forgiving touch target without enlarging the visible distant ring. */
.virtual-tour-shell .aura360-navigation-hotspot__visual::before {
  content: "";
  position: absolute;
  left: 50%; top: 50%;
  width: max(100%, 32px); height: max(100%, 28px);
  transform: translate(-50%, -50%);
  border-radius: 50%;
}
.virtual-tour-shell .aura360-navigation-hotspot__visual:focus-visible {
  outline: 2px solid rgba(255,255,255,0.95);
  outline-offset: 5px;
}

/* Matterport-like normal */
.virtual-tour-shell .aura360-hotspot-ring {
  fill: rgba(255, 255, 255, 0.30);

  transition:
    fill 140ms ease,
    opacity 140ms ease;
}

/* Hover */
.virtual-tour-shell
.aura360-navigation-hotspot__visual:hover
.aura360-hotspot-ring,
.virtual-tour-shell .aura360-navigation-hotspot__visual:focus-visible .aura360-hotspot-ring {
  fill: rgba(255, 255, 255, 0.42);
}

/* Click/touch */
.virtual-tour-shell
.aura360-navigation-hotspot__visual:active
.aura360-hotspot-ring {
  fill: rgba(255, 255, 255, 0.62);
}






  @keyframes virtual-tour-loader-enter {
    from {
      opacity: 0;
      transform: translateY(10px) scale(0.985);
    }

    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @keyframes virtual-tour-loader-orbit {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes virtual-tour-loader-progress {
    0% {
      opacity: 0;
      transform: translateX(-165%);
    }

    18% {
      opacity: 0.95;
    }

    78% {
      opacity: 0.95;
    }

    100% {
      opacity: 0;
      transform: translateX(335%);
    }
  }

  @keyframes virtual-tour-loader-glow {
    0%,
    100% {
      opacity: 0.35;
      transform: scale(0.92);
    }

    50% {
      opacity: 0.7;
      transform: scale(1.08);
    }
  }

  .virtual-tour-shell .virtual-tour-loader__content {
    animation:
      virtual-tour-loader-enter
      560ms
      cubic-bezier(0.22, 1, 0.36, 1)
      both;
  }

  .virtual-tour-shell .virtual-tour-loader__orbit {
    border: 1.5px solid transparent;
    border-top-color: rgba(212, 175, 55, 0.98);
    border-right-color: rgba(212, 175, 55, 0.28);
    animation: virtual-tour-loader-orbit 2.35s linear infinite;
    will-change: transform;
  }

  .virtual-tour-shell .virtual-tour-loader__progress {
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(212, 175, 55, 0.35) 20%,
      rgba(212, 175, 55, 1) 50%,
      rgba(255, 255, 255, 0.72) 66%,
      transparent 100%
    );
    animation:
      virtual-tour-loader-progress
      1.85s
      cubic-bezier(0.45, 0, 0.2, 1)
      infinite;
    will-change: transform, opacity;
  }

  .virtual-tour-shell .virtual-tour-loader__glow {
    animation: virtual-tour-loader-glow 2.7s ease-in-out infinite;
    will-change: transform, opacity;
  }

  @media (prefers-reduced-motion: reduce) {
    .virtual-tour-shell .aura360-navigation-hotspot__visual {
      transition: none;
    }
    .virtual-tour-shell .virtual-tour-loader__content,
    .virtual-tour-shell .virtual-tour-loader__orbit,
    .virtual-tour-shell .virtual-tour-loader__progress,
    .virtual-tour-shell .virtual-tour-loader__glow {
      animation: none !important;
    }

    .virtual-tour-shell .virtual-tour-loader__progress {
      width: 100% !important;
      opacity: 0.55;
    }
  }
  

  
`}</style>

{onClose && (
<button
  onPointerDown={(event) => {
    event.stopPropagation();
  }}
  onPointerUp={(event) => {
    event.stopPropagation();
  }}
  onClick={(event) => {
    event.preventDefault();
    event.stopPropagation();
    handleCloseTour();
  }}
  className="absolute z-[99999] w-12 h-12 bg-black/70 active:bg-black text-white rounded-full flex items-center justify-center md:backdrop-blur-md border border-white/10 shadow-lg pointer-events-auto"
  style={{
    top: "max(12px, env(safe-area-inset-top))",
    right: "max(12px, env(safe-area-inset-right))",
    touchAction: "manipulation",
    WebkitTapHighlightColor: "transparent",
  }}
  aria-label="Mbyll turin virtual"
  type="button"
>
  <X size={22} />
</button>
)}

      <div className="relative w-full h-full flex-1 overflow-hidden">
       
	   
	   <div
  ref={containerRef}
  className="w-full h-full bg-black"
  style={{
    opacity: isViewerVisible ? 1 : 0,
    transition: "opacity 360ms cubic-bezier(0.22, 1, 0.36, 1)",
  }}
/>

{isInitialLoading && (
  <div
    className="absolute inset-0 z-30 overflow-hidden bg-[#050505]"
    style={{
      opacity: isViewerVisible ? 0 : 1,
      transform: isViewerVisible ? "scale(1.01)" : "scale(1)",
      transition:
        "opacity 340ms cubic-bezier(0.22, 1, 0.36, 1), transform 500ms cubic-bezier(0.22, 1, 0.36, 1)",
      pointerEvents: isViewerVisible ? "none" : "auto",
    }}
    role="status"
    aria-live="polite"
    aria-busy={!isViewerVisible}
  >
    {/* Përdor vetëm thumbnail-in që të mos ngadalësohet panorama kryesore */}
    {resolvedStartScene?.thumbnailUrl && (
      <div
        className="absolute inset-[-18px] scale-[1.04] bg-cover bg-center opacity-75 blur-[10px]"
        style={{
          backgroundImage: `url(${resolvedStartScene.thumbnailUrl})`,
        }}
      />
    )}

    {/* Overlay i pastër dhe premium */}
    <div className="absolute inset-0 bg-black/50" />

    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/45" />

    <div
      className="relative z-10 flex h-full items-center justify-center px-6"
      style={{
        paddingTop: "max(24px, env(safe-area-inset-top))",
        paddingBottom: "max(24px, env(safe-area-inset-bottom))",
      }}
    >
      <div className="virtual-tour-loader__content flex flex-col items-center text-center">
        {/* Simbol i vogël dhe minimalist */}


        <h2 className="font-display text-lg font-medium tracking-[-0.01em] text-white md:text-xl">
          Duke hapur turin 360°
        </h2>

        {/* Shfaqet vetëm kur ngarkimi zgjat më shumë */}
        {showFirstLoadHint && (
          <p className="mt-3 max-w-[270px] text-[11px] leading-5 text-white/50">
            Hapja e parë mund të zgjasë pak. Pamjet e radhës do të
            hapen më shpejt.
          </p>
        )}

        <div className="mx-auto mt-5 h-px w-36 overflow-hidden bg-white/15">
          <div className="virtual-tour-loader__progress h-full w-[42%]" />
        </div>

        <span className="sr-only">
          Po përgatitet pamja e parë e turit virtual.
        </span>
      </div>
    </div>
  </div>
)}
	   

        {loadError && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 max-w-[90vw] rounded-2xl border border-white/10 bg-black/80 px-4 py-3 text-xs text-white shadow-2xl md:backdrop-blur-xl">
            {loadError}
          </div>
        )}

        <div className="absolute top-6 left-6 z-40 pointer-events-none max-w-[80%]">
          <div className="px-4 py-2 rounded-2xl bg-gradient-to-br from-black/55 to-black/30 md:backdrop-blur-xl border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.45)]">
            <h2 className="text-white/95 text-xs md:text-sm font-semibold tracking-wide">
              {currentScene?.title || "Pamja 360°"}
            </h2>
          </div>
        </div>
		
		
		{showAura360Branding && isViewerVisible && (
  <div
    className="absolute left-4 z-40 pointer-events-none select-none"
    style={{
      bottom:
        "calc(4.75rem + max(12px, env(safe-area-inset-bottom)))",
    }}
    aria-hidden="true"
  >
<div className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-black/30 px-2.5 py-1 shadow-md md:backdrop-blur-md">
  <span className="text-[8px] md:text-[9px] font-medium tracking-wide text-white/45">
    Powered by
  </span>

  <span className="text-[9px] md:text-[10px] font-semibold tracking-[0.08em] text-primary/85">
    Aura360
  </span>
</div>
  </div>
)}
		

        <div className="absolute bottom-24 right-6 z-40 hidden lg:flex flex-col gap-3">
          {hasMap && (
            <button
              onClick={() => setShowMap((value) => !value)}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors md:backdrop-blur-md border border-white/10 shadow-lg ${
                showMap ? "bg-primary text-black" : "bg-black/55 text-white hover:bg-black/75"
              }`}
              title="Plani i katit"
              type="button"
            >
              <MapIcon size={20} />
            </button>
          )}

          {canUseFullscreen && isDesktop && (
            <button
              onClick={toggleFullscreen}
              className="w-12 h-12 rounded-full bg-black/55 text-white hover:bg-black/75 flex items-center justify-center transition-colors md:backdrop-blur-md border border-white/10 shadow-lg"
              title={isFullscreen ? "Dil nga fullscreen" : "Hap fullscreen"}
              type="button"
            >
              {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
          )}
        </div>

        {hasMap && (
          <div
            className={`absolute bottom-24 right-20 z-40 w-64 h-48 bg-black/80 md:backdrop-blur-xl border border-white/10 rounded-2xl p-4 transition-all duration-300 transform origin-bottom-right ${
              showMap ? "scale-100 opacity-100" : "scale-90 opacity-0 pointer-events-none"
            }`}
          >
            <div
              className="w-full h-full relative border border-white/5 rounded-xl overflow-hidden bg-white/5"
              style={{
                backgroundImage:
                  "radial-gradient(rgba(255,255,255,0.1) 1px, transparent 1px)",
                backgroundSize: "10px 10px",
              }}
            >
              {sortedScenes
                .filter((scene) => scene.positionX != null && scene.positionY != null)
                .map((scene) => (
                  <button
                    key={scene.id}
                    onMouseEnter={() => handleSceneIntent(scene.id)}
                    onFocus={() => handleSceneIntent(scene.id)}
                    onTouchStart={() => handleSceneIntent(scene.id)}
                    onPointerDown={() => handleSceneIntent(scene.id)}
                    onClick={() => void handleSceneChange(scene.id)}
                    className={`absolute w-4 h-4 -ml-2 -mt-2 rounded-full border-2 transition-all ${
                      currentSceneId === scene.id
                        ? "bg-primary border-white scale-125 z-10"
                        : "bg-white border-transparent hover:scale-110"
                    }`}
                    style={{ left: `${scene.positionX}%`, top: `${scene.positionY}%` }}
                    title={scene.title}
                    type="button"
                  />
                ))}
            </div>
          </div>
        )}

<div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/95 via-black/65 to-transparent flex items-end justify-center pb-4 px-4 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
  <div className="flex gap-2 overflow-x-auto max-w-full pb-2 hide-scrollbar">
           {sortedScenes.map((scene) => (
              <button
                key={scene.id}
                ref={(element) => {
                  sceneButtonRefs.current[scene.id] = element;
                }}
                onMouseEnter={() => handleSceneIntent(scene.id)}
                onFocus={() => handleSceneIntent(scene.id)}
                onTouchStart={() => handleSceneIntent(scene.id)}
                onPointerDown={() => handleSceneIntent(scene.id)}
                onClick={() => void handleSceneChange(scene.id)}
className={`relative shrink-0 w-20 h-12 overflow-hidden rounded-xl border transition-all duration-200 ${
  currentSceneId === scene.id
    ? "border-primary opacity-100 shadow-[0_0_0_1px_rgba(212,175,55,0.28)]"
    : "border-white/10 opacity-60 hover:border-white/25 hover:opacity-100"
}`}
                type="button"
              >
                <img
  src={
    scene.thumbnailUrl?.trim() ||
    TOUR_THUMBNAIL_PLACEHOLDER
  }
  alt={scene.title}
  loading="lazy"
  decoding="async"
  fetchPriority={
    currentSceneId === scene.id ? "high" : "low"
  }
  onError={(event) => {
    const image = event.currentTarget;

    if (
      !image.src.endsWith(
        TOUR_THUMBNAIL_PLACEHOLDER,
      )
    ) {
      image.src = TOUR_THUMBNAIL_PLACEHOLDER;
    }
  }}
  className="w-full h-full object-cover"
/>
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent flex items-end p-1.5">
                  <span className="text-[10px] text-white font-semibold truncate drop-shadow-md">
                    {scene.title}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default VirtualTour360;

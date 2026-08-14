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
  speed: 240,
  rotation: false,
};

type NavigationTransitionOptions = typeof NAVIGATION_TRANSITION & {
  rotateTo?: Orientation;
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

const psvPreloadPromisesRef = useRef<Map<string, Promise<void>>>(
  new Map(),
);

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
              yaw: visualPosition?.yaw ?? hotspot.yaw,
              pitch: visualPosition?.pitch ?? hotspot.pitch,
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
              displayYaw: visualPosition?.yaw ?? hotspot.yaw,
              displayPitch: visualPosition?.pitch ?? hotspot.pitch,
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

      const reverseHotspot = targetScene.hotspots.find(
        (hotspot) => getRuntimeHotspotTargetSceneId(hotspot as RuntimeHotspot) === Number(sourceId),
      );

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
      const sourceSceneId = toFiniteNumber(link?.data?.fromSceneId);
      const reverseOrientation = link
        ? getReverseHotspotEntryOrientation(targetSceneId, sourceSceneId)
        : null;

      if (reverseOrientation) return reverseOrientation;

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
  (
    sceneId: number | null,
    priority: PreloadPriority = "low",
  ): Promise<void> => {
    if (sceneId === null) {
      return Promise.resolve();
    }

    const scene = getSceneById(sceneId);

    if (!scene?.imageUrl) {
      return Promise.resolve();
    }

    const viewer = viewerRef.current as any;
    const src = scene.imageUrl;

    /*
     * Photo Sphere Viewer e ruan Blob-in duke përdorur URL-në
     * e panoramës si cache key.
     *
     * Nëse fotografia është tashmë në cache, nuk bëjmë:
     * - request të dytë;
     * - decode të dytë;
     * - punë të panevojshme në GPU.
     */
    if (Cache.get(src, src)) {
      return Promise.resolve();
    }

    const existingPromise =
      psvPreloadPromisesRef.current.get(src);

    if (existingPromise) {
      return existingPromise;
    }

    let task: Promise<unknown>;

    if (viewer?.textureLoader?.loadFile) {
      /*
       * Preload vetëm skedarin Blob.
       *
       * Mos përdor preloadPanorama për çdo hotspot,
       * sepse ai vazhdon edhe me dekodimin dhe krijimin
       * e texture-it, gjë që rëndon telefonin kur kemi
       * shumë lidhje.
       */
      task = Promise.resolve(
        viewer.textureLoader.loadFile(
          src,
          undefined,
          src,
        ),
      );
    } else if (viewer?.textureLoader?.preloadPanorama) {
      /*
       * Fallback për versione ku loadFile nuk është
       * i ekspozuar.
       */
      task = Promise.resolve(
        viewer.textureLoader.preloadPanorama(src),
      );
    } else {
      return preloadBrowserImageOnce(src, priority);
    }

    const promise = task
      .then(() => undefined)
      .catch((error) => {
        console.warn(
          "Panorama preload failed:",
          error,
        );
      })
      .finally(() => {
        /*
         * Në këtë Map mbajmë vetëm request-et aktive.
         * Pas përfundimit, Cache është burimi real
         * i informacionit.
         */
        psvPreloadPromisesRef.current.delete(src);
      });

    psvPreloadPromisesRef.current.set(src, promise);

    return promise;
  },
  [getSceneById, preloadBrowserImageOnce],
);

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

    if (sceneId === null) {
      return;
    }

    const plan = getPreloadPlan();

    const orderedTargetIds =
      getPrioritizedLinkedSceneIds(sceneId).slice(
        0,
        plan.total,
      );

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
      const transition: NavigationTransitionOptions = { ...NAVIGATION_TRANSITION };

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

      isNavigatingRef.current = true;
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
      } finally {
        isNavigatingRef.current = false;
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

    const cleanups = [
      addPreconnectHint(resolvedStartScene.imageUrl),
      addResourceHint(resolvedStartScene.thumbnailUrl, {
        rel: "preload",
        as: "image",
        priority: "high",
      }),
      addResourceHint(resolvedStartScene.imageUrl, {
        rel: "preload",
        as: "image",
        priority: "high",
      }),
    ];

    void preloadBrowserImageOnce(resolvedStartScene.thumbnailUrl, "high");
    void preloadBrowserImageOnce(resolvedStartScene.imageUrl, "high");

    const firstNeighborId = linkedSceneIdsBySceneId.get(Number(resolvedStartScene.id))?.[0];
    const firstNeighbor = firstNeighborId ? scenesById.get(firstNeighborId) : null;

    if (firstNeighbor?.imageUrl) {
      cleanups.push(
        addResourceHint(firstNeighbor.imageUrl, {
          rel: "prefetch",
          as: "image",
          priority: "low",
        }),
      );
    }

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [
    resolvedStartScene,
    preloadBrowserImageOnce,
    linkedSceneIdsBySceneId,
    scenesById,
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
      maxFov: deviceProfile.isMobile ? 108 : 100,
      minFov: 28,
      defaultZoomLvl: deviceProfile.isMobile ? 32 : 38,
      zoomSpeed: 1.05,
      moveSpeed: 1,
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
            renderMode: "3d",
            startNodeId: String(resolvedStartScene.id),
            nodes,
            preload: shouldPluginPreloadLink,
            transitionOptions: getPluginTransitionOptions,
            showLinkTooltip: true,
            arrowStyle: {
              size: { width: 72, height: 72 },
            },
            arrowsPosition: {
              minPitch: 0.2,
              maxPitch: Math.PI / 2,
              linkOverlapAngle: Math.PI / 5,
              linkPitchOffset: -0.08,
            },
          },
        ],
      ],
    });

viewerRef.current = viewer;

const vtPlugin = viewer.getPlugin(
  VirtualTourPlugin as any,
) as any;

const originalSetCurrentNode =
  vtPlugin.setCurrentNode.bind(vtPlugin);

/*
 * Kur përdoruesi klikon hotspot-in gjatë kohës që
 * fotografia e tij është duke u prefetch-uar, navigimi
 * pret të njëjtin request.
 *
 * Në këtë mënyrë nuk hapet një request i dytë për të
 * njëjtën panoramë.
 */
vtPlugin.setCurrentNode = async (
  nodeId: string,
  options?: any,
  fromLink?: any,
): Promise<boolean> => {
  const targetSceneId = toFiniteNumber(nodeId);

  const targetScene =
    targetSceneId !== null
      ? getSceneById(targetSceneId)
      : null;

  const pendingPreload = targetScene?.imageUrl
    ? psvPreloadPromisesRef.current.get(
        targetScene.imageUrl,
      )
    : null;

  if (pendingPreload) {
    await pendingPreload;
  }

  return originalSetCurrentNode(
    nodeId,
    options,
    fromLink,
  );
};

viewer.addEventListener("panorama-loaded", () => {
	
      setLoadError(null);
      const currentScene = currentSceneRef.current || resolvedStartScene;
      if (currentScene?.imageUrl) {
        psvReadyPanoramasRef.current.add(currentScene.imageUrl);
      }

      finishInitialLoad();
    });

    viewer.addEventListener("panorama-error", (error: any) => {
      console.error("Panorama error:", error);
      setLoadError("Panorama nuk u ngarkua si duhet.");
      finishInitialLoad();
    });

let positionWarmupTimer: number | null = null;

const schedulePositionAwareWarmup = () => {
  if (positionWarmupTimer !== null) {
    window.clearTimeout(positionWarmupTimer);
  }

  positionWarmupTimer = window.setTimeout(() => {
    positionWarmupTimer = null;

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

    if (Number.isFinite(targetSceneId)) {
      void preloadScenePanoramaOnce(
        targetSceneId,
        "high",
      );
    }
  },
);

vtPlugin.addEventListener(
  "node-changed",
  ({ node }: any) => {
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
  warmSceneNeighborhood(nextId);
});
});

return () => {
  clearFirstLoadHintTimer();
  clearLoaderExitTimer();
if (positionWarmupTimer !== null) {
  window.clearTimeout(positionWarmupTimer);
}

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
    getPluginTransitionOptions,
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
    filter: drop-shadow(0 16px 20px rgba(0, 0, 0, 0.45));
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

      <button
        onPointerUp={(event) => {
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
                    onMouseEnter={() => void preloadScenePanoramaOnce(scene.id, "high")}
                    onFocus={() => void preloadScenePanoramaOnce(scene.id, "high")}
                    onTouchStart={() => void preloadScenePanoramaOnce(scene.id, "high")}
                    onPointerDown={() => void preloadScenePanoramaOnce(scene.id, "high")}
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
                onMouseEnter={() => void preloadScenePanoramaOnce(scene.id, "high")}
                onFocus={() => void preloadScenePanoramaOnce(scene.id, "high")}
                onTouchStart={() => void preloadScenePanoramaOnce(scene.id, "high")}
                onPointerDown={() => void preloadScenePanoramaOnce(scene.id, "high")}
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

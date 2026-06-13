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
const TOUR_THUMBNAIL_PLACEHOLDER = "/tour-placeholder.webp";

const CACHE_TTL_SECONDS = 30 * 60;
const NAVIGATION_TRANSITION = {
  showLoader: false,
  effect: "fade" as const,
  speed: 180,
  rotation: false,
};

const LOADER_DELAY_MS = 120;

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
  if (profile.isMobile) return 6;
  return 14;
};

const getPreloadBudget = () => {
  const profile = getDeviceProfile();

  if (profile.isSlowConnection) {
    return { direct: 0, secondLevel: 0 };
  }

  if (profile.isLowMemory) {
    return { direct: 1, secondLevel: 0 };
  }

  if (profile.isMobile) {
    return { direct: 2, secondLevel: 0 };
  }

  return { direct: 5, secondLevel: 6 };
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

const shouldPluginPreloadLink = (node: any, link: any) => {
  const budget = getPreloadBudget();
  if (budget.direct <= 0) return false;

  const links = Array.isArray(node?.links) ? node.links : [];
  const directTargets = uniqueNumbers(
    links
      .map((item: any) => Number(item?.nodeId))
      .filter((id: number) => Number.isFinite(id)),
  ).slice(0, budget.direct);

  return directTargets.includes(Number(link?.nodeId));
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
  const browserPreloadPromisesRef = useRef<Map<string, Promise<void>>>(new Map());
  const psvPreloadPromisesRef = useRef<Map<string, Promise<void>>>(new Map());
  const psvReadyPanoramasRef = useRef<Set<string>>(new Set());
  const cleanupTasksRef = useRef<Array<() => void>>([]);
  const loaderTimerRef = useRef<number | null>(null);
  const orientationTimeoutsRef = useRef<number[]>([]);
  const orientationAnimationFramesRef = useRef<number[]>([]);
  const activeEntryOrientationRef = useRef<Orientation | null>(null);
  const lastPointerSpherePositionRef = useRef<
    (Orientation & { timestamp: number }) | null
  >(null);
  const lastHoveredLinkRef = useRef<{
    sourceSceneId: number | null;
    targetSceneId: number | null;
    link: any;
    timestamp: number;
  } | null>(null);

  const [currentSceneId, setCurrentSceneId] = useState<number | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isViewerVisible, setIsViewerVisible] = useState(false);
  const [isSceneLoading, setIsSceneLoading] = useState(false);
  const [loadingSceneTitle, setLoadingSceneTitle] = useState<string | null>(null);
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
        thumbnail: scene.thumbnailUrl || TOUR_THUMBNAIL_PLACEHOLDER,
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

  const getCurrentViewerOrientation = useCallback((): Orientation | null => {
    const viewer = viewerRef.current as any;
    if (!viewer?.getPosition) return null;

    try {
      const position = viewer.getPosition();
      if (!position) return null;

      const yaw = toFiniteNumber(position.yaw);
      const pitch = toFiniteNumber(position.pitch);

      if (yaw === null || pitch === null) return null;

      return { yaw: normalizeYaw(yaw), pitch: clampPitch(pitch) };
    } catch (error) {
      console.error("Viewer position read error:", error);
      return null;
    }
  }, []);

  const getPointerSphericalPosition = useCallback((event: PointerEvent): Orientation | null => {
    const viewer = viewerRef.current as any;
    const container = containerRef.current;

    if (!viewer?.dataHelper?.viewerCoordsToSphericalCoords || !container) {
      return getCurrentViewerOrientation();
    }

    try {
      const rect = container.getBoundingClientRect();
      const position = viewer.dataHelper.viewerCoordsToSphericalCoords({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });

      const yaw = toFiniteNumber(position?.yaw);
      const pitch = toFiniteNumber(position?.pitch);

      if (yaw === null || pitch === null) return getCurrentViewerOrientation();

      return { yaw: normalizeYaw(yaw), pitch: clampPitch(pitch) };
    } catch (error) {
      console.error("Pointer spherical position error:", error);
      return getCurrentViewerOrientation();
    }
  }, [getCurrentViewerOrientation]);

  const getLinkComparisonPosition = useCallback((link: any): Orientation | null => {
    const yaw = toFiniteNumber(
      link?.data?.displayYaw ?? link?.position?.yaw ?? link?.data?.rawYaw,
    );
    const pitch = toFiniteNumber(
      link?.data?.displayPitch ?? link?.position?.pitch ?? link?.data?.rawPitch,
    );

    if (yaw === null || pitch === null) return null;

    return { yaw: normalizeYaw(yaw), pitch: clampPitch(pitch) };
  }, []);

  const getOrientationDistance = useCallback((a: Orientation, b: Orientation) => {
    const yawDelta = Math.abs(normalizeYaw(a.yaw - b.yaw));
    const pitchDelta = Math.abs(a.pitch - b.pitch);

    return Math.sqrt(yawDelta * yawDelta + pitchDelta * pitchDelta);
  }, []);

  const findClosestLinkToPosition = useCallback(
    (links: any[], position: Orientation | null) => {
      if (!links.length) return null;
      if (!position) return links[0];

      return links.reduce((best, link) => {
        const linkPosition = getLinkComparisonPosition(link);
        if (!linkPosition) return best;

        const distance = getOrientationDistance(position, linkPosition);
        if (!best) return { link, distance };

        return distance < best.distance ? { link, distance } : best;
      }, null as { link: any; distance: number } | null)?.link ?? links[0];
    },
    [getLinkComparisonPosition, getOrientationDistance],
  );

  const findBestNavigationLink = useCallback(
    (targetSceneId: number, fromNode?: any | null, fromLink?: any | null): any | null => {
      if (fromLink && String(fromLink.nodeId) === String(targetSceneId)) {
        return fromLink;
      }

      const sourceSceneId = toFiniteNumber(fromNode?.id);
      const links = Array.isArray(fromNode?.links) ? fromNode.links : [];
      const candidates = links.filter(
        (link: any) => String(link?.nodeId) === String(targetSceneId),
      );

      if (candidates.length === 0) return null;
      if (candidates.length === 1) return candidates[0];

      const now = Date.now();
      const hovered = lastHoveredLinkRef.current;

      if (
        hovered &&
        now - hovered.timestamp < 2500 &&
        String(hovered.targetSceneId) === String(targetSceneId) &&
        (sourceSceneId === null || String(hovered.sourceSceneId) === String(sourceSceneId))
      ) {
        return hovered.link;
      }

      const pointerPosition = lastPointerSpherePositionRef.current;
      if (pointerPosition && now - pointerPosition.timestamp < 2500) {
        return findClosestLinkToPosition(candidates, pointerPosition);
      }

      return findClosestLinkToPosition(candidates, getCurrentViewerOrientation());
    },
    [findClosestLinkToPosition, getCurrentViewerOrientation],
  );

  const getTransitionOptionsForOrientation = useCallback((orientation: Orientation | null) => {
    const options: any = { ...NAVIGATION_TRANSITION };

    if (isFiniteOrientation(orientation)) {
      options.rotateTo = {
        yaw: normalizeYaw(orientation.yaw),
        pitch: clampPitch(orientation.pitch),
      };
    }

    return options;
  }, []);

  const clearLoaderTimer = useCallback(() => {
    if (loaderTimerRef.current !== null && typeof window !== "undefined") {
      window.clearTimeout(loaderTimerRef.current);
      loaderTimerRef.current = null;
    }
  }, []);

  const showNavigationLoader = useCallback(
    (title: string) => {
      if (typeof window === "undefined") return;

      clearLoaderTimer();
      setLoadingSceneTitle(title);

      loaderTimerRef.current = window.setTimeout(() => {
        setIsSceneLoading(true);
      }, LOADER_DELAY_MS);
    },
    [clearLoaderTimer],
  );

  const hideNavigationLoader = useCallback(() => {
    clearLoaderTimer();
    setIsSceneLoading(false);
    setLoadingSceneTitle(null);
  }, [clearLoaderTimer]);

  const preloadBrowserImageOnce = useCallback(
    (src?: string | null, priority: PreloadPriority = "low"): Promise<void> => {
      if (!src) return Promise.resolve();

      const existingPromise = browserPreloadPromisesRef.current.get(src);
      if (existingPromise) return existingPromise;

      const promise = preloadBrowserImage(src, priority);
      browserPreloadPromisesRef.current.set(src, promise);

      return promise;
    },
    [],
  );

  const preloadScenePanoramaOnce = useCallback(
    (sceneId: number | null, priority: PreloadPriority = "low"): Promise<void> => {
      if (sceneId === null) return Promise.resolve();

      const scene = getSceneById(sceneId);
      if (!scene?.imageUrl) return Promise.resolve();

      const viewer = viewerRef.current as any;
      const src = scene.imageUrl;

      if (viewer?.textureLoader?.preloadPanorama) {
        const existingPromise = psvPreloadPromisesRef.current.get(src);
        if (existingPromise) return existingPromise;

        const promise = Promise.resolve(viewer.textureLoader.preloadPanorama(src))
          .then(() => {
            psvReadyPanoramasRef.current.add(src);
          })
          .catch((error) => {
            psvPreloadPromisesRef.current.delete(src);
            console.warn("Panorama preload failed:", error);
          });

        psvPreloadPromisesRef.current.set(src, promise);
        return promise;
      }

      return preloadBrowserImageOnce(src, priority);
    },
    [getSceneById, preloadBrowserImageOnce],
  );

  const warmSceneNeighborhood = useCallback(
    (sceneId: number | null) => {
      if (sceneId === null) return;

      const budget = getPreloadBudget();
      if (budget.direct <= 0) return;

      const directTargetIds = (linkedSceneIdsBySceneId.get(Number(sceneId)) || []).slice(
        0,
        budget.direct,
      );

      directTargetIds.forEach((targetId) => {
        void preloadScenePanoramaOnce(targetId, "high");
      });

      if (budget.secondLevel <= 0) return;

      const cancelIdle = scheduleIdleTask(() => {
        const secondLevelIds = uniqueNumbers(
          directTargetIds.flatMap((targetId) => linkedSceneIdsBySceneId.get(targetId) || []),
        )
          .filter((targetId) => targetId !== Number(sceneId))
          .filter((targetId) => !directTargetIds.includes(targetId))
          .slice(0, budget.secondLevel);

        secondLevelIds.forEach((targetId) => {
          void preloadScenePanoramaOnce(targetId, "low");
        });
      }, 700);

      cleanupTasksRef.current.push(cancelIdle);
    },
    [linkedSceneIdsBySceneId, preloadScenePanoramaOnce],
  );

  const clearOrientationApplyTimers = useCallback(() => {
    if (typeof window === "undefined") return;

    orientationTimeoutsRef.current.forEach((timerId) => {
      window.clearTimeout(timerId);
    });
    orientationTimeoutsRef.current = [];

    orientationAnimationFramesRef.current.forEach((frameId) => {
      window.cancelAnimationFrame(frameId);
    });
    orientationAnimationFramesRef.current = [];
  }, []);

  const applyManualSceneOrientation = useCallback((orientation: Orientation | null) => {
    const viewerAtSchedule = viewerRef.current;
    if (!viewerAtSchedule || !isFiniteOrientation(orientation)) return;

    clearOrientationApplyTimers();

    const yaw = normalizeYaw(orientation.yaw);
    const pitch = clampPitch(orientation.pitch);

    const rotateNow = () => {
      const viewer = viewerRef.current;
      if (!viewer || viewer !== viewerAtSchedule) return;

      try {
        viewer.rotate({ yaw, pitch });
      } catch (error) {
        console.error("Entry orientation apply error:", error);
      }
    };

    rotateNow();

    if (typeof window === "undefined") return;

    const firstFrame = window.requestAnimationFrame(() => {
      rotateNow();

      const secondFrame = window.requestAnimationFrame(rotateNow);
      orientationAnimationFramesRef.current.push(secondFrame);
    });

    orientationAnimationFramesRef.current.push(firstFrame);

    [50, 140, 320, 650].forEach((delay) => {
      const timerId = window.setTimeout(rotateNow, delay);
      orientationTimeoutsRef.current.push(timerId);
    });
  }, [clearOrientationApplyTimers]);

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
      activeEntryOrientationRef.current = entryOrientation;
      showNavigationLoader(targetScene.title);

      try {
        const vtPlugin = viewer.getPlugin(VirtualTourPlugin as any) as any;

        if (!psvReadyPanoramasRef.current.has(targetScene.imageUrl)) {
          await preloadScenePanoramaOnce(targetSceneId, "high");
        }

        await vtPlugin.setCurrentNode(
          String(targetSceneId),
          getTransitionOptionsForOrientation(entryOrientation),
        );
        applyManualSceneOrientation(entryOrientation);
      } catch (error) {
        console.error("Scene change error:", error);
        setLoadError("Skena nuk u hap. Provoni edhe një herë.");
      } finally {
        hideNavigationLoader();
        isNavigatingRef.current = false;
      }
    },
    [
      getSceneById,
      getNavigationEntryOrientation,
      showNavigationLoader,
      preloadScenePanoramaOnce,
      getTransitionOptionsForOrientation,
      applyManualSceneOrientation,
      hideNavigationLoader,
    ],
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
    let firstLoadHintTimer: number | null = window.setTimeout(() => {
      if (!didFinishInitialLoad) setShowFirstLoadHint(true);
    }, FIRST_LOAD_HINT_MS);

    const clearFirstLoadHintTimer = () => {
      if (firstLoadHintTimer !== null) {
        window.clearTimeout(firstLoadHintTimer);
        firstLoadHintTimer = null;
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
        setIsInitialLoading(false);
        setShowFirstLoadHint(false);
        warmSceneNeighborhood(resolvedStartScene.id);
      });
    };

    const viewer = new Viewer({
      container: containerRef.current,
      navbar: ["zoom", "move"],
      adapter: EquirectangularAdapter.withConfig({
        resolution: getViewerResolution(),
        useXmpData: true,
      }),
      defaultYaw: initialOrientation?.yaw ?? 0,
      defaultPitch: initialOrientation?.pitch ?? 0,
      defaultTransition: NAVIGATION_TRANSITION,
      maxFov: getDeviceProfile().isMobile ? 105 : 100,
      minFov: 28,
      defaultZoomLvl: getDeviceProfile().isMobile ? 34 : 38,
      zoomSpeed: 1.05,
      moveSpeed: 1,
      moveInertia: 0.82,
      mousewheelCtrlKey: false,
      touchmoveTwoFingers: false,
      rendererParameters: {
        alpha: false,
        antialias: true,
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
            transitionOptions: (node: any, fromNode: any, fromLink: any) => {
              const targetSceneId = toFiniteNumber(node?.id);

              if (targetSceneId === null) {
                return NAVIGATION_TRANSITION;
              }

              const navigationLink = findBestNavigationLink(
                targetSceneId,
                fromNode,
                fromLink,
              );
              const entryOrientation = getNavigationEntryOrientation(
                targetSceneId,
                navigationLink,
              );

              pendingEntryOrientationRef.current = entryOrientation;
              activeEntryOrientationRef.current = entryOrientation;

              if (fromNode) {
                const targetScene = getSceneById(targetSceneId);
                if (targetScene) {
                  setLoadError(null);
                  showNavigationLoader(targetScene.title);
                  void preloadScenePanoramaOnce(targetSceneId, "high");
                }
              }

              return getTransitionOptionsForOrientation(entryOrientation);
            },
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

    const vtPlugin = viewer.getPlugin(VirtualTourPlugin as any) as any;

    viewer.addEventListener("panorama-loaded", () => {
      setLoadError(null);
      const currentScene = currentSceneRef.current || resolvedStartScene;
      if (currentScene?.imageUrl) {
        psvReadyPanoramasRef.current.add(currentScene.imageUrl);
      }

      finishInitialLoad();
      applyManualSceneOrientation(activeEntryOrientationRef.current);
      hideNavigationLoader();
    });

    viewer.addEventListener("panorama-error", (error: any) => {
      console.error("Panorama error:", error);
      setLoadError("Panorama nuk u ngarkua si duhet.");
      finishInitialLoad();
      hideNavigationLoader();
    });

    const capturePointerIntent = (event: PointerEvent) => {
      const pointerPosition = getPointerSphericalPosition(event);

      if (pointerPosition) {
        lastPointerSpherePositionRef.current = {
          ...pointerPosition,
          timestamp: Date.now(),
        };
      }
    };

    containerRef.current.addEventListener("pointerdown", capturePointerIntent, true);

    vtPlugin.addEventListener("enter-arrow", ({ link }: any) => {
      const targetSceneId = toFiniteNumber(link?.nodeId);

      if (targetSceneId !== null) {
        lastHoveredLinkRef.current = {
          sourceSceneId: currentSceneRef.current ? Number(currentSceneRef.current.id) : null,
          targetSceneId,
          link,
          timestamp: Date.now(),
        };

        void preloadScenePanoramaOnce(targetSceneId, "high");
      }
    });

    vtPlugin.addEventListener("node-changed", ({ node }: any) => {
      const nextId = Number(node.id);
      const nextScene = getSceneById(nextId);

      currentSceneRef.current = nextScene;
      setCurrentSceneId(nextId);
      setLoadError(null);

      if (nextScene?.imageUrl) {
        psvReadyPanoramasRef.current.add(nextScene.imageUrl);
      }

      const pending = pendingEntryOrientationRef.current;
      pendingEntryOrientationRef.current = null;
      activeEntryOrientationRef.current = pending;
      applyManualSceneOrientation(pending);
      warmSceneNeighborhood(nextId);
      hideNavigationLoader();
    });

    return () => {
      clearFirstLoadHintTimer();
      clearLoaderTimer();
      clearOrientationApplyTimers();
      cleanupTasksRef.current.forEach((cleanup) => cleanup());
      cleanupTasksRef.current = [];
      containerRef.current?.removeEventListener("pointerdown", capturePointerIntent, true);
      viewer.destroy();
      viewerRef.current = null;
      currentSceneRef.current = null;
      pendingEntryOrientationRef.current = null;
      activeEntryOrientationRef.current = null;
    };
  }, [
    resolvedStartScene,
    nodes,
    getSceneById,
    getSceneStartOrientation,
    getNavigationEntryOrientation,
    findBestNavigationLink,
    getTransitionOptionsForOrientation,
    getPointerSphericalPosition,
    preloadScenePanoramaOnce,
    applyManualSceneOrientation,
    warmSceneNeighborhood,
    showNavigationLoader,
    hideNavigationLoader,
    clearLoaderTimer,
    clearOrientationApplyTimers,
  ]);

  useEffect(() => {
    if (currentSceneId === null) return;
    warmSceneNeighborhood(currentSceneId);
  }, [currentSceneId, warmSceneNeighborhood]);

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
            transition: "opacity 220ms ease",
          }}
        />

        {(isInitialLoading || isSceneLoading) && (
          <div className="absolute inset-0 z-30 flex items-center justify-center overflow-hidden bg-black">
            {isInitialLoading && resolvedStartScene?.thumbnailUrl && (
              <div
                className="absolute inset-0 scale-110 bg-cover bg-center opacity-35 blur-2xl"
                style={{ backgroundImage: `url(${resolvedStartScene.thumbnailUrl})` }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/80 to-black/95" />
            <div className="relative flex w-[min(90vw,360px)] flex-col items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.06] px-6 py-7 text-center shadow-2xl md:backdrop-blur-xl">
              <div className="h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-1/2 animate-pulse rounded-full bg-primary/90" />
              </div>
              <div className="w-12 h-12 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
              <p className="text-white/90 text-sm tracking-wide font-medium">
                {isInitialLoading ? "Duke përgatitur turin virtual" : "Duke hapur skenën"}
              </p>
              <span className="min-h-[32px] text-xs leading-5 text-white/58">
                {isInitialLoading
                  ? showFirstLoadHint
                    ? "Hapja e parë mund të zgjasë pak më shumë. Pamjet pasuese do të hapen më shpejt."
                    : "Po ngarkohet pamja 360° me cilësi të lartë."
                  : loadingSceneTitle || "Ju lutem prisni"}
              </span>
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

        <div className="absolute bottom-24 right-6 z-40 flex flex-col gap-3">
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
                onClick={() => void handleSceneChange(scene.id)}
                className={`relative shrink-0 w-24 h-14 rounded-xl overflow-hidden border-2 transition-all shadow-lg ${
                  currentSceneId === scene.id
                    ? "border-primary opacity-100 scale-[1.03]"
                    : "border-transparent opacity-70 hover:opacity-100"
                }`}
                type="button"
              >
                <img
                  src={scene.thumbnailUrl || TOUR_THUMBNAIL_PLACEHOLDER}
                  alt={scene.title}
                  crossOrigin="anonymous"
                  loading="lazy"
                  decoding="async"
                  fetchPriority={currentSceneId === scene.id ? "high" : "low"}
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

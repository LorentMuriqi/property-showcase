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

const INITIAL_LOADING_FALLBACK_MS = 15000;
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

const uniqueNumbers = (items: number[]) => {
  return items.filter((id, index, arr) => arr.indexOf(id) === index);
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

  const [currentSceneId, setCurrentSceneId] = useState<number | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isViewerVisible, setIsViewerVisible] = useState(false);
  const [isSceneLoading, setIsSceneLoading] = useState(false);
  const [loadingSceneTitle, setLoadingSceneTitle] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
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
          .map((hotspot) => Number(hotspot.toSceneId))
          .filter((id) => scenesById.has(id)),
      );

      map.set(Number(scene.id), validTargetIds);
    });

    return map;
  }, [sortedScenes, scenesById]);

  const nodes = useMemo(() => {
    return sortedScenes.map((scene) => ({
      id: String(scene.id),
      panorama: scene.imageUrl,
      thumbnail: scene.thumbnailUrl || TOUR_THUMBNAIL_PLACEHOLDER,
      name: scene.title,
      caption: scene.title,
      data: {
        initialYaw: scene.initialYaw ?? null,
        initialPitch: scene.initialPitch ?? null,
      },
      links: scene.hotspots
        .filter((hotspot) => scenesById.has(Number(hotspot.toSceneId)))
        .map((hotspot) => ({
          nodeId: String(hotspot.toSceneId),
          position: {
            yaw: hotspot.yaw,
            pitch: hotspot.pitch,
          },
          name: hotspot.label || scenesById.get(Number(hotspot.toSceneId))?.title,
          data: {
            hotspotId: hotspot.id,
            fromSceneId: hotspot.fromSceneId,
            toSceneId: hotspot.toSceneId,
            targetYaw: hotspot.targetYaw ?? null,
            targetPitch: hotspot.targetPitch ?? null,
          },
        })),
    }));
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

  const getNodeById = useCallback(
    (id: string) => nodes.find((node) => node.id === id) || null,
    [nodes],
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

  const getHotspotEntryOrientation = useCallback(
    (targetSceneId: number, link: any | null): Orientation | null => {
      const targetYaw = link?.data?.targetYaw;
      const targetPitch = link?.data?.targetPitch;

      if (
        typeof targetYaw === "number" &&
        typeof targetPitch === "number" &&
        Number.isFinite(targetYaw) &&
        Number.isFinite(targetPitch)
      ) {
        return { yaw: targetYaw, pitch: targetPitch };
      }

      return getSceneStartOrientation(targetSceneId);
    },
    [getSceneStartOrientation],
  );

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

  const updateTargetNodeOrientation = useCallback(
    (vtPlugin: any, targetNodeId: string, orientation: Orientation | null) => {
      const existingNode = getNodeById(targetNodeId);
      if (!existingNode) return;

      vtPlugin.updateNode({
        id: targetNodeId,
        data: {
          ...(existingNode.data || {}),
          initialYaw: isFiniteOrientation(orientation)
            ? orientation.yaw
            : existingNode.data?.initialYaw ?? null,
          initialPitch: isFiniteOrientation(orientation)
            ? orientation.pitch
            : existingNode.data?.initialPitch ?? null,
        },
      });
    },
    [getNodeById],
  );

  const applyManualSceneOrientation = useCallback((orientation: Orientation | null) => {
    const viewer = viewerRef.current;
    if (!viewer || !isFiniteOrientation(orientation)) return;

    requestAnimationFrame(() => {
      viewer.rotate({ yaw: orientation.yaw, pitch: orientation.pitch });
    });
  }, []);

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

      const entryOrientation = forcedOrientation ?? getSceneStartOrientation(targetSceneId);
      pendingEntryOrientationRef.current = entryOrientation;
      showNavigationLoader(targetScene.title);

      try {
        const vtPlugin = viewer.getPlugin(VirtualTourPlugin as any) as any;

        updateTargetNodeOrientation(
          vtPlugin,
          String(targetSceneId),
          entryOrientation,
        );

        if (!psvReadyPanoramasRef.current.has(targetScene.imageUrl)) {
          await preloadScenePanoramaOnce(targetSceneId, "high");
        }

        await vtPlugin.setCurrentNode(String(targetSceneId), NAVIGATION_TRANSITION);
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
      getSceneStartOrientation,
      showNavigationLoader,
      updateTargetNodeOrientation,
      preloadScenePanoramaOnce,
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

    void preloadBrowserImageOnce(resolvedStartScene.imageUrl, "high");
  }, [resolvedStartScene, preloadBrowserImageOnce]);

  useEffect(() => {
    if (!containerRef.current || !resolvedStartScene || nodes.length === 0) return;

    if (viewerRef.current) {
      viewerRef.current.destroy();
      viewerRef.current = null;
    }

    setIsInitialLoading(true);
    setIsViewerVisible(false);
    setLoadError(null);

    const initialOrientation = getSceneStartOrientation(resolvedStartScene.id);
    let didFinishInitialLoad = false;

    const finishInitialLoad = () => {
      if (didFinishInitialLoad) return;
      didFinishInitialLoad = true;

      currentSceneRef.current = resolvedStartScene;
      setCurrentSceneId(resolvedStartScene.id);
      psvReadyPanoramasRef.current.add(resolvedStartScene.imageUrl);

      requestAnimationFrame(() => {
        setIsViewerVisible(true);
        setIsInitialLoading(false);
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
            transitionOptions: () => NAVIGATION_TRANSITION,
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
      const currentScene = currentSceneRef.current || resolvedStartScene;
      if (currentScene?.imageUrl) {
        psvReadyPanoramasRef.current.add(currentScene.imageUrl);
      }

      finishInitialLoad();
      hideNavigationLoader();
    });

    viewer.addEventListener("panorama-error", (error: any) => {
      console.error("Panorama error:", error);
      setLoadError("Panorama nuk u ngarkua si duhet.");
      finishInitialLoad();
      hideNavigationLoader();
    });

    vtPlugin.addEventListener("enter-arrow", ({ link }: any) => {
      const targetSceneId = Number(link?.nodeId);
      if (Number.isFinite(targetSceneId)) {
        void preloadScenePanoramaOnce(targetSceneId, "high");
      }
    });

    vtPlugin.addEventListener("select-link", ({ link }: any) => {
      const targetSceneId = Number(link?.nodeId);
      const targetScene = getSceneById(targetSceneId);
      if (!targetScene) return;

      const entryOrientation = getHotspotEntryOrientation(targetSceneId, link);
      pendingEntryOrientationRef.current = entryOrientation;
      setLoadError(null);
      showNavigationLoader(targetScene.title);

      void preloadScenePanoramaOnce(targetSceneId, "high");

      updateTargetNodeOrientation(
        vtPlugin,
        String(targetSceneId),
        entryOrientation,
      );
    });

    vtPlugin.addEventListener("node-changed", ({ node }: any) => {
      const nextId = Number(node.id);
      const nextScene = getSceneById(nextId);

      currentSceneRef.current = nextScene;
      setCurrentSceneId(nextId);

      if (nextScene?.imageUrl) {
        psvReadyPanoramasRef.current.add(nextScene.imageUrl);
      }

      const pending = pendingEntryOrientationRef.current;
      pendingEntryOrientationRef.current = null;
      applyManualSceneOrientation(pending);
      warmSceneNeighborhood(nextId);
      hideNavigationLoader();
    });

    const fallbackTimer = window.setTimeout(() => {
      if (!didFinishInitialLoad) {
        setLoadError("Ngarkimi po zgjat më shumë se zakonisht. Kontrolloni lidhjen ose madhësinë e panoramës.");
      }
    }, INITIAL_LOADING_FALLBACK_MS);

    return () => {
      window.clearTimeout(fallbackTimer);
      clearLoaderTimer();
      cleanupTasksRef.current.forEach((cleanup) => cleanup());
      cleanupTasksRef.current = [];
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
    getHotspotEntryOrientation,
    updateTargetNodeOrientation,
    preloadScenePanoramaOnce,
    applyManualSceneOrientation,
    warmSceneNeighborhood,
    showNavigationLoader,
    hideNavigationLoader,
    clearLoaderTimer,
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
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/85 md:backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
              <p className="text-white/90 text-sm tracking-wide font-medium">
                {isInitialLoading ? "Duke hapur turin virtual" : "Duke hapur skenën"}
              </p>
              <span className="text-primary text-xs uppercase tracking-[0.2em] font-semibold max-w-[260px] truncate">
                {loadingSceneTitle || "Ju lutem prisni"}
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

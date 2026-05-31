import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Cache,
  Viewer,
  EquirectangularAdapter,
} from "@photo-sphere-viewer/core";
import { VirtualTourPlugin } from "@photo-sphere-viewer/virtual-tour-plugin";
import "@photo-sphere-viewer/core/index.css";
import "@photo-sphere-viewer/virtual-tour-plugin/index.css";
import { Maximize, Minimize, Map as MapIcon, X, Compass } from "lucide-react";

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

const INITIAL_LOADING_FALLBACK_MS = 15000;
const TOUR_THUMBNAIL_PLACEHOLDER = "/tour-placeholder.webp";
const OVERLAY_HIDE_DELAY_MS = 4000;

const getDeviceProfile = () => {
  const width = typeof window !== "undefined" ? window.innerWidth : 1200;
  const memory = typeof navigator !== "undefined"
    ? (navigator as any).deviceMemory || 4
    : 4;
  const connection = typeof navigator !== "undefined"
    ? (navigator as any).connection
    : null;

  const saveData = !!connection?.saveData;
  const effectiveType = connection?.effectiveType || "";

  const isSlowConnection =
    saveData || effectiveType === "slow-2g" || effectiveType === "2g";

  const isLowMemory = memory <= 2;
  const isMobile = width <= 640;

  return {
    width,
    memory,
    isMobile,
    isLowMemory,
    isSlowConnection,
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

  if (profile.isLowMemory || profile.isSlowConnection) {
    return 2;
  }

  if (profile.isMobile) {
    return 3;
  }

  return 8;
};

const getNeighborPreloadLimit = () => {
  const profile = getDeviceProfile();

  if (profile.isSlowConnection) {
    return 0;
  }

  if (profile.isLowMemory) {
    return 1;
  }

  if (profile.isMobile) {
    return 1;
  }

  return 4;
};

const preloadImage = (
  src?: string | null,
  priority: "high" | "low" = "low",
): Promise<void> => {
  if (!src) return Promise.resolve();

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
        if (typeof img.decode === "function") {
          await img.decode();
        }
      } catch {
        // Edhe nëse decode dështon, imazhi mund të jetë i përdorshëm.
      }

      resolve();
    };

    img.onerror = () => {
      resolve();
    };

    img.src = src;
  });
};

const scheduleIdleTask = (callback: () => void, delay = 80) => {
  if (typeof window === "undefined") return;

  const profile = getDeviceProfile();

  if (profile.isMobile) {
    window.setTimeout(callback, delay);
    return;
  }

  const idleCallback = (window as any).requestIdleCallback;

  if (typeof idleCallback === "function") {
    idleCallback(callback, { timeout: 600 });
    return;
  }

  window.setTimeout(callback, delay);
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
  const closeTouchHandledRef = useRef(false);
  const sceneButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const sceneStripScrollRef = useRef<HTMLDivElement>(null);
  const pendingEntryOrientationRef = useRef<Orientation | null>(null);
  const overlayTimerRef = useRef<number | null>(null);

  const [currentSceneId, setCurrentSceneId] = useState<number | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isViewerVisible, setIsViewerVisible] = useState(false);
  const [isOverlayVisible, setIsOverlayVisible] = useState(true);

  const hasMap = scenes.some((s) => s.positionX != null && s.positionY != null);
  const [canUseFullscreen, setCanUseFullscreen] = useState(false);

  const sortedScenes = useMemo(
    () => [...scenes].sort((a, b) => a.sortOrder - b.sortOrder),
    [scenes],
  );

  const currentSceneIndex = useMemo(
    () => sortedScenes.findIndex((s) => s.id === currentSceneId),
    [sortedScenes, currentSceneId],
  );

  const nodes = useMemo(() => {
    return sortedScenes.map((scene) => ({
      id: String(scene.id),
      panorama: scene.imageUrl,
      thumbnail: scene.thumbnailUrl || TOUR_THUMBNAIL_PLACEHOLDER,
      name: scene.title,
      data: {
        initialYaw: scene.initialYaw ?? null,
        initialPitch: scene.initialPitch ?? null,
      },
      links: scene.hotspots.map((hotspot) => ({
        nodeId: String(hotspot.toSceneId),
        position: {
          yaw: hotspot.yaw,
          pitch: hotspot.pitch,
        },
        name: hotspot.label || undefined,
        data: {
          hotspotId: hotspot.id,
          fromSceneId: hotspot.fromSceneId,
          toSceneId: hotspot.toSceneId,
          targetYaw: hotspot.targetYaw ?? null,
          targetPitch: hotspot.targetPitch ?? null,
        },
      })),
    }));
  }, [sortedScenes]);

  const resolvedStartScene = useMemo(() => {
    return (
      sortedScenes.find((s) => s.id === defaultSceneId) ||
      sortedScenes.find((s) => s.isDefault) ||
      sortedScenes[0] ||
      null
    );
  }, [sortedScenes, defaultSceneId]);

  const getSceneById = useCallback(
    (id: number) => sortedScenes.find((scene) => scene.id === id) || null,
    [sortedScenes],
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
        return {
          yaw: scene.initialYaw,
          pitch: scene.initialPitch,
        };
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
        return {
          yaw: targetYaw,
          pitch: targetPitch,
        };
      }

      return getSceneStartOrientation(targetSceneId);
    },
    [getSceneStartOrientation],
  );

  const updateTargetNodeOrientation = useCallback(
    (
      vtPlugin: any,
      targetNodeId: string,
      orientation: Orientation | null,
    ) => {
      const existingNode = getNodeById(targetNodeId);

      if (!existingNode) return;

      vtPlugin.updateNode({
        id: targetNodeId,
        data: {
          ...(existingNode.data || {}),
          initialYaw:
            typeof orientation?.yaw === "number" && Number.isFinite(orientation.yaw)
              ? orientation.yaw
              : existingNode.data?.initialYaw ?? null,
          initialPitch:
            typeof orientation?.pitch === "number" && Number.isFinite(orientation.pitch)
              ? orientation.pitch
              : existingNode.data?.initialPitch ?? null,
        },
      });
    },
    [getNodeById],
  );

  const applyManualSceneOrientation = useCallback((orientation: Orientation | null) => {
    const viewer = viewerRef.current;
    if (!viewer || !orientation) return;

    if (!Number.isFinite(orientation.yaw) || !Number.isFinite(orientation.pitch)) {
      return;
    }

    viewer.rotate({
      yaw: orientation.yaw,
      pitch: orientation.pitch,
    });
  }, []);

  // Overlay auto-hide logic
  const resetOverlayTimer = useCallback(() => {
    setIsOverlayVisible(true);
    if (overlayTimerRef.current) {
      window.clearTimeout(overlayTimerRef.current);
    }
    overlayTimerRef.current = window.setTimeout(() => {
      setIsOverlayVisible(false);
    }, OVERLAY_HIDE_DELAY_MS);
  }, []);

  useEffect(() => {
    resetOverlayTimer();
    return () => {
      if (overlayTimerRef.current) window.clearTimeout(overlayTimerRef.current);
    };
  }, []);

  useEffect(() => {
    Cache.enabled = true;
    Cache.ttl = 30 * 60 * 1000;
    Cache.maxItems = getCacheMaxItems();
  }, []);

  const preloadedImagesRef = useRef<Set<string>>(new Set());
  const preloadPromisesRef = useRef<Map<string, Promise<void>>>(new Map());

  const preloadSceneImageOnce = useCallback(
    (src?: string | null, priority: "high" | "low" = "low"): Promise<void> => {
      if (!src) return Promise.resolve();

      const existingPromise = preloadPromisesRef.current.get(src);
      if (existingPromise) return existingPromise;

      preloadedImagesRef.current.add(src);

      const promise = preloadImage(src, priority);
      preloadPromisesRef.current.set(src, promise);

      return promise;
    },
    [],
  );

  const prepareSceneForNavigation = useCallback(
    (
      sceneId: number | null,
      priority: "high" | "low" = "high",
    ): Promise<void> => {
      if (sceneId === null) return Promise.resolve();

      const scene = sortedScenes.find((s) => Number(s.id) === Number(sceneId));
      if (!scene) return Promise.resolve();

      return preloadSceneImageOnce(scene.imageUrl, priority);
    },
    [sortedScenes, preloadSceneImageOnce],
  );

  const preloadSceneImages = useCallback(
    (sceneId: number | null) => {
      if (sceneId === null) return;

      const scene = sortedScenes.find((s) => s.id === sceneId);
      if (!scene) return;

      const preloadLimit = getNeighborPreloadLimit();
      if (preloadLimit <= 0) return;

      const neighborIds = scene.hotspots
        .map((h) => h.toSceneId)
        .filter((id, index, arr) => arr.indexOf(id) === index);

      const scenesToPreload = sortedScenes
        .filter((s) => neighborIds.includes(s.id))
        .slice(0, preloadLimit);

      scheduleIdleTask(() => {
        scenesToPreload.forEach((targetScene) => {
          preloadSceneImageOnce(targetScene.imageUrl, "low");
        });
      }, 40);
    },
    [sortedScenes, preloadSceneImageOnce],
  );

  const goToScene = useCallback(
    async (targetSceneId: number) => {
      const viewer = viewerRef.current;
      if (!viewer) return;

      const targetScene = getSceneById(targetSceneId);
      if (!targetScene) return;

      if (currentSceneRef.current?.id === targetSceneId) return;

      if (isNavigatingRef.current) return;
      isNavigatingRef.current = true;

      // Safety valve: always release the lock within 3s even if something goes wrong
      const safetyTimer = window.setTimeout(() => {
        isNavigatingRef.current = false;
      }, 3000);

      try {
        const vtPlugin = viewer.getPlugin(VirtualTourPlugin) as any;
        const entryOrientation = getSceneStartOrientation(targetSceneId);

        preloadSceneImageOnce(targetScene.imageUrl, "high");

        updateTargetNodeOrientation(
          vtPlugin,
          String(targetSceneId),
          entryOrientation,
        );

        await vtPlugin.setCurrentNode(String(targetSceneId), {
          showLoader: false,
          effect: "fade",
          speed: 120,
          rotation: false,
        });

        requestAnimationFrame(() => {
          applyManualSceneOrientation(entryOrientation);
        });
      } catch (error) {
        console.error("Scene change error:", error);
      } finally {
        window.clearTimeout(safetyTimer);
        isNavigatingRef.current = false;
      }
    },
    [
      getSceneById,
      getSceneStartOrientation,
      updateTargetNodeOrientation,
      applyManualSceneOrientation,
      preloadSceneImageOnce,
    ],
  );

  useEffect(() => {
    preloadSceneImages(currentSceneId);
  }, [currentSceneId, preloadSceneImages]);

  useEffect(() => {
    if (!resolvedStartScene) return;
    preloadSceneImageOnce(resolvedStartScene.imageUrl, "high");
  }, [resolvedStartScene, preloadSceneImageOnce]);

  useEffect(() => {
    if (currentSceneId === null) return;

    const currentScene = sortedScenes.find(
      (scene) => Number(scene.id) === Number(currentSceneId),
    );

    if (!currentScene) return;

    const directTargetIds = currentScene.hotspots
      .map((hotspot) => Number(hotspot.toSceneId))
      .filter((id, index, arr) => arr.indexOf(id) === index);

    const directTargetScenes = sortedScenes.filter((scene) =>
      directTargetIds.includes(Number(scene.id)),
    );

    const profile = getDeviceProfile();

    const directPreloadLimit = profile.isMobile
      ? 1
      : profile.isLowMemory || profile.isSlowConnection
        ? 1
        : 4;

    directTargetScenes.slice(0, directPreloadLimit).forEach((targetScene) => {
      preloadSceneImageOnce(targetScene.imageUrl, "high");
    });

    if (!profile.isMobile && !profile.isLowMemory && !profile.isSlowConnection) {
      scheduleIdleTask(() => {
        const secondLevelIds = directTargetScenes
          .flatMap((scene) =>
            scene.hotspots.map((hotspot) => Number(hotspot.toSceneId)),
          )
          .filter((id) => id !== Number(currentSceneId))
          .filter((id, index, arr) => arr.indexOf(id) === index);

        sortedScenes
          .filter((scene) => secondLevelIds.includes(Number(scene.id)))
          .slice(0, 4)
          .forEach((scene) => {
            preloadSceneImageOnce(scene.imageUrl, "low");
          });
      }, 900);
    }
  }, [currentSceneId, sortedScenes, preloadSceneImageOnce]);

  useEffect(() => {
    if (!containerRef.current || !resolvedStartScene || nodes.length === 0) return;

    if (viewerRef.current) {
      viewerRef.current.destroy();
      viewerRef.current = null;
    }

    setIsInitialLoading(true);
    setIsViewerVisible(false);

    const initialOrientation = getSceneStartOrientation(resolvedStartScene.id);
    let didFinishInitialLoad = false;

    const finishInitialLoad = () => {
      if (didFinishInitialLoad) return;
      didFinishInitialLoad = true;

      currentSceneRef.current = resolvedStartScene;
      setCurrentSceneId(resolvedStartScene.id);

      requestAnimationFrame(() => {
        setIsViewerVisible(true);
        setIsInitialLoading(false);
      });
    };

    const viewer = new Viewer({
      container: containerRef.current,
      navbar: ["zoom", "move"],
      adapter: EquirectangularAdapter.withConfig({
        resolution: getViewerResolution(),
      }),
      defaultYaw: initialOrientation?.yaw ?? 0,
      defaultPitch: initialOrientation?.pitch ?? 0,

      maxFov: window.innerWidth <= 640 ? 110 : 110,
      minFov: 30,
      defaultZoomLvl: window.innerWidth <= 640 ? 35 : 35,
      zoomSpeed: 1.15,

      moveInertia: true,
      mousewheelCtrlKey: false,
      touchmoveTwoFingers: false,
      plugins: [
        [
          VirtualTourPlugin,
          {
            positionMode: "manual",
            renderMode: "3d",
            startNodeId: String(resolvedStartScene.id),
            nodes,
            preload: false,
            transitionOptions: () => ({
              showLoader: false,
              effect: "fade",
              speed: 120,
              rotation: false,
            }),
          },
        ],
      ],
    });

    viewerRef.current = viewer;

    const vtPlugin = viewer.getPlugin(VirtualTourPlugin) as any;

    viewer.addEventListener("panorama-loaded", () => {
      finishInitialLoad();
    });

    vtPlugin.addEventListener("select-link", ({ link }: any) => {
      const targetSceneId = Number(link?.nodeId);
      const entryOrientation = getHotspotEntryOrientation(targetSceneId, link);

      pendingEntryOrientationRef.current = entryOrientation;

      prepareSceneForNavigation(targetSceneId, "high");

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

      const pending = pendingEntryOrientationRef.current;
      pendingEntryOrientationRef.current = null;

      if (pending && Number.isFinite(pending.yaw)) {
        requestAnimationFrame(() => {
          viewer.rotate({ yaw: pending.yaw, pitch: pending.pitch });
        });
      }
    });

    const fallbackTimer = window.setTimeout(() => {
      console.warn("Initial panorama load is taking longer than expected.");
    }, INITIAL_LOADING_FALLBACK_MS);

    viewer.addEventListener("panorama-error", (error: any) => {
      console.error("Initial panorama error:", error);
      finishInitialLoad();
    });

    return () => {
      window.clearTimeout(fallbackTimer);
      viewer.destroy();
      viewerRef.current = null;
      currentSceneRef.current = null;
    };
  }, [
    resolvedStartScene,
    nodes,
    getSceneById,
    getSceneStartOrientation,
    updateTargetNodeOrientation,
    prepareSceneForNavigation,
  ]);

  const handleSceneChange = async (id: number) => {
    resetOverlayTimer();
    await goToScene(id);
  };

  const handlePrevScene = useCallback(() => {
    if (currentSceneIndex <= 0) {
      handleSceneChange(sortedScenes[sortedScenes.length - 1].id);
    } else {
      handleSceneChange(sortedScenes[currentSceneIndex - 1].id);
    }
  }, [currentSceneIndex, sortedScenes]);

  const handleNextScene = useCallback(() => {
    if (currentSceneIndex >= sortedScenes.length - 1) {
      handleSceneChange(sortedScenes[0].id);
    } else {
      handleSceneChange(sortedScenes[currentSceneIndex + 1].id);
    }
  }, [currentSceneIndex, sortedScenes]);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error("Fullscreen error:", error);
    }
  };

  const handleCloseTour = useCallback(() => {
    if (onClose) onClose();
  }, [onClose]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCloseTour();
        return;
      }
      if (e.key === "ArrowRight") {
        resetOverlayTimer();
        if (sortedScenes.length > 1) handleNextScene();
        return;
      }
      if (e.key === "ArrowLeft") {
        resetOverlayTimer();
        if (sortedScenes.length > 1) handlePrevScene();
        return;
      }
      if (e.key === "f" || e.key === "F") {
        toggleFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCloseTour, handleNextScene, handlePrevScene, resetOverlayTimer, sortedScenes.length]);

  useEffect(() => {
    setCanUseFullscreen(!!document.fullscreenEnabled);

    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (currentSceneId === null) return;
    const activeButton = sceneButtonRefs.current[currentSceneId];
    const strip = sceneStripScrollRef.current;
    if (!activeButton || !strip) return;
    const target = activeButton.offsetLeft - strip.offsetWidth / 2 + activeButton.offsetWidth / 2;
    strip.scrollTo({ left: target, behavior: "smooth" });
  }, [currentSceneId]);

  if (sortedScenes.length === 0) {
    return (
      <div className="w-full h-full min-h-[100dvh] md:min-h-[500px] flex items-center justify-center bg-black text-white">
        Asnjë skenë e disponueshme.
      </div>
    );
  }

  const currentScene = sortedScenes.find((s) => s.id === currentSceneId);

  return (
    <div
      className="fixed inset-0 z-[9999] w-screen h-[100dvh] flex flex-col bg-black overflow-hidden font-sans group virtual-tour-shell"
      onMouseMove={resetOverlayTimer}
      onTouchStart={resetOverlayTimer}
      onClick={resetOverlayTimer}
    >
      <style>{`
        .virtual-tour-shell .psv-loader-container,
        .virtual-tour-shell .psv-loader {
          display: none !important;
        }

        /* ── Kill every PSV tooltip absolutely ── */
        .virtual-tour-shell .psv-tooltip,
        .virtual-tour-shell .psv-tooltip-content,
        .virtual-tour-shell .psv-tooltip-arrow,
        .virtual-tour-shell .psv-virtual-tour-link-tooltip,
        .virtual-tour-shell [class*="psv-tooltip"],
        .virtual-tour-shell [class*="link-tooltip"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }

        /* ── 3-D glass directional arrow (professional) ── */
        .virtual-tour-shell .psv-virtual-tour-arrow {
          position: relative !important;
          width: 58px !important;
          height: 58px !important;
          border-radius: 9999px !important;
          background:
            radial-gradient(circle at 38% 32%,
              rgba(255,255,255,0.22) 0%,
              rgba(30,30,30,0.82) 60%,
              rgba(0,0,0,0.92) 100%) !important;
          border: 1.5px solid rgba(255,255,255,0.32) !important;
          box-shadow:
            0 8px 28px rgba(0,0,0,0.65),
            0 2px 8px  rgba(0,0,0,0.45),
            inset 0 1px 0 rgba(255,255,255,0.18),
            inset 0 -1px 0 rgba(0,0,0,0.4),
            0 0 0 0 rgba(255,255,255,0.28) !important;
          animation: vt-arrow-pulse 2.6s ease-out infinite !important;
          transition: transform 0.18s cubic-bezier(0.34,1.56,0.64,1), border-color 0.18s ease !important;
          overflow: visible !important;
        }
        /* floor shadow ellipse */
        .virtual-tour-shell .psv-virtual-tour-arrow::after {
          content: '' !important;
          position: absolute !important;
          bottom: -12px !important;
          left: 50% !important;
          transform: translateX(-50%) !important;
          width: 60% !important;
          height: 10px !important;
          background: radial-gradient(ellipse at center, rgba(0,0,0,0.5) 0%, transparent 70%) !important;
          border-radius: 50% !important;
          pointer-events: none !important;
        }
        .virtual-tour-shell .psv-virtual-tour-arrow:hover {
          transform: scale(1.2) translateY(-4px) !important;
          border-color: rgba(255,255,255,0.65) !important;
          box-shadow:
            0 14px 36px rgba(0,0,0,0.7),
            0 4px 12px  rgba(0,0,0,0.5),
            inset 0 1px 0 rgba(255,255,255,0.25),
            inset 0 -1px 0 rgba(0,0,0,0.4),
            0 0 0 0 rgba(255,255,255,0) !important;
        }
        /* white upward arrow inside */
        .virtual-tour-shell .psv-virtual-tour-arrow svg {
          display: block !important;
          width: 26px !important;
          height: 26px !important;
          fill: rgba(255,255,255,0.95) !important;
          filter: drop-shadow(0 1px 3px rgba(0,0,0,0.6)) !important;
          opacity: 1 !important;
        }
        /* pulsing outer ring */
        @keyframes vt-arrow-pulse {
          0% {
            box-shadow: 0 8px 28px rgba(0,0,0,0.65), 0 2px 8px rgba(0,0,0,0.45),
                        inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.4),
                        0 0 0 0   rgba(255,255,255,0.28);
          }
          55% {
            box-shadow: 0 8px 28px rgba(0,0,0,0.65), 0 2px 8px rgba(0,0,0,0.45),
                        inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.4),
                        0 0 0 20px rgba(255,255,255,0);
          }
          100% {
            box-shadow: 0 8px 28px rgba(0,0,0,0.65), 0 2px 8px rgba(0,0,0,0.45),
                        inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.4),
                        0 0 0 0   rgba(255,255,255,0);
          }
        }

        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Close Button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (closeTouchHandledRef.current) {
            closeTouchHandledRef.current = false;
            return;
          }
          handleCloseTour();
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          e.stopPropagation();
          closeTouchHandledRef.current = true;
          handleCloseTour();
        }}
        className={`absolute z-[99999] w-11 h-11 bg-black/70 active:bg-black text-white rounded-full flex items-center justify-center md:backdrop-blur-md border border-white/10 shadow-lg pointer-events-auto transition-all duration-300 ${
          isOverlayVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={{
          top: "max(12px, env(safe-area-inset-top))",
          right: "max(12px, env(safe-area-inset-right))",
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
        }}
        aria-label="Mbyll turin virtual"
        type="button"
      >
        <X size={20} />
      </button>

      {/* Main viewer area */}
      <div className="relative w-full h-full flex-1 overflow-hidden">
        <div
          ref={containerRef}
          className="w-full h-full bg-black"
          style={{
            opacity: isViewerVisible ? 1 : 0,
            transition: "opacity 220ms ease",
          }}
        />

        {/* Initial loading overlay */}
        {isInitialLoading && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black">
            <div className="flex flex-col items-center gap-5">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-2 border-white/10" />
                <div className="absolute inset-0 rounded-full border-2 border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                <div className="absolute inset-[5px] rounded-full border border-white/5" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Compass size={18} className="text-primary/70" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-white/90 text-sm tracking-wide font-medium mb-1">
                  Duke hapur turin virtual
                </p>
                <span className="text-primary text-[11px] uppercase tracking-[0.25em] font-semibold opacity-70">
                  Panoramë 360°
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Top-left: Scene title */}
        <div
          className={`absolute top-5 left-5 z-40 pointer-events-none max-w-[60%] transition-all duration-300 ${
            isOverlayVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
          }`}
        >
          <div className="px-4 py-2 rounded-2xl bg-black/50 md:backdrop-blur-xl border border-white/10 shadow-xl">
            <h2 className="text-white/95 text-xs md:text-sm font-semibold tracking-wide leading-tight">
              {currentScene?.title || "Pamja 360°"}
            </h2>
          </div>
        </div>

        {/* Top-right: Scene counter */}
        <div
          className={`absolute z-40 pointer-events-none transition-all duration-300 ${
            isOverlayVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
          }`}
          style={{
            top: "max(20px, env(safe-area-inset-top))",
            right: "max(72px, calc(env(safe-area-inset-right) + 60px))",
          }}
        >
          <div className="px-3 py-1.5 rounded-xl bg-black/50 md:backdrop-blur-xl border border-white/10 shadow-xl">
            <span className="text-white/70 text-xs font-mono tabular-nums">
              {currentSceneIndex >= 0 ? currentSceneIndex + 1 : 1}
              <span className="text-white/30 mx-1">/</span>
              {sortedScenes.length}
            </span>
          </div>
        </div>


        {/* Bottom-right controls */}
        <div
          className={`absolute bottom-24 right-5 z-40 flex flex-col gap-2 transition-all duration-300 ${
            isOverlayVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2 pointer-events-none"
          }`}
        >
          {hasMap && (
            <button
              onClick={() => setShowMap(!showMap)}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors md:backdrop-blur-md border border-white/10 shadow-lg ${
                showMap ? "bg-primary text-black" : "bg-black/50 text-white hover:bg-black/70"
              }`}
              title="Plani i Katit"
            >
              <MapIcon size={18} />
            </button>
          )}

          {canUseFullscreen && (
            <button
              onClick={toggleFullscreen}
              className="w-11 h-11 rounded-full bg-black/50 text-white hover:bg-black/70 flex items-center justify-center transition-colors md:backdrop-blur-md border border-white/10 shadow-lg"
            >
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          )}
        </div>

        {/* Floor plan map */}
        {hasMap && (
          <div
            className={`absolute bottom-24 right-20 z-40 w-64 h-48 bg-black/80 md:backdrop-blur-xl border border-white/10 rounded-2xl p-4 transition-all duration-300 transform origin-bottom-right ${
              showMap ? "scale-100 opacity-100" : "scale-90 opacity-0 pointer-events-none"
            }`}
          >
            <p className="text-white/40 text-[10px] uppercase tracking-widest mb-2 font-semibold">Plani i Katit</p>
            <div
              className="w-full h-[calc(100%-20px)] relative border border-white/5 rounded-xl overflow-hidden bg-white/5"
              style={{
                backgroundImage: "radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)",
                backgroundSize: "10px 10px",
              }}
            >
              {sortedScenes
                .filter((s) => s.positionX != null && s.positionY != null)
                .map((scene) => (
                  <button
                    key={scene.id}
                    onMouseEnter={() => prepareSceneForNavigation(scene.id, "high")}
                    onFocus={() => prepareSceneForNavigation(scene.id, "high")}
                    onTouchStart={() => prepareSceneForNavigation(scene.id, "high")}
                    onClick={() => handleSceneChange(scene.id)}
                    className={`absolute w-4 h-4 -ml-2 -mt-2 rounded-full border-2 transition-all ${
                      currentSceneId === scene.id
                        ? "bg-primary border-white scale-125 z-10 shadow-[0_0_8px_rgba(212,175,55,0.5)]"
                        : "bg-white/80 border-transparent hover:scale-110"
                    }`}
                    style={{ left: `${scene.positionX}%`, top: `${scene.positionY}%` }}
                    title={scene.title}
                  />
                ))}
            </div>
          </div>
        )}

        {/* Scene strip at bottom */}
        <div
          className={`absolute bottom-0 left-0 right-0 z-40 transition-all duration-300 ${
            isOverlayVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
          }`}
        >
          <div className="h-20 bg-gradient-to-t from-black/95 to-transparent flex items-end justify-center pb-3 px-4">
            <div ref={sceneStripScrollRef} className="flex gap-2 overflow-x-auto max-w-full pb-1 hide-scrollbar">
              {sortedScenes.map((scene) => (
                <button
                  key={scene.id}
                  ref={(el) => {
                    sceneButtonRefs.current[scene.id] = el;
                  }}
                  onMouseEnter={() => prepareSceneForNavigation(scene.id, "high")}
                  onFocus={() => prepareSceneForNavigation(scene.id, "high")}
                  onTouchStart={() => prepareSceneForNavigation(scene.id, "high")}
                  onClick={() => handleSceneChange(scene.id)}
                  className={`relative shrink-0 w-24 h-14 rounded-xl overflow-hidden border-2 transition-all ${
                    currentSceneId === scene.id
                      ? "border-primary shadow-[0_0_12px_rgba(212,175,55,0.35)]"
                      : "border-white/10 opacity-60 hover:opacity-90 hover:border-white/30"
                  }`}
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
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-1.5">
                    <span className="text-[9px] text-white font-medium truncate drop-shadow-md leading-tight">
                      {scene.title}
                    </span>
                  </div>
                  {currentSceneId === scene.id && (
                    <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default VirtualTour360;

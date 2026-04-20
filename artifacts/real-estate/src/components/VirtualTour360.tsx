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

const INITIAL_LOADING_FALLBACK_MS = 15000;

export function VirtualTour360({
  scenes,
  defaultSceneId,
  onClose,
}: VirtualTour360Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const currentSceneRef = useRef<SceneType | null>(null);
  const isNavigatingRef = useRef(false);

   const [currentSceneId, setCurrentSceneId] = useState<number | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isViewerVisible, setIsViewerVisible] = useState(false);

  const hasMap = scenes.some((s) => s.positionX != null && s.positionY != null);
const [canUseFullscreen, setCanUseFullscreen] = useState(false);

  const sortedScenes = useMemo(
    () => [...scenes].sort((a, b) => a.sortOrder - b.sortOrder),
    [scenes],
  );

  const nodes = useMemo(() => {
    return sortedScenes.map((scene) => ({
      id: String(scene.id),
      panorama: scene.imageUrl,
      thumbnail: scene.thumbnailUrl || scene.imageUrl,
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

  const goToScene = useCallback(
    async (targetSceneId: number) => {
      const viewer = viewerRef.current;
      if (!viewer || isNavigatingRef.current) return;

      const targetScene = getSceneById(targetSceneId);
      if (!targetScene) return;

      if (currentSceneRef.current?.id === targetSceneId) return;

      isNavigatingRef.current = true;

      try {

        const vtPlugin = viewer.getPlugin(VirtualTourPlugin) as any;
        const entryOrientation = getSceneStartOrientation(targetSceneId);

        updateTargetNodeOrientation(
          vtPlugin,
          String(targetSceneId),
          entryOrientation,
        );

        await vtPlugin.setCurrentNode(String(targetSceneId), {
          showLoader: false,
          effect: "fade",
          speed: 260,
          rotation: false,
        });
      } catch (error) {
        console.error("Scene change error:", error);
      } finally {
        isNavigatingRef.current = false;
      }
    },
    [
      getSceneById,
      getSceneStartOrientation,
      updateTargetNodeOrientation,
    ],
  );

  useEffect(() => {
    Cache.enabled = true;
    Cache.ttl = 15 * 60 * 1000;
    Cache.maxItems = 12;
  }, []);

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

    const viewer = new Viewer({  // rezolucioni ne fuqin 2 bon veq, 64 / 128 / 128
      container: containerRef.current,
      navbar: ["zoom", "move", "fullscreen"],
adapter: EquirectangularAdapter.withConfig({
  resolution:
    window.innerWidth <= 640
      ? 64
      : window.innerWidth <= 1024
        ? 128
        : 256,
}),
      defaultYaw: initialOrientation?.yaw ?? 0,
      defaultPitch: initialOrientation?.pitch ?? 0,
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
              speed: 260,
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
    getHotspotEntryOrientation,
    updateTargetNodeOrientation,
  ]);

  const handleSceneChange = async (id: number) => {
    await goToScene(id);
  };

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

useEffect(() => {
  setCanUseFullscreen(!!document.fullscreenEnabled);

  const onFullscreenChange = () => {
    setIsFullscreen(!!document.fullscreenElement);
  };

  document.addEventListener("fullscreenchange", onFullscreenChange);
  return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
}, []);

  if (sortedScenes.length === 0) {
    return (
      <div className="w-full h-full min-h-[100dvh] md:min-h-[500px] flex items-center justify-center bg-black text-white">
        Asnjë skenë e disponueshme.
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] w-screen h-[100dvh] flex flex-col bg-black overflow-hidden font-sans group virtual-tour-shell">
      <style>{`
        .virtual-tour-shell .psv-loader-container,
        .virtual-tour-shell .psv-loader {
          display: none !important;
        }
      `}</style>
	  
	  
<button
  onPointerUp={(e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onClose) onClose();
    else window.history.back();
  }}
  className="absolute z-[99999] w-12 h-12 bg-black/70 active:bg-black text-white rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 shadow-lg"
  style={{
    top: "max(12px, env(safe-area-inset-top))",
    right: "max(12px, env(safe-area-inset-right))",
    touchAction: "manipulation",
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
            transition: "opacity 120ms linear",
          }}
        />

        {isInitialLoading && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <div className="text-white/80 text-sm tracking-wide">
                Duke hapur turin virtual...
              </div>
            </div>
          </div>
        )}

        <div className="absolute top-6 left-6 z-40 bg-black/50 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 pointer-events-none max-w-[80%]">
          <h2 className="text-white font-display text-xl">
            {sortedScenes.find((s) => s.id === currentSceneId)?.title || "Tur 360°"}
          </h2>
        </div>

        <div className="absolute bottom-24 right-6 z-40 flex flex-col gap-3">
          {hasMap && (
            <button
              onClick={() => setShowMap(!showMap)}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors backdrop-blur-md border border-white/10 shadow-lg ${
                showMap ? "bg-primary text-black" : "bg-black/50 text-white hover:bg-black/70"
              }`}
              title="Plani i Katit"
            >
              <MapIcon size={20} />
            </button>
          )}

{canUseFullscreen && (
  <button
    onClick={toggleFullscreen}
    className="w-12 h-12 rounded-full bg-black/50 text-white hover:bg-black/70 flex items-center justify-center transition-colors backdrop-blur-md border border-white/10 shadow-lg"
  >
    {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
  </button>
)}
        </div>

        {hasMap && (
          <div
            className={`absolute bottom-24 right-20 z-40 w-64 h-48 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 transition-all duration-300 transform origin-bottom-right ${
              showMap ? "scale-100 opacity-100" : "scale-90 opacity-0 pointer-events-none"
            }`}
          >
            <div
              className="w-full h-full relative border border-white/5 rounded-xl overflow-hidden bg-white/5"
              style={{
                backgroundImage: "radial-gradient(rgba(255,255,255,0.1) 1px, transparent 1px)",
                backgroundSize: "10px 10px",
              }}
            >
              {sortedScenes
                .filter((s) => s.positionX != null && s.positionY != null)
                .map((scene) => (
                  <button
                    key={scene.id}
                    onClick={() => handleSceneChange(scene.id)}
                    className={`absolute w-4 h-4 -ml-2 -mt-2 rounded-full border-2 transition-all ${
                      currentSceneId === scene.id
                        ? "bg-primary border-white scale-125 z-10"
                        : "bg-white border-transparent hover:scale-110"
                    }`}
                    style={{ left: `${scene.positionX}%`, top: `${scene.positionY}%` }}
                    title={scene.title}
                  />
                ))}
            </div>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/90 to-transparent flex items-end justify-center pb-4 px-4 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
          <div className="flex gap-2 overflow-x-auto max-w-full pb-2 hide-scrollbar">
            {sortedScenes.map((scene) => (
              <button
                key={scene.id}
                onClick={() => handleSceneChange(scene.id)}
                className={`relative shrink-0 w-24 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                  currentSceneId === scene.id
                    ? "border-primary"
                    : "border-transparent opacity-70 hover:opacity-100"
                }`}
              >
                <img
                  src={scene.thumbnailUrl || scene.imageUrl}
                  alt={scene.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/20 flex items-end p-1">
                  <span className="text-[10px] text-white font-medium truncate drop-shadow-md">
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
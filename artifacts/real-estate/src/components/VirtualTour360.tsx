import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Cache, Viewer, EquirectangularAdapter } from "@photo-sphere-viewer/core";
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

type Orientation = {
  yaw: number;
  pitch: number;
};

export function VirtualTour360({
  scenes,
  defaultSceneId,
  onClose,
}: VirtualTour360Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const lastClickedLinkRef = useRef<any | null>(null);
  const pendingOrientationRef = useRef<Orientation | null>(null);
  const isProgrammaticNodeChangeRef = useRef(false);

  const [currentSceneId, setCurrentSceneId] = useState<number | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const hasMap = scenes.some((s) => s.positionX != null && s.positionY != null);

  const nodes = useMemo(() => {
    return scenes.map((scene) => ({
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
  }, [scenes]);

  const resolvedStartNodeId = useMemo(() => {
    const defaultScene =
      scenes.find((s) => s.id === defaultSceneId) ||
      scenes.find((s) => s.isDefault) ||
      scenes[0];

    return defaultScene ? String(defaultScene.id) : null;
  }, [scenes, defaultSceneId]);

  const getSceneById = useCallback(
    (sceneId: number) => {
      return scenes.find((s) => s.id === sceneId) || null;
    },
    [scenes],
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

  const clampPitch = (pitch: number) => {
    const limit = Math.PI / 2 - 0.02;
    return Math.max(-limit, Math.min(limit, pitch));
  };

  const normalizeYaw = (yaw: number) => {
    let value = yaw;
    while (value <= -Math.PI) value += Math.PI * 2;
    while (value > Math.PI) value -= Math.PI * 2;
    return value;
  };

  const shortestAngleDelta = (from: number, to: number) => {
    return normalizeYaw(to - from);
  };

  const getHotspotTransitionOrientation = useCallback(
    (
      toSceneId: number,
      hotspotYaw: number,
      hotspotPitch: number,
      currentYaw: number,
      currentPitch: number,
      targetYaw?: number | null,
      targetPitch?: number | null,
    ): Orientation | null => {
      const targetSceneStart = getSceneStartOrientation(toSceneId);

      const baseYaw =
        typeof targetYaw === "number" && Number.isFinite(targetYaw)
          ? targetYaw
          : targetSceneStart?.yaw;

      const basePitch =
        typeof targetPitch === "number" && Number.isFinite(targetPitch)
          ? targetPitch
          : targetSceneStart?.pitch;

      if (
        typeof baseYaw !== "number" ||
        typeof basePitch !== "number" ||
        !Number.isFinite(baseYaw) ||
        !Number.isFinite(basePitch)
      ) {
        return null;
      }

      const yawDelta = shortestAngleDelta(hotspotYaw, currentYaw);
      const pitchDelta = currentPitch - hotspotPitch;

      return {
        yaw: normalizeYaw(baseYaw + yawDelta),
        pitch: clampPitch(basePitch + pitchDelta),
      };
    },
    [getSceneStartOrientation],
  );

const applyViewerOrientation = useCallback((orientation: Orientation | null) => {
  if (!viewerRef.current || !orientation) return;

  try {
    viewerRef.current.rotate({
      yaw: orientation.yaw,
      pitch: orientation.pitch,
    });
  } catch (error) {
    console.error("Viewer rotate error:", error);
  }
}, []);

  useEffect(() => {
    Cache.enabled = true;
    Cache.ttl = 15 * 60 * 1000;
    Cache.maxItems = 12;
  }, []);

  useEffect(() => {
    if (!containerRef.current || nodes.length === 0 || !resolvedStartNodeId) return;

    if (viewerRef.current) {
      viewerRef.current.destroy();
      viewerRef.current = null;
    }

    pendingOrientationRef.current = null;
    lastClickedLinkRef.current = null;
    isProgrammaticNodeChangeRef.current = false;
    setIsInitialLoading(true);

    const viewer = new Viewer({
      container: containerRef.current,
      navbar: ["zoom", "move", "fullscreen"],
      adapter: EquirectangularAdapter.withConfig({
        resolution: 128,
      }),
      defaultZoomLvl: 0,
      moveInertia: true,
      mousewheelCtrlKey: false,
      touchmoveTwoFingers: false,
      plugins: [
        [
          VirtualTourPlugin,
          {
            positionMode: "manual",
            renderMode: "3d",
            startNodeId: resolvedStartNodeId,
            nodes,
            preload: true,
            transitionOptions: (toNode: any, fromNode?: any) => {
              const viewerPosition = viewer.getPosition?.();
              const clickedLink = lastClickedLinkRef.current;
              let computedOrientation: Orientation | null = null;

              if (
                clickedLink &&
                viewerPosition &&
                fromNode &&
                Number.isFinite(viewerPosition.yaw) &&
                Number.isFinite(viewerPosition.pitch) &&
                clickedLink.position &&
                Number.isFinite(Number(clickedLink.position.yaw)) &&
                Number.isFinite(Number(clickedLink.position.pitch))
              ) {
                computedOrientation = getHotspotTransitionOrientation(
                  Number(toNode.id),
                  Number(clickedLink.position.yaw),
                  Number(clickedLink.position.pitch),
                  viewerPosition.yaw,
                  viewerPosition.pitch,
                  clickedLink.data?.targetYaw ?? null,
                  clickedLink.data?.targetPitch ?? null,
                );
              }

              pendingOrientationRef.current =
                computedOrientation || getSceneStartOrientation(Number(toNode.id));

              return {
                showLoader: false,
                effect: "fade",
                speed: 420,
                rotation: true,
              };
            },
          },
        ],
      ],
    });

    viewerRef.current = viewer;

viewer.addEventListener("ready", () => {
  setIsInitialLoading(false);

  const initialOrientation = getSceneStartOrientation(Number(resolvedStartNodeId));
  if (initialOrientation) {
    applyViewerOrientation(initialOrientation);
  }
});

    const vtPlugin = viewer.getPlugin(VirtualTourPlugin) as any;

    vtPlugin.addEventListener("select-link", ({ link }: any) => {
      if (!link) return;
      lastClickedLinkRef.current = link || null;
      isProgrammaticNodeChangeRef.current = false;
    });

    setCurrentSceneId(Number(resolvedStartNodeId));

vtPlugin.addEventListener("node-changed", ({ node }: any) => {
  const nextId = Number(node.id);
  setCurrentSceneId(nextId);

  const orientation =
    pendingOrientationRef.current || getSceneStartOrientation(nextId);

  applyViewerOrientation(orientation);

  pendingOrientationRef.current = null;
  lastClickedLinkRef.current = null;
  isProgrammaticNodeChangeRef.current = false;
});

    return () => {
      viewer.destroy();
      viewerRef.current = null;
    };
  }, [nodes, resolvedStartNodeId, getSceneStartOrientation, getHotspotTransitionOrientation, applyViewerOrientation]);

  const handleSceneChange = async (id: number) => {
    if (!viewerRef.current) return;

    const vtPlugin = viewerRef.current.getPlugin(VirtualTourPlugin) as any;
    lastClickedLinkRef.current = null;
    isProgrammaticNodeChangeRef.current = true;
    pendingOrientationRef.current = getSceneStartOrientation(id);

    await vtPlugin.setCurrentNode(String(id), {
      showLoader: false,
      effect: "fade",
      speed: 380,
      rotation: true,
    });
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
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  if (scenes.length === 0) {
    return (
      <div className="w-full h-full min-h-[100dvh] md:min-h-[500px] flex items-center justify-center bg-black text-white">
        Asnjë skenë e disponueshme.
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[100dvh] md:min-h-[500px] flex flex-col bg-black overflow-hidden font-sans group virtual-tour-shell">
      <style>{`
        .virtual-tour-shell .psv-loader-container,
        .virtual-tour-shell .psv-loader {
          display: none !important;
        }
      `}</style>

      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 w-10 h-10 bg-black/50 hover:bg-primary text-white rounded-full flex items-center justify-center transition-colors backdrop-blur-md"
        >
          <X size={20} />
        </button>
      )}

      <div className="relative w-full h-full flex-1 overflow-hidden">
        <div ref={containerRef} className="w-full h-full" />

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
            {scenes.find((s) => s.id === currentSceneId)?.title || "Tur 360°"}
          </h2>
        </div>

        <div className="absolute bottom-24 right-6 z-40 flex flex-col gap-3">
          {hasMap && (
            <button
              onClick={() => setShowMap(!showMap)}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors backdrop-blur-md border border-white/10 shadow-lg ${
                showMap
                  ? "bg-primary text-black"
                  : "bg-black/50 text-white hover:bg-black/70"
              }`}
              title="Plani i Katit"
            >
              <MapIcon size={20} />
            </button>
          )}

          <button
            onClick={toggleFullscreen}
            className="w-12 h-12 rounded-full bg-black/50 text-white hover:bg-black/70 flex items-center justify-center transition-colors backdrop-blur-md border border-white/10 shadow-lg"
          >
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
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
                backgroundImage:
                  "radial-gradient(rgba(255,255,255,0.1) 1px, transparent 1px)",
                backgroundSize: "10px 10px",
              }}
            >
              {scenes
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
            {scenes.map((scene) => (
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
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Cache, Viewer } from "@photo-sphere-viewer/core";
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

export function VirtualTour360({
  scenes,
  defaultSceneId,
  onClose,
}: VirtualTour360Props) {
const containerRef = useRef<HTMLDivElement>(null);
const viewerRef = useRef<Viewer | null>(null);
const overlayRef = useRef<HTMLDivElement>(null);
const isCustomTransitionRef = useRef(false);
const pendingOrientationRef = useRef<{ nodeId: number; yaw: number; pitch: number } | null>(null);
const lastClickedLinkRef = useRef<any | null>(null);
const preloadedPanoramasRef = useRef<Map<string, Promise<void>>>(new Map());


  const [currentSceneId, setCurrentSceneId] = useState<number | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const hasMap = scenes.some((s) => s.positionX != null && s.positionY != null);

  const preloadPanorama = useCallback((url: string) => {
    if (!url) return Promise.resolve();

    const existing = preloadedPanoramasRef.current.get(url);
    if (existing) return existing;

    const promise = new Promise<void>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = async () => {
        try {
          if ("decode" in img) {
            await img.decode();
          }
        } catch {
          // ignore decode errors
        }
        resolve();
      };

      img.onerror = () => resolve();
      img.src = url;
    });

    preloadedPanoramasRef.current.set(url, promise);
    return promise;
  }, []);

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

  const getSceneStartOrientation = useCallback(
    (sceneId: number) => {
      const scene = scenes.find((s) => s.id === sceneId);
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
    [scenes],
  );

  const orientViewer = async (yaw: number, pitch: number) => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    try {
      await viewer.animate({
        yaw,
        pitch,
        speed: "8rpm",
      });
    } catch {
      try {
        viewer.rotate({ yaw, pitch });
      } catch (error) {
        console.error("Viewer orientation error:", error);
      }
    }
  };

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
      fromSceneId: number,
      toSceneId: number,
      hotspotYaw: number,
      hotspotPitch: number,
      currentYaw: number,
      currentPitch: number,
    ) => {
      const fromScene = scenes.find((s) => s.id === fromSceneId);
      if (!fromScene) return getSceneStartOrientation(toSceneId);

      const hotspot = fromScene.hotspots.find((h) => {
        const sameTarget = h.toSceneId === toSceneId;
        const sameYaw = Math.abs(h.yaw - hotspotYaw) < 0.0001;
        const samePitch = Math.abs(h.pitch - hotspotPitch) < 0.0001;
        return sameTarget && sameYaw && samePitch;
      });

      if (!hotspot) return getSceneStartOrientation(toSceneId);

      const targetSceneStart = getSceneStartOrientation(toSceneId);

      const baseYaw =
        typeof hotspot.targetYaw === "number" && Number.isFinite(hotspot.targetYaw)
          ? hotspot.targetYaw
          : targetSceneStart?.yaw;

      const basePitch =
        typeof hotspot.targetPitch === "number" && Number.isFinite(hotspot.targetPitch)
          ? hotspot.targetPitch
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
    [scenes, getSceneStartOrientation],
  );

  useEffect(() => {
    Cache.enabled = true;
    Cache.ttl = 60 * 24;
    Cache.maxItems = Math.max(20, scenes.length + 5);
  }, [scenes.length]);

  useEffect(() => {
    if (scenes.length === 0) return;

    let cancelled = false;

    const run = async () => {
      const validUrls = scenes
        .map((scene) => scene.imageUrl)
        .filter((url): url is string => !!url && url.trim() !== "");

      await Promise.allSettled(validUrls.map((url) => preloadPanorama(url)));

      if (cancelled) return;
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [scenes, preloadPanorama]);

  useEffect(() => {
    if (!containerRef.current || nodes.length === 0 || !resolvedStartNodeId) return;

    if (viewerRef.current) {
      viewerRef.current.destroy();
      viewerRef.current = null;
    }

    const viewer = new Viewer({
      container: containerRef.current,
      navbar: ["zoom", "move", "fullscreen"],
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
                const computedOrientation = getHotspotTransitionOrientation(
                  Number(fromNode.id),
                  Number(toNode.id),
                  Number(clickedLink.position.yaw),
                  Number(clickedLink.position.pitch),
                  viewerPosition.yaw,
                  viewerPosition.pitch,
                );

                if (computedOrientation) {
                  pendingOrientationRef.current = {
                    nodeId: Number(toNode.id),
                    yaw: computedOrientation.yaw,
                    pitch: computedOrientation.pitch,
                  };
                } else {
                  const fallbackOrientation = getSceneStartOrientation(Number(toNode.id));
                  pendingOrientationRef.current = fallbackOrientation
                    ? {
                        nodeId: Number(toNode.id),
                        yaw: fallbackOrientation.yaw,
                        pitch: fallbackOrientation.pitch,
                      }
                    : null;
                }
              } else {
                const fallbackOrientation = getSceneStartOrientation(Number(toNode.id));
                pendingOrientationRef.current = fallbackOrientation
                  ? {
                      nodeId: Number(toNode.id),
                      yaw: fallbackOrientation.yaw,
                      pitch: fallbackOrientation.pitch,
                    }
                  : null;
              }

return {
  showLoader: false,
  effect: "fade",
  speed: isCustomTransitionRef.current ? 0 : 380,
  rotation: false,
};
            },
          },
        ],
      ],
    });

    viewerRef.current = viewer;

    const vtPlugin = viewer.getPlugin(VirtualTourPlugin) as any;

vtPlugin.addEventListener("select-link", async ({ link }: any) => {
  if (!link) return;

  const overlay = overlayRef.current;
  const currentViewer = viewerRef.current;
  if (!overlay || !currentViewer) return;

  const targetNodeId = Number(link.nodeId);
  const targetScene = scenes.find((s) => s.id === targetNodeId);
  if (!targetScene?.imageUrl) return;

  lastClickedLinkRef.current = link;
  isCustomTransitionRef.current = true;

  try {
    await preloadPanorama(targetScene.imageUrl);

    overlay.style.backgroundImage = `url("${targetScene.imageUrl}")`;
    overlay.style.opacity = "0";
    overlay.style.transform = "scale(1.035)";

    try {
      await vtPlugin.gotoLink(link.nodeId, "8rpm");
    } catch (error) {
      console.error("gotoLink smoothing error:", error);
    }

    const currentZoom = currentViewer.getZoomLevel?.() ?? 0;

    try {
      await currentViewer.animate({
        yaw: Number(link.position?.yaw),
        pitch: Number(link.position?.pitch),
        zoom: Math.min(20, currentZoom + 6),
        speed: 140,
      });
    } catch (error) {
      console.error("Pre-transition pull error:", error);
    }

    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
      overlay.style.transform = "scale(1)";
    });

    await new Promise((resolve) => setTimeout(resolve, 170));

    await vtPlugin.setCurrentNode(String(targetNodeId), {
      showLoader: false,
      effect: "fade",
      speed: 0,
      rotation: false,
    });

    try {
      currentViewer.zoom(0);
    } catch (error) {
      console.error("Zoom reset after transition error:", error);
    }

    await new Promise((resolve) => setTimeout(resolve, 60));

    overlay.style.opacity = "0";
    overlay.style.transform = "scale(0.995)";

    await new Promise((resolve) => setTimeout(resolve, 220));
  } catch (error) {
    console.error("Custom hotspot transition error:", error);
  } finally {
    overlay.style.opacity = "0";
    overlay.style.transform = "scale(1)";
    isCustomTransitionRef.current = false;
  }
});

    setCurrentSceneId(Number(resolvedStartNodeId));

    const initialOrientation = getSceneStartOrientation(Number(resolvedStartNodeId));
    if (initialOrientation) {
      pendingOrientationRef.current = {
        nodeId: Number(resolvedStartNodeId),
        yaw: initialOrientation.yaw,
        pitch: initialOrientation.pitch,
      };
    }

    
	
	
vtPlugin.addEventListener("node-changed", ({ node }: any) => {
  const nextId = Number(node.id);
  setCurrentSceneId(nextId);

  if (!isCustomTransitionRef.current) {
    try {
      viewer.zoom(0);
    } catch (error) {
      console.error("Node changed zoom reset error:", error);
    }
  }

  pendingOrientationRef.current = null;
  lastClickedLinkRef.current = null;
});
	

    return () => {
      viewer.destroy();
      viewerRef.current = null;
    };
  }, [nodes, resolvedStartNodeId, scenes, getSceneStartOrientation, getHotspotTransitionOrientation]);

  const handleSceneChange = async (id: number) => {
    if (!viewerRef.current) return;

    const vtPlugin = viewerRef.current.getPlugin(VirtualTourPlugin) as any;
    const startOrientation = getSceneStartOrientation(id);

    lastClickedLinkRef.current = null;

    if (startOrientation) {
      pendingOrientationRef.current = {
        nodeId: id,
        yaw: startOrientation.yaw,
        pitch: startOrientation.pitch,
      };
    } else {
      pendingOrientationRef.current = null;
    }

await vtPlugin.setCurrentNode(String(id), {
  showLoader: false,
  effect: "fade",
  speed: 320,
  rotation: false,
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
          opacity: 0 !important;
          visibility: hidden !important;
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

  <div
    ref={overlayRef}
    className="absolute inset-0 pointer-events-none opacity-0"
    style={{
      backgroundRepeat: "no-repeat",
      backgroundSize: "cover",
      backgroundPosition: "center",
      transform: "scale(1)",
      transition: "opacity 220ms ease, transform 320ms ease",
      willChange: "opacity, transform",
    }}
  />
</div>

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
  );
}
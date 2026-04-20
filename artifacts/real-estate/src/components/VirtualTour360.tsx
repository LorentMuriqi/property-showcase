import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Cache,
  Viewer,
  EquirectangularAdapter,
} from "@photo-sphere-viewer/core";
import { MarkersPlugin } from "@photo-sphere-viewer/markers-plugin";
import "@photo-sphere-viewer/core/index.css";
import "@photo-sphere-viewer/markers-plugin/index.css";
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
type HotspotType = SceneType["hotspots"][number];
type Orientation = { yaw: number; pitch: number };

const INITIAL_LOADING_FALLBACK_MS = 2500;

const HOTSPOT_HTML = `
  <div style="
    width: 42px;
    height: 42px;
    border-radius: 9999px;
    background: rgba(0,0,0,0.58);
    border: 3px solid #d4af37;
    display:flex;
    align-items:center;
    justify-content:center;
    color:white;
    font-size:12px;
    font-weight:700;
    box-shadow:0 10px 24px rgba(0,0,0,.38);
    cursor:pointer;
    user-select:none;
  ">
    ↗
  </div>
`;

export function VirtualTour360({
  scenes,
  defaultSceneId,
  onClose,
}: VirtualTour360Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const markersPluginRef = useRef<any | null>(null);
  const currentSceneRef = useRef<SceneType | null>(null);
  const isNavigatingRef = useRef(false);

  const [currentSceneId, setCurrentSceneId] = useState<number | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const sortedScenes = useMemo(
    () => [...scenes].sort((a, b) => a.sortOrder - b.sortOrder),
    [scenes],
  );

  const hasMap = sortedScenes.some((s) => s.positionX != null && s.positionY != null);

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
    (targetSceneId: number, hotspot?: HotspotType | null): Orientation | null => {
      if (
        hotspot &&
        typeof hotspot.targetYaw === "number" &&
        typeof hotspot.targetPitch === "number" &&
        Number.isFinite(hotspot.targetYaw) &&
        Number.isFinite(hotspot.targetPitch)
      ) {
        return {
          yaw: hotspot.targetYaw,
          pitch: hotspot.targetPitch,
        };
      }

      return getSceneStartOrientation(targetSceneId);
    },
    [getSceneStartOrientation],
  );

  const preloadPanorama = useCallback((src: string) => {
    return new Promise<void>((resolve) => {
      if (!src) {
        resolve();
        return;
      }

      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = src;
    });
  }, []);

  const clearMarkers = useCallback(() => {
    const markersPlugin = markersPluginRef.current;
    if (!markersPlugin?.getMarkers || !markersPlugin?.removeMarker) return;

    const existingMarkers = markersPlugin.getMarkers() || [];
    existingMarkers.forEach((marker: any) => {
      try {
        markersPlugin.removeMarker(marker.id);
      } catch (error) {
        console.error("Remove marker error:", error);
      }
    });
  }, []);

  const renderMarkersForScene = useCallback(
    (scene: SceneType) => {
      const markersPlugin = markersPluginRef.current;
      if (!markersPlugin?.addMarker) return;

      clearMarkers();

      scene.hotspots.forEach((hotspot) => {
        const targetScene = getSceneById(hotspot.toSceneId);

        try {
          markersPlugin.addMarker({
            id: `hotspot-${hotspot.id}`,
            longitude: hotspot.yaw,
            latitude: hotspot.pitch,
            html: HOTSPOT_HTML,
            tooltip: hotspot.label || targetScene?.title || "Lidhje",
            anchor: "center center",
            data: {
              hotspot,
            },
          });
        } catch (error) {
          console.error("Add hotspot marker error:", hotspot, error);
        }
      });
    },
    [clearMarkers, getSceneById],
  );

  const goToScene = useCallback(
    async (targetSceneId: number, viaHotspot?: HotspotType | null) => {
      const viewer = viewerRef.current;
      if (!viewer || isNavigatingRef.current) return;

      const targetScene = getSceneById(targetSceneId);
      if (!targetScene) return;

      if (currentSceneRef.current?.id === targetSceneId) return;

      isNavigatingRef.current = true;

      try {
        await preloadPanorama(targetScene.imageUrl);

        const entryOrientation = getHotspotEntryOrientation(targetSceneId, viaHotspot);

        await viewer.setPanorama(targetScene.imageUrl, {
          position: entryOrientation || undefined,
          showLoader: false,
          transition: {
            effect: "fade",
            speed: 220,
            rotation: false,
          },
        });

        currentSceneRef.current = targetScene;
        setCurrentSceneId(targetScene.id);

        try {
          renderMarkersForScene(targetScene);
        } catch (error) {
          console.error("Scene marker render error:", error);
        }
      } catch (error) {
        console.error("Scene change error:", error);
      } finally {
        isNavigatingRef.current = false;
      }
    },
    [getSceneById, preloadPanorama, getHotspotEntryOrientation, renderMarkersForScene],
  );

  useEffect(() => {
    Cache.enabled = true;
    Cache.ttl = 15 * 60 * 1000;
    Cache.maxItems = 12;
  }, []);

  useEffect(() => {
    if (!containerRef.current || !resolvedStartScene) return;

    if (viewerRef.current) {
      viewerRef.current.destroy();
      viewerRef.current = null;
      markersPluginRef.current = null;
    }

    setIsInitialLoading(true);

    const initialOrientation = getSceneStartOrientation(resolvedStartScene.id);
    let didFinishInitialLoad = false;

    const finishInitialLoad = () => {
      if (didFinishInitialLoad) return;
      didFinishInitialLoad = true;

      currentSceneRef.current = resolvedStartScene;
      setCurrentSceneId(resolvedStartScene.id);
      setIsInitialLoading(false);

      try {
        renderMarkersForScene(resolvedStartScene);
      } catch (error) {
        console.error("Initial marker render error:", error);
      }
    };

    const viewer = new Viewer({
      container: containerRef.current,
      panorama: resolvedStartScene.imageUrl,
      defaultYaw: initialOrientation?.yaw ?? 0,
      defaultPitch: initialOrientation?.pitch ?? 0,
      navbar: ["zoom", "move", "fullscreen"],
      adapter: EquirectangularAdapter.withConfig({
        resolution: window.innerWidth <= 768 ? 64 : 128,
      }),
      moveInertia: true,
      mousewheelCtrlKey: false,
      touchmoveTwoFingers: false,
      plugins: [[MarkersPlugin, {}]],
    });

    viewerRef.current = viewer;

    const markersPlugin = viewer.getPlugin(MarkersPlugin) as any;
    markersPluginRef.current = markersPlugin;

    markersPlugin.addEventListener("select-marker", async ({ marker }: any) => {
      const hotspot = marker?.data?.hotspot as HotspotType | undefined;
      if (!hotspot) return;

      await goToScene(hotspot.toSceneId, hotspot);
    });

    if (initialOrientation) {
      try {
        viewer.rotate({
          yaw: initialOrientation.yaw,
          pitch: initialOrientation.pitch,
        });
      } catch (error) {
        console.error("Initial orientation apply error:", error);
      }
    }

    const revealTimer = window.setTimeout(() => {
      finishInitialLoad();
    }, 150);

    const fallbackTimer = window.setTimeout(() => {
      finishInitialLoad();
    }, INITIAL_LOADING_FALLBACK_MS);

    viewer.addEventListener("panorama-error", (error: any) => {
      console.error("Initial panorama error:", error);
      finishInitialLoad();
    });

    return () => {
      window.clearTimeout(revealTimer);
      window.clearTimeout(fallbackTimer);
      viewer.destroy();
      viewerRef.current = null;
      markersPluginRef.current = null;
      currentSceneRef.current = null;
    };
  }, [resolvedStartScene, getSceneStartOrientation, renderMarkersForScene, goToScene]);

  const handleSceneChange = async (id: number) => {
    await goToScene(id, null);
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

  if (sortedScenes.length === 0) {
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
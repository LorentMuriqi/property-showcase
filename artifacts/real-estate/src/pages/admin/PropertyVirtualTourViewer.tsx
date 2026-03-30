import { useEffect, useMemo, useRef, useState } from "react";
import { Viewer } from "@photo-sphere-viewer/core";
import { VirtualTourPlugin } from "@photo-sphere-viewer/virtual-tour-plugin";
import "@photo-sphere-viewer/core/index.css";
import "@photo-sphere-viewer/virtual-tour-plugin/index.css";
import { supabase } from "@/lib/supabase";

type Scene = {
  id: number;
  title: string;
  image_url: string;
  thumbnail_url: string | null;
  is_default: boolean;
  sort_order: number;
};

type Hotspot = {
  id: number;
  scene_id: number;
  to_scene_id: number;
  yaw: number;
  pitch: number;
  label: string | null;
};

export default function PropertyVirtualTourViewer({ propertyId }: { propertyId: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);

      const { data: scenesData } = await supabase
        .from("virtual_tour_scenes")
        .select("*")
        .eq("property_id", propertyId)
        .order("sort_order", { ascending: true });

      const sceneIds = (scenesData || []).map((scene) => scene.id);

      let hotspotsData: Hotspot[] = [];

      if (sceneIds.length > 0) {
        const response = await supabase
          .from("virtual_tour_hotspots")
          .select("*")
          .in("scene_id", sceneIds);

        hotspotsData = (response.data || []) as Hotspot[];
      }

      setScenes((scenesData || []) as Scene[]);
      setHotspots(hotspotsData);
      setIsLoading(false);
    };

    load();
  }, [propertyId]);

  const nodes = useMemo(() => {
    return scenes.map((scene) => ({
      id: String(scene.id),
      panorama: scene.image_url,
      name: scene.title,
      thumbnail: scene.thumbnail_url || scene.image_url,
      links: hotspots
        .filter((hotspot) => hotspot.scene_id === scene.id)
        .map((hotspot) => ({
          nodeId: String(hotspot.to_scene_id),
          position: {
            yaw: hotspot.yaw,
            pitch: hotspot.pitch,
          },
          name:
            hotspot.label || scenes.find((target) => target.id === hotspot.to_scene_id)?.title || "Lidhje",
        })),
    }));
  }, [scenes, hotspots]);

  useEffect(() => {
    if (!containerRef.current || nodes.length === 0) return;

    if (viewerRef.current) {
      viewerRef.current.destroy();
      viewerRef.current = null;
    }

    const defaultScene = scenes.find((scene) => scene.is_default) || scenes[0];
    if (!defaultScene) return;

    const viewer = new Viewer({
      container: containerRef.current,
      navbar: ["zoom", "move", "fullscreen"],
      plugins: [
        [
          VirtualTourPlugin,
          {
            positionMode: "manual",
            renderMode: "3d",
            startNodeId: String(defaultScene.id),
            nodes,
          },
        ],
      ],
    });

    viewerRef.current = viewer;

    return () => {
      viewer.destroy();
      viewerRef.current = null;
    };
  }, [nodes, scenes]);

  if (isLoading) {
    return <div className="text-white/70">Duke ngarkuar turin virtual...</div>;
  }

  if (nodes.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="aspect-[16/9] rounded-2xl overflow-hidden border border-white/10 bg-black">
        <div ref={containerRef} className="w-full h-full" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {scenes.map((scene) => (
          <div key={scene.id} className="rounded-xl overflow-hidden border border-white/10 bg-white/5">
            <div className="aspect-[4/3] bg-black">
              <img
                src={scene.thumbnail_url || scene.image_url}
                alt={scene.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-2 text-xs text-white truncate">{scene.title}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
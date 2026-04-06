import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { VirtualTour360 } from "@/components/VirtualTour360";

export default function PropertyVirtualTourViewer({
  propertyId,
  fallbackUrl,
  fallbackEmbedCode,
}: {
  propertyId: string | number;
  fallbackUrl?: string;
  fallbackEmbedCode?: string;
}) {
  const [scenes, setScenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadScenes = async () => {
      setLoading(true);

      const { data: sceneData, error: sceneError } = await supabase
        .from("virtual_tour_scenes")
        .select("*")
        .eq("property_id", propertyId)
        .order("sort_order", { ascending: true });

      if (sceneError) {
        console.error("Scene load error:", sceneError);
        setScenes([]);
        setLoading(false);
        return;
      }

      if (!sceneData || sceneData.length === 0) {
        setScenes([]);
        setLoading(false);
        return;
      }

      const sceneIds = sceneData.map((s) => s.id);

      const { data: hotspots, error: hotspotError } = await supabase
        .from("virtual_tour_hotspots")
        .select("*")
        .in("scene_id", sceneIds);

      if (hotspotError) {
        console.error("Hotspot load error:", hotspotError);
      }

      const normalized = sceneData.map((scene) => ({
        id: scene.id,
        title: scene.title,
        imageUrl: scene.image_url,
        thumbnailUrl: scene.thumbnail_url,
        isDefault: scene.is_default,
        sortOrder: scene.sort_order,
        positionX: scene.position_x,
        positionY: scene.position_y,
        initialYaw: scene.initial_yaw,
        initialPitch: scene.initial_pitch,
        hotspots:
          hotspots
            ?.filter((h) => h.scene_id === scene.id)
            .map((h) => ({
              id: h.id,
              fromSceneId: h.scene_id,
              toSceneId: h.to_scene_id,
              yaw: h.yaw,
              pitch: h.pitch,
              label: h.label,
            })) || [],
      }));

      setScenes(normalized);
      setLoading(false);
    };

    loadScenes();
  }, [propertyId]);

  if (loading) {
    return <div className="text-white">Loading virtual tour...</div>;
  }

  if (scenes.length > 0) {
    const defaultScene = scenes.find((s) => s.isDefault);
    return (
      <VirtualTour360
        scenes={scenes}
        defaultSceneId={defaultScene?.id ?? scenes[0]?.id}
      />
    );
  }

  if (fallbackEmbedCode) {
    return (
      <div
        className="w-full h-[100dvh] md:h-[80vh] [&>iframe]:w-full [&>iframe]:h-full"
        dangerouslySetInnerHTML={{ __html: fallbackEmbedCode }}
      />
    );
  }

  if (fallbackUrl) {
    return (
      <iframe
        src={fallbackUrl}
        className="w-full h-[100dvh] md:h-[80vh] border-none rounded-none md:rounded-2xl"
        allowFullScreen
        title="Virtual Tour"
      />
    );
  }

  return (
    <div className="w-full h-[60vh] flex items-center justify-center text-white">
      No virtual tour available
    </div>
  );
}
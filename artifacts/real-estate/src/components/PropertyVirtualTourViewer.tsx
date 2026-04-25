import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { VirtualTour360 } from "@/components/VirtualTour360";
import { X } from "lucide-react";

export default function PropertyVirtualTourViewer({
  propertyId,
  fallbackUrl,
  fallbackEmbedCode,
  onClose,
}: {
  propertyId: string | number;
  fallbackUrl?: string;
  fallbackEmbedCode?: string;
  onClose?: () => void;
}) {
  const [scenes, setScenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadScenes = async () => {
      setLoading(true);

	  const { data: propertyData, error: propertyError } = await supabase
  .from("properties")
  .select("virtual_tour_status")
  .eq("id", propertyId)
  .single();

if (propertyError || propertyData?.virtual_tour_status !== "published") {
  setScenes([]);
  setLoading(false);
  return;
}

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
        targetYaw: h.target_yaw,
        targetPitch: h.target_pitch,
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
        onClose={onClose}
      />
    );
  }

if (fallbackEmbedCode) {
  return (
    <div className="fixed inset-0 z-[9999] w-screen h-[100dvh] bg-black overflow-hidden">
      <button
        onClick={onClose}
        className="absolute z-[99999] w-12 h-12 bg-black/70 active:bg-black text-white rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 shadow-lg"
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

      <div
        className="w-full h-full [&>iframe]:w-full [&>iframe]:h-full [&>iframe]:border-0"
        dangerouslySetInnerHTML={{ __html: fallbackEmbedCode }}
      />
    </div>
  );
}

if (fallbackUrl) {
  return (
    <div className="fixed inset-0 z-[9999] w-screen h-[100dvh] bg-black overflow-hidden">
      <button
        onClick={onClose}
        className="absolute z-[99999] w-12 h-12 bg-black/70 active:bg-black text-white rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 shadow-lg"
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

      <iframe
        src={fallbackUrl}
        className="w-full h-full border-0"
        allowFullScreen
        title="Virtual Tour"
      />
    </div>
  );
}

  return (
    <div className="w-full h-[60vh] flex items-center justify-center text-white">
      No virtual tour available
    </div>
  );
}
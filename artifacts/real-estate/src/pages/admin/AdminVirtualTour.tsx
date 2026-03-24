import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit,
  Map as MapIcon,
  Crosshair,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Viewer } from "@photo-sphere-viewer/core";
import { MarkersPlugin } from "@photo-sphere-viewer/markers-plugin";
import "@photo-sphere-viewer/core/index.css";
import "@photo-sphere-viewer/markers-plugin/index.css";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Scene = {
  id: number;
  property_id: number;
  title: string;
  image_url: string;
  thumbnail_url: string | null;
  is_default: boolean;
  sort_order: number;
  position_x: number | null;
  position_y: number | null;
  hotspots?: Hotspot[];
};

type Hotspot = {
  id: number;
  scene_id: number;
  to_scene_id: number;
  yaw: number;
  pitch: number;
  label: string | null;
};

type Project = {
  id: number;
  title: string;
};

export default function AdminVirtualTour() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { id } = useParams();
  const projectId = Number(id);
  const { toast } = useToast();

  const [project, setProject] = useState<Project | null>(null);
  const [tourData, setTourData] = useState<{ scenes: Scene[] }>({ scenes: [] });
  const [isLoading, setIsLoading] = useState(true);

  const [isSceneModalOpen, setIsSceneModalOpen] = useState(false);
  const [editingSceneId, setEditingSceneId] = useState<number | null>(null);
  const [sceneForm, setSceneForm] = useState({
    title: "",
    imageUrl: "",
    thumbnailUrl: "",
    isDefault: false,
    sortOrder: 0,
  });

  const [selectedSceneForHotspots, setSelectedSceneForHotspots] =
    useState<Scene | null>(null);

  const viewerRef = useRef<Viewer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [clickCoords, setClickCoords] = useState<{
    yaw: number;
    pitch: number;
  } | null>(null);
  const [targetSceneId, setTargetSceneId] = useState<number | "">("");
  const [hotspotLabel, setHotspotLabel] = useState("");

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      setLocation("/admin/login");
    }
  }, [authLoading, isAdmin, setLocation]);

  const refreshTour = async () => {
    if (!projectId) return;

    const { data: projectData } = await supabase
      .from("properties")
      .select("id, title")
      .eq("id", projectId)
      .single();

    const { data: scenesData, error: scenesError } = await supabase
      .from("virtual_tour_scenes")
      .select("*")
      .eq("property_id", projectId)
      .order("sort_order", { ascending: true });

    if (scenesError) {
      console.error("Scenes fetch error:", scenesError);
      setTourData({ scenes: [] });
      setProject(projectData || null);
      return;
    }

    const sceneIds = (scenesData || []).map((s) => s.id);

    let hotspotsByScene = new Map<number, Hotspot[]>();

    if (sceneIds.length > 0) {
      const { data: hotspotsData, error: hotspotsError } = await supabase
        .from("virtual_tour_hotspots")
        .select("*")
        .in("scene_id", sceneIds);

      if (hotspotsError) {
        console.error("Hotspots fetch error:", hotspotsError);
      } else {
        for (const hs of hotspotsData || []) {
          if (!hotspotsByScene.has(hs.scene_id)) {
            hotspotsByScene.set(hs.scene_id, []);
          }
          hotspotsByScene.get(hs.scene_id)!.push(hs as Hotspot);
        }
      }
    }

    const normalizedScenes: Scene[] = (scenesData || []).map((scene) => ({
      id: scene.id,
      property_id: scene.property_id,
      title: scene.title,
      image_url: scene.image_url,
      thumbnail_url: scene.thumbnail_url,
      is_default: !!scene.is_default,
      sort_order: scene.sort_order ?? 0,
      position_x: scene.position_x,
      position_y: scene.position_y,
      hotspots: hotspotsByScene.get(scene.id) || [],
    }));

    setProject(projectData || null);
    setTourData({ scenes: normalizedScenes });

    if (selectedSceneForHotspots) {
      const updatedSelected = normalizedScenes.find(
        (s) => s.id === selectedSceneForHotspots.id,
      );
      setSelectedSceneForHotspots(updatedSelected || null);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (authLoading || !isAdmin || !projectId) return;

      setIsLoading(true);
      await refreshTour();
      setIsLoading(false);
    };

    fetchData();
  }, [authLoading, isAdmin, projectId]);

  const handleOpenSceneModal = (scene?: Scene) => {
    if (scene) {
      setEditingSceneId(scene.id);
      setSceneForm({
        title: scene.title,
        imageUrl: scene.image_url,
        thumbnailUrl: scene.thumbnail_url || "",
        isDefault: scene.is_default,
        sortOrder: scene.sort_order,
      });
    } else {
      setEditingSceneId(null);
      setSceneForm({
        title: "",
        imageUrl: "",
        thumbnailUrl: "",
        isDefault: false,
        sortOrder: tourData.scenes.length || 0,
      });
    }
    setIsSceneModalOpen(true);
  };

  const handleSaveScene = async () => {
    try {
      if (editingSceneId) {
        if (sceneForm.isDefault) {
          await supabase
            .from("virtual_tour_scenes")
            .update({ is_default: false })
            .eq("property_id", projectId);
        }

        const { error } = await supabase
          .from("virtual_tour_scenes")
          .update({
            title: sceneForm.title,
            image_url: sceneForm.imageUrl,
            thumbnail_url: sceneForm.thumbnailUrl || null,
            is_default: sceneForm.isDefault,
            sort_order: sceneForm.sortOrder,
          })
          .eq("id", editingSceneId);

        if (error) throw error;

        toast({ title: "Sukses", description: "Skena u përditësua." });
      } else {
        if (sceneForm.isDefault) {
          await supabase
            .from("virtual_tour_scenes")
            .update({ is_default: false })
            .eq("property_id", projectId);
        }

        const { error } = await supabase.from("virtual_tour_scenes").insert({
          property_id: projectId,
          title: sceneForm.title,
          image_url: sceneForm.imageUrl,
          thumbnail_url: sceneForm.thumbnailUrl || null,
          is_default: sceneForm.isDefault,
          sort_order: sceneForm.sortOrder,
        });

        if (error) throw error;

        toast({ title: "Sukses", description: "Skena u shtua." });
      }

      setIsSceneModalOpen(false);
      await refreshTour();
    } catch (e: any) {
      toast({
        title: "Gabim",
        description: e.message || "Dështoi ruajtja e skenës.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteScene = async (sceneId: number) => {
    if (!confirm("Jeni të sigurt që doni të fshini këtë skenë?")) return;

    try {
      await supabase.from("virtual_tour_hotspots").delete().eq("scene_id", sceneId);
      await supabase
        .from("virtual_tour_hotspots")
        .delete()
        .eq("to_scene_id", sceneId);

      const { error } = await supabase
        .from("virtual_tour_scenes")
        .delete()
        .eq("id", sceneId);

      if (error) throw error;

      toast({ title: "Sukses", description: "Skena u fshi." });

      if (selectedSceneForHotspots?.id === sceneId) {
        setSelectedSceneForHotspots(null);
      }

      await refreshTour();
    } catch (e: any) {
      toast({
        title: "Gabim",
        description: "Dështoi fshirja e skenës.",
        variant: "destructive",
      });
    }
  };

  const handleSetDefaultScene = async (sceneId: number) => {
    try {
      await supabase
        .from("virtual_tour_scenes")
        .update({ is_default: false })
        .eq("property_id", projectId);

      const { error } = await supabase
        .from("virtual_tour_scenes")
        .update({ is_default: true })
        .eq("id", sceneId);

      if (error) throw error;

      toast({ title: "Sukses", description: "Skena u bë default." });
      await refreshTour();
    } catch (e: any) {
      toast({
        title: "Gabim",
        description: "Dështoi përditësimi.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (selectedSceneForHotspots && containerRef.current) {
      if (viewerRef.current) {
        viewerRef.current.destroy();
      }

      const viewer = new Viewer({
        container: containerRef.current,
        panorama: selectedSceneForHotspots.image_url,
        navbar: ["zoom", "fullscreen"],
        defaultYaw: 0,
        defaultPitch: 0,
        plugins: [[MarkersPlugin, {}]],
      });

      viewerRef.current = viewer;
      const markersPlugin = viewer.getPlugin(MarkersPlugin) as any;

      (selectedSceneForHotspots.hotspots || []).forEach((hs: Hotspot) => {
        markersPlugin.addMarker({
          id: `hs-${hs.id}`,
          longitude: hs.yaw,
          latitude: hs.pitch,
          html: `<div class="w-8 h-8 rounded-full border-4 border-primary bg-black/50 flex items-center justify-center text-white cursor-pointer"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>`,
          tooltip: hs.label || `Lidhur me skenën ${hs.to_scene_id}`,
          style: { cursor: "pointer" },
          data: { id: hs.id },
        });
      });

      viewer.addEventListener("click", ({ data }: any) => {
        setClickCoords({ yaw: data.yaw, pitch: data.pitch });

        if (markersPlugin.getMarker("temp")) {
          markersPlugin.removeMarker("temp");
        }

        markersPlugin.addMarker({
          id: "temp",
          longitude: data.yaw,
          latitude: data.pitch,
          html: `<div class="w-8 h-8 rounded-full bg-red-500 animate-pulse border-2 border-white"></div>`,
          tooltip: "Pika e Re",
        });
      });

      return () => {
        viewer.destroy();
        viewerRef.current = null;
      };
    }
  }, [selectedSceneForHotspots]);

  const handleAddHotspot = async () => {
    if (!selectedSceneForHotspots || !clickCoords || targetSceneId === "") return;

    try {
      const { error } = await supabase.from("virtual_tour_hotspots").insert({
        scene_id: selectedSceneForHotspots.id,
        to_scene_id: Number(targetSceneId),
        yaw: clickCoords.yaw,
        pitch: clickCoords.pitch,
        label: hotspotLabel || null,
      });

      if (error) throw error;

      toast({ title: "Sukses", description: "Hotspot u shtua." });

      setClickCoords(null);
      setTargetSceneId("");
      setHotspotLabel("");

      await refreshTour();
    } catch (e: any) {
      toast({
        title: "Gabim",
        description: "Dështoi shtimi i hotspot-it.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteHotspot = async (hotspotId: number) => {
    if (!confirm("Fshi këtë hotspot?")) return;

    try {
      const { error } = await supabase
        .from("virtual_tour_hotspots")
        .delete()
        .eq("id", hotspotId);

      if (error) throw error;

      toast({ title: "Sukses", description: "Hotspot u fshi." });
      await refreshTour();

      if (viewerRef.current) {
        const markersPlugin = viewerRef.current.getPlugin(MarkersPlugin) as any;
        if (markersPlugin.getMarker(`hs-${hotspotId}`)) {
          markersPlugin.removeMarker(`hs-${hotspotId}`);
        }
      }
    } catch (e: any) {
      toast({
        title: "Gabim",
        description: "Dështoi fshirja.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateScenePosition = async (
    sceneId: number,
    x: number,
    y: number,
  ) => {
    try {
      await supabase
        .from("virtual_tour_scenes")
        .update({ position_x: x, position_y: y })
        .eq("id", sceneId);

      await refreshTour();
    } catch (e) {
      console.error("Position update failed:", e);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-white/5 p-4 md:p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setLocation("/admin")}
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-display text-2xl font-bold text-white leading-none">
              Menaxho Turin Virtual
            </h1>
            <p className="text-muted-foreground text-xs uppercase tracking-widest mt-1">
              {project?.title || "Duke ngarkuar..."}
            </p>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-8 space-y-8">
        <div className="glass-panel p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
            <h2 className="font-display text-xl text-primary font-bold">
              1. Skenat 360°
            </h2>
            <button
              onClick={() => handleOpenSceneModal()}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-bold tracking-widest uppercase text-xs rounded-xl hover:bg-white transition-colors"
            >
              <Plus size={14} /> Shto Skenë të Re
            </button>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground animate-pulse">
              Duke ngarkuar skenat...
            </div>
          ) : tourData.scenes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="mb-4">Nuk keni asnjë skenë të shtuar për këtë tur.</p>
              <button
                onClick={() => handleOpenSceneModal()}
                className="text-primary hover:text-white underline"
              >
                Shto skenën e parë
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {tourData.scenes
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((scene) => (
                  <div
                    key={scene.id}
                    className={`bg-card rounded-xl border overflow-hidden ${
                      selectedSceneForHotspots?.id === scene.id
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-white/10"
                    }`}
                  >
                    <div className="aspect-[2/1] relative bg-black">
                      <img
                        src={scene.thumbnail_url || scene.image_url}
                        alt={scene.title}
                        className="w-full h-full object-cover opacity-80"
                      />
                      {scene.is_default && (
                        <span className="absolute top-2 left-2 px-2 py-0.5 bg-primary text-primary-foreground text-[10px] font-bold uppercase rounded">
                          Default
                        </span>
                      )}
                    </div>

                    <div className="p-4">
                      <h3 className="text-white font-medium truncate mb-4">
                        {scene.title}
                      </h3>

                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => setSelectedSceneForHotspots(scene)}
                          className={`w-full py-2 flex items-center justify-center gap-2 rounded-lg text-sm transition-colors ${
                            selectedSceneForHotspots?.id === scene.id
                              ? "bg-primary/20 text-primary"
                              : "bg-white/5 text-white hover:bg-white/10"
                          }`}
                        >
                          <Crosshair size={14} /> Edito Hotspot-et
                        </button>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleOpenSceneModal(scene)}
                            className="flex-1 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg flex justify-center text-muted-foreground hover:text-white"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteScene(scene.id)}
                            className="flex-1 py-1.5 bg-white/5 hover:bg-destructive/20 rounded-lg flex justify-center text-destructive hover:text-red-400"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        {!scene.is_default && (
                          <button
                            onClick={() => handleSetDefaultScene(scene.id)}
                            className="w-full py-1 text-xs text-muted-foreground hover:text-white underline mt-1"
                          >
                            Vendos si Default
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {selectedSceneForHotspots && (
          <div className="glass-panel p-6 rounded-2xl">
            <h2 className="font-display text-xl text-primary font-bold mb-2 border-b border-white/10 pb-4">
              2. Edito Hotspot-et për: {selectedSceneForHotspots.title}
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-black border border-white/10 rounded-xl overflow-hidden aspect-[16/9] relative">
                  <div ref={containerRef} className="w-full h-full" />
                  <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-md px-3 py-1 rounded text-xs text-white pointer-events-none">
                    Kliko në pamje për të shtuar pikë lidhëse
                  </div>
                </div>

                {clickCoords && (
                  <div className="bg-primary/10 border border-primary/30 p-4 rounded-xl space-y-4">
                    <h3 className="text-white font-medium text-sm">
                      Shto Lidhje të Re
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1 uppercase">
                          Skena Destinacion
                        </label>
                        <select
                          className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                          value={targetSceneId}
                          onChange={(e) => setTargetSceneId(Number(e.target.value))}
                        >
                          <option value="" disabled>
                            Zgjidh skenën...
                          </option>
                          {tourData.scenes
                            .filter((s) => s.id !== selectedSceneForHotspots.id)
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.title}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs text-muted-foreground mb-1 uppercase">
                          Etiketa (Opsionale)
                        </label>
                        <input
                          type="text"
                          className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                          value={hotspotLabel}
                          onChange={(e) => setHotspotLabel(e.target.value)}
                          placeholder="P.sh., Shko në Korridor"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={handleAddHotspot}
                        disabled={!targetSceneId}
                        className="px-4 py-2 bg-primary text-primary-foreground font-bold rounded-lg text-sm disabled:opacity-50"
                      >
                        Ruaj Hotspot
                      </button>
                      <button
                        onClick={() => {
                          setClickCoords(null);
                          if (viewerRef.current) {
                            const markersPlugin = viewerRef.current.getPlugin(
                              MarkersPlugin,
                            ) as any;
                            if (markersPlugin.getMarker("temp")) {
                              markersPlugin.removeMarker("temp");
                            }
                          }
                        }}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm"
                      >
                        Anulo
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <h3 className="text-white font-medium mb-4 pb-2 border-b border-white/10">
                  Hotspot-et ekzistuese
                </h3>

                {(selectedSceneForHotspots.hotspots || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    Nuk ka lidhje nga kjo skenë.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {(selectedSceneForHotspots.hotspots || []).map((hs) => {
                      const target = tourData.scenes.find(
                        (s) => s.id === hs.to_scene_id,
                      );

                      return (
                        <li
                          key={hs.id}
                          className="flex items-center justify-between bg-black/30 p-2.5 rounded-lg border border-white/5"
                        >
                          <div className="overflow-hidden">
                            <span className="block text-sm text-white font-medium truncate">
                              {target?.title || "Skenë e panjohur"}
                            </span>
                            {hs.label && (
                              <span className="block text-xs text-muted-foreground truncate">
                                {hs.label}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteHotspot(hs.id)}
                            className="p-1.5 text-destructive hover:bg-destructive/20 rounded ml-2 shrink-0"
                          >
                            <Trash2 size={14} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="glass-panel p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
            <div>
              <h2 className="font-display text-xl text-primary font-bold">
                3. Plani i Katit (Opsionale)
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Vendosni pikat e skenave në hartë për navigim të shpejtë. Zvarritni
                pikat për t'i pozicionuar.
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-8">
            <div
              className="flex-1 max-w-[600px] aspect-[4/3] bg-white/5 border-2 border-white/10 rounded-xl relative overflow-hidden group"
              style={{
                backgroundImage:
                  "radial-gradient(rgba(255,255,255,0.1) 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center text-white/20 pointer-events-none select-none">
                <MapIcon size={64} />
              </div>

              {tourData.scenes.map((scene) => {
                const x = scene.position_x ?? 50;
                const y = scene.position_y ?? 50;
                const isSet = scene.position_x != null && scene.position_y != null;

                return (
                  <div
                    key={scene.id}
                    className={`absolute w-6 h-6 -ml-3 -mt-3 rounded-full flex items-center justify-center text-[10px] font-bold cursor-move shadow-lg transition-transform hover:scale-125 z-10 ${
                      isSet
                        ? "bg-primary text-primary-foreground"
                        : "bg-white/50 text-black border-2 border-dashed border-white"
                    }`}
                    style={{ left: `${x}%`, top: `${y}%` }}
                    title={scene.title}
                    draggable
                    onDragEnd={(e) => {
                      const rect = (e.target as HTMLElement).parentElement?.getBoundingClientRect();
                      if (rect) {
                        const nx = Math.max(
                          0,
                          Math.min(100, ((e.clientX - rect.left) / rect.width) * 100),
                        );
                        const ny = Math.max(
                          0,
                          Math.min(100, ((e.clientY - rect.top) / rect.height) * 100),
                        );
                        handleUpdateScenePosition(scene.id, nx, ny);
                      }
                    }}
                  >
                    {scene.sort_order + 1}
                  </div>
                );
              })}
            </div>

            <div className="w-full md:w-64 space-y-2">
              <h3 className="text-white font-medium mb-3">Skenat</h3>

              {tourData.scenes
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((scene) => {
                  const isSet =
                    scene.position_x != null && scene.position_y != null;

                  return (
                    <div
                      key={scene.id}
                      className="flex items-center gap-3 bg-black/20 p-2 rounded-lg border border-white/5"
                    >
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          isSet
                            ? "bg-primary text-black"
                            : "bg-white/20 text-white"
                        }`}
                      >
                        {scene.sort_order + 1}
                      </div>
                      <span className="text-sm text-white truncate flex-1">
                        {scene.title}
                      </span>
                    </div>
                  );
                })}

              <div className="mt-4 pt-4 border-t border-white/10 text-xs text-muted-foreground">
                <p>
                  Nëse asnjë pikë nuk është vendosur, harta nuk do të shfaqet tek
                  vizitorët.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Dialog open={isSceneModalOpen} onOpenChange={setIsSceneModalOpen}>
        <DialogContent className="bg-card border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>
              {editingSceneId ? "Edito Skenën" : "Shto Skenë të Re"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                Titulli *
              </label>
              <input
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
                value={sceneForm.title}
                onChange={(e) =>
                  setSceneForm({ ...sceneForm, title: e.target.value })
                }
                placeholder="P.sh., Salla e Ndenjes"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                URL e Imazhit 360° *
              </label>
              <input
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
                value={sceneForm.imageUrl}
                onChange={(e) =>
                  setSceneForm({ ...sceneForm, imageUrl: e.target.value })
                }
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                URL e Thumbnail (Opsionale)
              </label>
              <input
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
                value={sceneForm.thumbnailUrl}
                onChange={(e) =>
                  setSceneForm({ ...sceneForm, thumbnailUrl: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Renditja
                </label>
                <input
                  type="number"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  value={sceneForm.sortOrder}
                  onChange={(e) =>
                    setSceneForm({
                      ...sceneForm,
                      sortOrder: Number(e.target.value),
                    })
                  }
                />
              </div>

              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={sceneForm.isDefault}
                  onChange={(e) =>
                    setSceneForm({
                      ...sceneForm,
                      isDefault: e.target.checked,
                    })
                  }
                  className="accent-primary"
                />
                <label htmlFor="isDefault" className="text-sm cursor-pointer">
                  Skena Fillestare
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-white/10 pt-4">
            <button
              onClick={() => setIsSceneModalOpen(false)}
              className="px-4 py-2 text-sm hover:bg-white/5 rounded-lg"
            >
              Anulo
            </button>
            <button
              onClick={handleSaveScene}
              disabled={!sceneForm.title || !sceneForm.imageUrl}
              className="px-4 py-2 bg-primary text-primary-foreground font-bold text-sm rounded-lg disabled:opacity-50"
            >
              Ruaj Skenën
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit,
  Map as MapIcon,
  Crosshair,
  Star,
  Link2,
  Image as ImageIcon,
  Move,
  Check,
  X,
  LocateFixed,
  ArrowLeftRight,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Viewer } from "@photo-sphere-viewer/core";
import { MarkersPlugin } from "@photo-sphere-viewer/markers-plugin";
import { VirtualTourPlugin } from "@photo-sphere-viewer/virtual-tour-plugin";
import "@photo-sphere-viewer/core/index.css";
import "@photo-sphere-viewer/markers-plugin/index.css";
import "@photo-sphere-viewer/virtual-tour-plugin/index.css";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Scene = {
  id: number;
  property_id: string;
  title: string;
  image_url: string;
  thumbnail_url: string | null;
  is_default: boolean;
  sort_order: number;
  position_x: number | null;
  position_y: number | null;
  hotspots: Hotspot[];
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
  id: string;
  title: string;
};

type HotspotFormState = {
  id: number;
  scene_id: number;
  to_scene_id: number | "";
  label: string;
  yaw: number;
  pitch: number;
};

type PlacementDraft = {
  to_scene_id: number | "";
  label: string;
  yaw: number | null;
  pitch: number | null;
};

const NORMAL_HOTSPOT_HTML = `
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

const EDITING_HOTSPOT_HTML = `
  <div style="
    width: 42px;
    height: 42px;
    border-radius: 9999px;
    background: rgba(239,68,68,0.82);
    border: 3px solid white;
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

const TEMP_HOTSPOT_HTML = `
  <div style="
    width: 26px;
    height: 26px;
    border-radius: 9999px;
    background: #ef4444;
    border: 3px solid white;
    box-shadow: 0 0 0 10px rgba(239,68,68,.18);
    position: relative;
    user-select:none;
  ">
    <div style="
      position:absolute;
      top:50%;
      left:50%;
      width:2px;
      height:30px;
      background:white;
      transform:translate(-50%, -50%);
      opacity:.9;
    "></div>
    <div style="
      position:absolute;
      top:50%;
      left:50%;
      width:30px;
      height:2px;
      background:white;
      transform:translate(-50%, -50%);
      opacity:.9;
    "></div>
  </div>
`;

const toNumber = (value: any, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const toNullableNumber = (value: any) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export default function AdminVirtualTour() {
  const { isAdmin, permissions, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { id } = useParams();
  const projectId = id as string;
  const { toast } = useToast();

  const [project, setProject] = useState<Project | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
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

  const [selectedSceneId, setSelectedSceneId] = useState<number | null>(null);
  const selectedScene = useMemo(() => {
    if (selectedSceneId === null) return null;
    return scenes.find((scene) => Number(scene.id) === Number(selectedSceneId)) || null;
  }, [scenes, selectedSceneId]);

  const [viewerError, setViewerError] = useState("");
  const [isPlacementMode, setIsPlacementMode] = useState(false);
  const [draft, setDraft] = useState<PlacementDraft>({
    to_scene_id: "",
    label: "",
    yaw: null,
    pitch: null,
  });

  const [cameraCenter, setCameraCenter] = useState<{ yaw: number; pitch: number } | null>(null);

  const [isEditHotspotModalOpen, setIsEditHotspotModalOpen] = useState(false);
  const [editingHotspot, setEditingHotspot] = useState<HotspotFormState | null>(null);
  const [isEditingHotspotPlacement, setIsEditingHotspotPlacement] = useState(false);

  const editorContainerRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const editorViewerRef = useRef<Viewer | null>(null);
  const previewViewerRef = useRef<Viewer | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!isAdmin) {
      setLocation("/admin/login");
      return;
    }

    if (!permissions.canManageVirtualTours) {
      setLocation("/admin");
    }
  }, [authLoading, isAdmin, permissions, setLocation]);

  const resetDraft = useCallback((keepTargetAndLabel = true) => {
    setDraft((prev) => ({
      to_scene_id: keepTargetAndLabel ? prev.to_scene_id : "",
      label: keepTargetAndLabel ? prev.label : "",
      yaw: null,
      pitch: null,
    }));
  }, []);

  const refreshTour = useCallback(async () => {
    if (!projectId) return;

    const currentSelectedSceneId = selectedSceneId;

    const { data: projectData, error: projectError } = await supabase
      .from("properties")
      .select("id, title")
      .eq("id", projectId)
      .single();

    if (projectError) {
      toast({
        title: "Gabim",
        description: "Projekti nuk u gjet.",
        variant: "destructive",
      });
      return;
    }

    const { data: scenesData, error: scenesError } = await supabase
      .from("virtual_tour_scenes")
      .select("*")
      .eq("property_id", projectId)
      .order("sort_order", { ascending: true });

    if (scenesError) {
      toast({
        title: "Gabim",
        description: scenesError.message,
        variant: "destructive",
      });
      return;
    }

    const sceneIds = (scenesData || []).map((scene) => toNumber(scene.id));
    const hotspotsMap = new Map<number, Hotspot[]>();

    if (sceneIds.length > 0) {
      const { data: hotspotsData, error: hotspotsError } = await supabase
        .from("virtual_tour_hotspots")
        .select("*")
        .in("scene_id", sceneIds);

      if (hotspotsError) {
        toast({
          title: "Gabim",
          description: hotspotsError.message,
          variant: "destructive",
        });
      } else {
        for (const hotspot of hotspotsData || []) {
          const normalizedHotspot: Hotspot = {
            id: toNumber(hotspot.id),
            scene_id: toNumber(hotspot.scene_id),
            to_scene_id: toNumber(hotspot.to_scene_id),
            yaw: Number(hotspot.yaw),
            pitch: Number(hotspot.pitch),
            label: hotspot.label || null,
          };

          if (!hotspotsMap.has(normalizedHotspot.scene_id)) {
            hotspotsMap.set(normalizedHotspot.scene_id, []);
          }
          hotspotsMap.get(normalizedHotspot.scene_id)!.push(normalizedHotspot);
        }
      }
    }

    const normalizedScenes: Scene[] = (scenesData || []).map((scene) => {
      const normalizedId = toNumber(scene.id);

      return {
        id: normalizedId,
        property_id: scene.property_id,
        title: scene.title || "",
        image_url: (scene.image_url || "").trim(),
        thumbnail_url: scene.thumbnail_url ? String(scene.thumbnail_url).trim() : null,
        is_default: !!scene.is_default,
        sort_order: toNumber(scene.sort_order, 0),
        position_x: toNullableNumber(scene.position_x),
        position_y: toNullableNumber(scene.position_y),
        hotspots: hotspotsMap.get(normalizedId) || [],
      };
    });

    setProject(projectData || null);
    setScenes(normalizedScenes);

    if (normalizedScenes.length === 0) {
      setSelectedSceneId(null);
      return;
    }

    if (currentSelectedSceneId !== null) {
      const existingSelected = normalizedScenes.find(
        (scene) => Number(scene.id) === Number(currentSelectedSceneId),
      );
      if (existingSelected) {
        setSelectedSceneId(Number(existingSelected.id));
        return;
      }
    }

    const defaultScene =
      normalizedScenes.find((scene) => scene.is_default) || normalizedScenes[0];
    setSelectedSceneId(Number(defaultScene.id));
  }, [projectId, selectedSceneId, toast]);

  useEffect(() => {
    const load = async () => {
      if (authLoading || !isAdmin || !projectId) return;
      setIsLoading(true);
      await refreshTour();
      setIsLoading(false);
    };

    load();
  }, [authLoading, isAdmin, projectId, refreshTour]);

  useEffect(() => {
    setViewerError("");
    setIsPlacementMode(false);
    resetDraft(false);
    setEditingHotspot(null);
    setIsEditingHotspotPlacement(false);
    setIsEditHotspotModalOpen(false);
    setCameraCenter(null);
  }, [selectedSceneId, resetDraft]);

  const openCreateScene = () => {
    setEditingSceneId(null);
    setSceneForm({
      title: "",
      imageUrl: "",
      thumbnailUrl: "",
      isDefault: scenes.length === 0,
      sortOrder: scenes.length,
    });
    setIsSceneModalOpen(true);
  };

  const openEditScene = (scene: Scene) => {
    setEditingSceneId(scene.id);
    setSceneForm({
      title: scene.title,
      imageUrl: scene.image_url,
      thumbnailUrl: scene.thumbnail_url || "",
      isDefault: scene.is_default,
      sortOrder: scene.sort_order,
    });
    setIsSceneModalOpen(true);
  };

  const openEditHotspot = (hotspot: Hotspot) => {
    setEditingHotspot({
      id: hotspot.id,
      scene_id: hotspot.scene_id,
      to_scene_id: hotspot.to_scene_id,
      label: hotspot.label || "",
      yaw: hotspot.yaw,
      pitch: hotspot.pitch,
    });
    setIsEditingHotspotPlacement(false);
    setIsPlacementMode(false);
    resetDraft(false);
    setIsEditHotspotModalOpen(true);
  };

  const handleSaveScene = async () => {
    try {
      if (!sceneForm.title.trim() || !sceneForm.imageUrl.trim()) {
        toast({
          title: "Gabim",
          description: "Titulli dhe URL e imazhit janë të detyrueshme.",
          variant: "destructive",
        });
        return;
      }

      if (sceneForm.isDefault) {
        await supabase
          .from("virtual_tour_scenes")
          .update({ is_default: false })
          .eq("property_id", projectId);
      }

      if (editingSceneId) {
        const { error } = await supabase
          .from("virtual_tour_scenes")
          .update({
            title: sceneForm.title.trim(),
            image_url: sceneForm.imageUrl.trim(),
            thumbnail_url: sceneForm.thumbnailUrl.trim() || null,
            is_default: sceneForm.isDefault,
            sort_order: Number(sceneForm.sortOrder) || 0,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingSceneId);

        if (error) throw error;

        toast({ title: "Sukses", description: "Skena u përditësua." });
      } else {
        const { error } = await supabase.from("virtual_tour_scenes").insert({
          property_id: projectId,
          title: sceneForm.title.trim(),
          image_url: sceneForm.imageUrl.trim(),
          thumbnail_url: sceneForm.thumbnailUrl.trim() || null,
          is_default: sceneForm.isDefault,
          sort_order: Number(sceneForm.sortOrder) || 0,
        });

        if (error) throw error;

        toast({ title: "Sukses", description: "Skena u shtua." });
      }

      setIsSceneModalOpen(false);
      await refreshTour();
    } catch (error: any) {
      toast({
        title: "Gabim",
        description: error.message || "Ruajtja dështoi.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteScene = async (sceneId: number) => {
    if (!confirm("A dëshironi ta fshini këtë skenë?")) return;

    try {
      await supabase.from("virtual_tour_hotspots").delete().eq("scene_id", sceneId);
      await supabase.from("virtual_tour_hotspots").delete().eq("to_scene_id", sceneId);

      const { error } = await supabase
        .from("virtual_tour_scenes")
        .delete()
        .eq("id", sceneId);

      if (error) throw error;

      toast({ title: "Sukses", description: "Skena u fshi." });
      await refreshTour();
    } catch (error: any) {
      toast({
        title: "Gabim",
        description: error.message || "Fshirja dështoi.",
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

      toast({ title: "Sukses", description: "Skena fillestare u ndryshua." });
      await refreshTour();
    } catch (error: any) {
      toast({
        title: "Gabim",
        description: error.message || "Ndryshimi dështoi.",
        variant: "destructive",
      });
    }
  };

  const handleStartPlacement = () => {
    if (!selectedScene) {
      toast({
        title: "Gabim",
        description: "Zgjidh fillimisht një skenë.",
        variant: "destructive",
      });
      return;
    }

    if (draft.to_scene_id === "") {
      toast({
        title: "Gabim",
        description: "Zgjidh skenën destinacion para vendosjes së hotspot-it.",
        variant: "destructive",
      });
      return;
    }

    setEditingHotspot(null);
    setIsEditHotspotModalOpen(false);
    setIsEditingHotspotPlacement(false);
    setIsPlacementMode(true);
    setDraft((prev) => ({ ...prev, yaw: null, pitch: null }));

    toast({
      title: "Placement mode aktiv",
      description:
        "Rrotullo panoramën derisa vendi i saktë të jetë në qendër, pastaj kliko “Vendose në Qendër”.",
    });
  };

  const handleStopPlacement = () => {
    setIsPlacementMode(false);
    setDraft((prev) => ({ ...prev, yaw: null, pitch: null }));
  };

  const handlePlaceHotspotAtCenter = () => {
    if (!isPlacementMode) {
      toast({
        title: "Gabim",
        description: "Aktivizo placement mode fillimisht.",
        variant: "destructive",
      });
      return;
    }

    if (!cameraCenter) {
      toast({
        title: "Gabim",
        description: "Pozicioni aktual i kamerës nuk u lexua.",
        variant: "destructive",
      });
      return;
    }

    setDraft((prev) => ({
      ...prev,
      yaw: cameraCenter.yaw,
      pitch: cameraCenter.pitch,
    }));

    toast({
      title: "Pozicioni u vendos",
      description: "Hotspot-i u vendos në qendrën aktuale të pamjes.",
    });
  };

  const nudgeDraftPosition = (yawDelta: number, pitchDelta: number) => {
    setDraft((prev) => {
      if (prev.yaw == null || prev.pitch == null) return prev;

      return {
        ...prev,
        yaw: prev.yaw + yawDelta,
        pitch: prev.pitch + pitchDelta,
      };
    });
  };

  const handleStartEditHotspotPlacement = () => {
    if (!editingHotspot) return;

    if (!cameraCenter) {
      toast({
        title: "Gabim",
        description: "Pozicioni aktual i kamerës nuk u lexua.",
        variant: "destructive",
      });
      return;
    }

    setIsPlacementMode(false);
    setIsEditingHotspotPlacement(true);

    setEditingHotspot((prev) =>
      prev
        ? {
            ...prev,
            yaw: cameraCenter.yaw,
            pitch: cameraCenter.pitch,
          }
        : prev,
    );

    toast({
      title: "Pozicioni u vendos",
      description:
        "Hotspot-i u zhvendos te qendra aktuale e pamjes. Mund ta rafinosh duke lëvizur panoramën dhe duke klikuar sërish butonin.",
    });
  };

  const nudgeEditingHotspotPosition = (yawDelta: number, pitchDelta: number) => {
    setEditingHotspot((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        yaw: prev.yaw + yawDelta,
        pitch: prev.pitch + pitchDelta,
      };
    });
  };

  const handlePlaceEditedHotspotAtCenter = () => {
    if (!editingHotspot) return;

    if (!cameraCenter) {
      toast({
        title: "Gabim",
        description: "Pozicioni aktual i kamerës nuk u lexua.",
        variant: "destructive",
      });
      return;
    }

    setEditingHotspot((prev) =>
      prev
        ? {
            ...prev,
            yaw: cameraCenter.yaw,
            pitch: cameraCenter.pitch,
          }
        : prev,
    );

    setIsEditingHotspotPlacement(true);

    toast({
      title: "Pozicioni u përditësua",
      description: "Pozicioni i ri u vendos në qendrën aktuale të pamjes.",
    });
  };

  const handleAddHotspot = async () => {
    if (!selectedScene || draft.to_scene_id === "" || draft.yaw === null || draft.pitch === null) {
      toast({
        title: "Gabim",
        description: "Zgjidh destinacionin dhe vendose pozicionin e hotspot-it.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: insertedHotspot, error } = await supabase
        .from("virtual_tour_hotspots")
        .insert({
          scene_id: selectedScene.id,
          to_scene_id: Number(draft.to_scene_id),
          yaw: draft.yaw,
          pitch: draft.pitch,
          label: draft.label.trim() || null,
        })
        .select("*")
        .single();

      if (error) throw error;

      const normalizedInsertedHotspot: Hotspot = {
        id: toNumber(insertedHotspot.id),
        scene_id: toNumber(insertedHotspot.scene_id),
        to_scene_id: toNumber(insertedHotspot.to_scene_id),
        yaw: Number(insertedHotspot.yaw),
        pitch: Number(insertedHotspot.pitch),
        label: insertedHotspot.label || null,
      };

      setScenes((prev) =>
        prev.map((scene) =>
          scene.id === selectedScene.id
            ? {
                ...scene,
                hotspots: [...scene.hotspots, normalizedInsertedHotspot],
              }
            : scene,
        ),
      );

      setDraft((prev) => ({
        ...prev,
        yaw: null,
        pitch: null,
      }));

      toast({
        title: "Hotspot u ruajt",
        description:
          "Mund të vazhdosh menjëherë me hotspot tjetër në të njëjtën foto.",
      });
    } catch (error: any) {
      toast({
        title: "Gabim",
        description: error.message || "Shtimi i hotspot-it dështoi.",
        variant: "destructive",
      });
    }
  };

  const handleSaveEditedHotspot = async () => {
    if (!editingHotspot || editingHotspot.to_scene_id === "") {
      toast({
        title: "Gabim",
        description: "Zgjidh skenën destinacion.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("virtual_tour_hotspots")
        .update({
          to_scene_id: Number(editingHotspot.to_scene_id),
          label: editingHotspot.label.trim() || null,
          yaw: editingHotspot.yaw,
          pitch: editingHotspot.pitch,
        })
        .eq("id", editingHotspot.id);

      if (error) throw error;

      setScenes((prev) =>
        prev.map((scene) =>
          scene.id === selectedSceneId
            ? {
                ...scene,
                hotspots: scene.hotspots.map((hotspot) =>
                  hotspot.id === editingHotspot.id
                    ? {
                        ...hotspot,
                        to_scene_id: Number(editingHotspot.to_scene_id),
                        label: editingHotspot.label.trim() || null,
                        yaw: editingHotspot.yaw,
                        pitch: editingHotspot.pitch,
                      }
                    : hotspot,
                ),
              }
            : scene,
        ),
      );

      setIsEditHotspotModalOpen(false);
      setEditingHotspot(null);
      setIsEditingHotspotPlacement(false);

      toast({
        title: "Sukses",
        description: "Hotspot-i u përditësua.",
      });
    } catch (error: any) {
      toast({
        title: "Gabim",
        description: error.message || "Përditësimi i hotspot-it dështoi.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteHotspot = async (hotspotId: number) => {
    if (!confirm("A dëshironi ta fshini këtë hotspot?")) return;

    try {
      const currentSceneId = selectedSceneId;

      const { error } = await supabase
        .from("virtual_tour_hotspots")
        .delete()
        .eq("id", hotspotId);

      if (error) throw error;

      setScenes((prev) =>
        prev.map((scene) =>
          scene.id === currentSceneId
            ? {
                ...scene,
                hotspots: scene.hotspots.filter((hotspot) => hotspot.id !== hotspotId),
              }
            : scene,
        ),
      );

      if (editingHotspot?.id === hotspotId) {
        setEditingHotspot(null);
        setIsEditHotspotModalOpen(false);
        setIsEditingHotspotPlacement(false);
      }

      toast({
        title: "Sukses",
        description: "Hotspot-i u fshi.",
      });
    } catch (error: any) {
      toast({
        title: "Gabim",
        description: error.message || "Fshirja dështoi.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateScenePosition = async (sceneId: number, x: number, y: number) => {
    try {
      const { error } = await supabase
        .from("virtual_tour_scenes")
        .update({
          position_x: x,
          position_y: y,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sceneId);

      if (error) throw error;
      await refreshTour();
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (
      !selectedScene ||
      !editorContainerRef.current ||
      !selectedScene.image_url ||
      String(selectedScene.image_url).trim() === ""
    ) {
      return;
    }

    setViewerError("");

    if (editorViewerRef.current) {
      editorViewerRef.current.destroy();
      editorViewerRef.current = null;
    }

let viewer: Viewer | null = null;
let updateCameraCenterHandler:
  | ((event: { position: { yaw: number; pitch: number } }) => void)
  | null = null;
let readyHandler: (() => void) | null = null;

    try {
      viewer = new Viewer({
        container: editorContainerRef.current,
        panorama: selectedScene.image_url,
        navbar: ["zoom", "move", "fullscreen"],
        defaultYaw: 0,
        defaultPitch: 0,
        plugins: [[MarkersPlugin, {}]],
      });

      editorViewerRef.current = viewer;
      const markersPlugin = viewer.getPlugin(MarkersPlugin) as any;

      const existingMarkers = markersPlugin.getMarkers?.() || [];
      existingMarkers.forEach((marker: any) => {
        markersPlugin.removeMarker(marker.id);
      });

      selectedScene.hotspots.forEach((hotspot) => {
        const target = scenes.find((s) => Number(s.id) === Number(hotspot.to_scene_id));
        const isEditingThis = editingHotspot?.id === hotspot.id;

        markersPlugin.addMarker({
          id: `hs-${hotspot.id}`,
          longitude: isEditingThis ? editingHotspot!.yaw : hotspot.yaw,
          latitude: isEditingThis ? editingHotspot!.pitch : hotspot.pitch,
          html: isEditingThis ? EDITING_HOTSPOT_HTML : NORMAL_HOTSPOT_HTML,
          tooltip: hotspot.label || target?.title || "Lidhje",
        });
      });

      if (isPlacementMode && draft.yaw !== null && draft.pitch !== null) {
        markersPlugin.addMarker({
          id: "temp-new-hotspot",
          longitude: draft.yaw,
          latitude: draft.pitch,
          html: TEMP_HOTSPOT_HTML,
          tooltip: "Pozicioni i hotspot-it të ri",
        });
      }

      if (isEditingHotspotPlacement && editingHotspot) {
        markersPlugin.addMarker({
          id: "temp-edit-hotspot",
          longitude: editingHotspot.yaw,
          latitude: editingHotspot.pitch,
          html: TEMP_HOTSPOT_HTML,
          tooltip: "Pozicioni i ri i hotspot-it",
        });
      }

      readyHandler = () => {
        try {
          const position = viewer?.getPosition();
          if (!position) return;

          setCameraCenter({
            yaw: position.yaw,
            pitch: position.pitch,
          });
        } catch (error) {
          console.error("Initial camera position read error:", error);
        }
      };

      updateCameraCenterHandler = ({ position }) => {
        if (!position) return;

        setCameraCenter({
          yaw: position.yaw,
          pitch: position.pitch,
        });
      };

      viewer.addEventListener("ready", readyHandler, { once: true });
      viewer.addEventListener("position-updated", updateCameraCenterHandler);

      updateCameraCenterHandler();
      viewer.addEventListener("position-updated", updateCameraCenterHandler);

      viewer.addEventListener("panorama-error", () => {
        setViewerError(
          "Kjo panoramë nuk mund të ngarkohet. Mund ta editosh URL-në ose ta fshish skenën.",
        );
      });
    } catch (error) {
      console.error("Viewer init error:", error);
      setViewerError(
        "Kjo panoramë nuk mund të ngarkohet. Mund ta editosh URL-në ose ta fshish skenën.",
      );
    }

    return () => {
       if (viewer && updateCameraCenterHandler) {
        viewer.removeEventListener("position-updated", updateCameraCenterHandler);
      }

      if (viewer && readyHandler) {
        viewer.removeEventListener("ready", readyHandler);
      }

      if (viewer) {
        viewer.destroy();
      }

      editorViewerRef.current = null;
    };
  }, [
    selectedScene,
    scenes,
    draft,
    isPlacementMode,
    editingHotspot,
    isEditingHotspotPlacement,
  ]);

  const virtualTourNodes = useMemo(() => {
    const validScenes = scenes.filter(
      (scene) => scene.image_url && String(scene.image_url).trim() !== "",
    );

    const validSceneIds = new Set(validScenes.map((scene) => Number(scene.id)));

    return validScenes.map((scene) => ({
      id: String(scene.id),
      panorama: scene.image_url,
      name: scene.title,
      thumbnail: scene.thumbnail_url || scene.image_url,
      links: scene.hotspots
        .filter((hotspot) => validSceneIds.has(Number(hotspot.to_scene_id)))
        .map((hotspot) => ({
          nodeId: String(hotspot.to_scene_id),
          position: {
            yaw: hotspot.yaw,
            pitch: hotspot.pitch,
          },
          name:
            hotspot.label ||
            validScenes.find((target) => Number(target.id) === Number(hotspot.to_scene_id))
              ?.title ||
            "Lidhje",
        })),
    }));
  }, [scenes]);

  useEffect(() => {
    if (!previewContainerRef.current || virtualTourNodes.length === 0) return;

    if (previewViewerRef.current) {
      previewViewerRef.current.destroy();
      previewViewerRef.current = null;
    }

    const validNodeIds = new Set(virtualTourNodes.map((node) => node.id));

    const defaultScene =
      scenes.find(
        (scene) =>
          scene.is_default &&
          scene.image_url &&
          String(scene.image_url).trim() !== "" &&
          validNodeIds.has(String(scene.id)),
      ) ||
      scenes.find(
        (scene) =>
          scene.image_url &&
          String(scene.image_url).trim() !== "" &&
          validNodeIds.has(String(scene.id)),
      );

    if (!defaultScene) return;

    let viewer: Viewer | null = null;

    try {
      viewer = new Viewer({
        container: previewContainerRef.current,
        navbar: ["zoom", "move", "fullscreen"],
        plugins: [
          [
            VirtualTourPlugin,
            {
              positionMode: "manual",
              renderMode: "3d",
              startNodeId: String(defaultScene.id),
              nodes: virtualTourNodes,
            },
          ],
        ],
      });

      previewViewerRef.current = viewer;
    } catch (error) {
      console.error("Preview viewer init error:", error);
    }

    return () => {
      if (viewer) {
        viewer.destroy();
      }
      previewViewerRef.current = null;
    };
  }, [virtualTourNodes, scenes]);

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
            <div>
              <h2 className="font-display text-xl text-primary font-bold">1. Skenat 360°</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Shto panoramat, renditjen dhe skenën fillestare.
              </p>
            </div>

            <button
              onClick={openCreateScene}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-bold tracking-widest uppercase text-xs rounded-xl hover:bg-white transition-colors"
            >
              <Plus size={14} /> Shto Skenë
            </button>
          </div>

          {isLoading ? (
            <div className="text-center py-10 text-muted-foreground">Duke ngarkuar...</div>
          ) : scenes.length === 0 ? (
            <div className="text-center py-14 text-muted-foreground">
              <p>Nuk ka skena ende për këtë projekt.</p>
              <button onClick={openCreateScene} className="mt-3 text-primary underline">
                Shto skenën e parë
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {scenes
                .slice()
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((scene) => (
                  <div
                    key={String(scene.id)}
                    className={`rounded-2xl overflow-hidden border bg-card ${
                      selectedSceneId === scene.id
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-white/10"
                    }`}
                  >
                    <div className="aspect-[2/1] bg-black relative">
                      <img
                        src={scene.thumbnail_url || scene.image_url}
                        alt={scene.title}
                        className="w-full h-full object-cover opacity-90"
                      />
                      {scene.is_default && (
                        <span className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-primary text-black text-[10px] font-bold uppercase">
                          Default
                        </span>
                      )}
                    </div>

                    <div className="p-4 space-y-3">
                      <div>
                        <h3 className="text-white font-medium truncate">{scene.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Renditja: {scene.sort_order}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Hotspot-e: {scene.hotspots.length}
                        </p>
                      </div>

                      <button
                        onClick={() => setSelectedSceneId(Number(scene.id))}
                        className={`w-full py-2 rounded-xl text-sm flex items-center justify-center gap-2 ${
                          selectedSceneId === scene.id
                            ? "bg-primary/15 text-primary"
                            : "bg-white/5 text-white hover:bg-white/10"
                        }`}
                      >
                        <Crosshair size={14} /> Edito Hotspot-et
                      </button>

                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => openEditScene(scene)}
                          className="py-2 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white flex justify-center"
                          title="Edito skenën"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleSetDefaultScene(scene.id)}
                          className="py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary flex justify-center"
                          title="Vendos si default"
                        >
                          <Star size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteScene(scene.id)}
                          className="py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 flex justify-center"
                          title="Fshi skenën"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {selectedScene && (
          <div className="glass-panel p-6 rounded-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
              <div>
                <h2 className="font-display text-xl text-primary font-bold">
                  2. Editor Profesional i Hotspot-eve
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Një foto mund të ketë sa hotspot-e të duash. Zgjidh destinacionin, aktivizo placement mode,
                  rrotullo panoramën dhe vendose hotspot-in në qendrën e pamjes.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                {viewerError && (
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                    {viewerError}
                  </div>
                )}

                <div className="aspect-[16/9] rounded-2xl overflow-hidden border border-white/10 bg-black relative">
                  <div ref={editorContainerRef} className="w-full h-full" />

                  <div className="absolute top-3 left-3 px-3 py-1.5 rounded-xl bg-black/50 text-xs text-white/90 pointer-events-none backdrop-blur-md">
                    {isEditingHotspotPlacement
                      ? "Rrotullo panoramën dhe kliko “Vendose në Qendër” për pozicionin e ri"
                      : isPlacementMode
                      ? draft.yaw !== null && draft.pitch !== null
                        ? "Pozicioni u zgjodh. Mund ta rafinosh ose ta ruash"
                        : "Placement mode aktiv. Rrotullo panoramën dhe kliko “Vendose në Qendër”"
                      : "Zgjidh target-in dhe aktivizo placement mode"}
                  </div>

                  <div className="absolute top-3 right-3 px-3 py-1.5 rounded-xl bg-black/50 text-xs text-white/90 backdrop-blur-md">
                    Qendra aktuale:{" "}
                    {cameraCenter
                      ? `${cameraCenter.yaw.toFixed(3)} / ${cameraCenter.pitch.toFixed(3)}`
                      : "Duke lexuar..."}
                  </div>
                </div>

                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-4">
                  <h3 className="text-white font-medium flex items-center gap-2">
                    <Link2 size={16} /> Shto hotspot të ri
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-2">
                        Skena destinacion
                      </label>
                      <select
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-3 text-white"
                        value={draft.to_scene_id}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            to_scene_id: e.target.value ? Number(e.target.value) : "",
                          }))
                        }
                      >
                        <option value="">Zgjidh skenën</option>
                        {scenes
                          .filter((scene) => scene.id !== selectedScene.id)
                          .map((scene) => (
                            <option key={String(scene.id)} value={scene.id}>
                              {scene.title}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-2">
                        Etiketa
                      </label>
                      <input
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-3 text-white"
                        value={draft.label}
                        onChange={(e) =>
                          setDraft((prev) => ({ ...prev, label: e.target.value }))
                        }
                        placeholder="P.sh. Shko në korridor"
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-white/80">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <span>
                        <strong className="text-white">Status:</strong>{" "}
                        {isPlacementMode
                          ? draft.yaw !== null && draft.pitch !== null
                            ? "Gati për ruajtje"
                            : "Rrotullo panoramën dhe vendose në qendër"
                          : "Joaktiv"}
                      </span>
                      <span>
                        <strong className="text-white">Yaw/Pitch:</strong>{" "}
                        {draft.yaw !== null && draft.pitch !== null
                          ? `${draft.yaw.toFixed(3)} / ${draft.pitch.toFixed(3)}`
                          : "Pa zgjedhur"}
                      </span>
                      <span>
                        <strong className="text-white">Target:</strong>{" "}
                        {draft.to_scene_id === ""
                          ? "Pa zgjedhur"
                          : scenes.find((scene) => scene.id === Number(draft.to_scene_id))?.title ||
                            "Pa zgjedhur"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {!isPlacementMode ? (
                      <button
                        onClick={handleStartPlacement}
                        className="px-4 py-2 rounded-xl bg-primary text-black font-semibold"
                      >
                        Aktivizo Placement Mode
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={handlePlaceHotspotAtCenter}
                          className="px-4 py-2 rounded-xl bg-primary text-black font-semibold inline-flex items-center gap-2"
                        >
                          <LocateFixed size={16} />
                          Vendose në Qendër
                        </button>

                        <button
                          onClick={handleAddHotspot}
                          disabled={draft.yaw === null || draft.pitch === null}
                          className={`px-4 py-2 rounded-xl font-semibold inline-flex items-center gap-2 ${
                            draft.yaw !== null && draft.pitch !== null
                              ? "bg-primary text-black"
                              : "bg-white/10 text-white/50 cursor-not-allowed"
                          }`}
                        >
                          <Check size={16} />
                          Ruaj Hotspot
                        </button>

                        <button
                          onClick={() => resetDraft(true)}
                          className="px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/15 inline-flex items-center gap-2"
                        >
                          <X size={16} />
                          Pastro Pozicionin
                        </button>

                        <button
                          onClick={handleStopPlacement}
                          className="px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/15"
                        >
                          Dil nga Placement Mode
                        </button>
                      </>
                    )}
                  </div>

                  {isPlacementMode && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => nudgeDraftPosition(-0.02, 0)}
                        className="px-3 py-2 rounded-xl bg-white/10 text-white hover:bg-white/15 inline-flex items-center gap-2"
                      >
                        <ArrowLeftRight size={14} />
                        Majtas
                      </button>
                      <button
                        type="button"
                        onClick={() => nudgeDraftPosition(0.02, 0)}
                        className="px-3 py-2 rounded-xl bg-white/10 text-white hover:bg-white/15"
                      >
                        Djathtas
                      </button>
                      <button
                        type="button"
                        onClick={() => nudgeDraftPosition(0, -0.02)}
                        className="px-3 py-2 rounded-xl bg-white/10 text-white hover:bg-white/15 inline-flex items-center gap-2"
                      >
                        <ArrowUp size={14} />
                        Lart
                      </button>
                      <button
                        type="button"
                        onClick={() => nudgeDraftPosition(0, 0.02)}
                        className="px-3 py-2 rounded-xl bg-white/10 text-white hover:bg-white/15 inline-flex items-center gap-2"
                      >
                        <ArrowDown size={14} />
                        Poshtë
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h3 className="text-white font-medium mb-4">Hotspot-et ekzistuese</h3>

                {selectedScene.hotspots.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    Nuk ka hotspot-e për këtë skenë.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {[...selectedScene.hotspots]
                      .sort((a, b) => b.id - a.id)
                      .map((hotspot) => {
                        const target = scenes.find(
                          (scene) => scene.id === hotspot.to_scene_id,
                        );

                        return (
                          <div
                            key={String(hotspot.id)}
                            className="rounded-xl border border-white/5 bg-black/25 p-3 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="text-sm text-white font-medium truncate">
                                {target?.title || "Skenë e panjohur"}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {hotspot.label || "Pa etiketë"}
                              </div>
                              <div className="text-[11px] text-white/50 mt-1">
                                yaw {hotspot.yaw.toFixed(3)} / pitch {hotspot.pitch.toFixed(3)}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openEditHotspot(hotspot)}
                                className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary"
                                title="Edito hotspot-in"
                              >
                                <Edit size={14} />
                              </button>

                              <button
                                onClick={() => handleDeleteHotspot(hotspot.id)}
                                className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400"
                                title="Fshi hotspot-in"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="glass-panel p-6 rounded-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
            <div>
              <h2 className="font-display text-xl text-primary font-bold">3. Preview i Turit</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Kjo është eksperienca finale e navigimit ndërmjet skenave.
              </p>
            </div>
          </div>

          {scenes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Shto së pari të paktën një skenë.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="aspect-[16/9] rounded-2xl overflow-hidden border border-white/10 bg-black">
                <div ref={previewContainerRef} className="w-full h-full" />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {scenes
                  .slice()
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((scene) => (
                    <div
                      key={String(scene.id)}
                      className="rounded-xl overflow-hidden border border-white/10 bg-white/5"
                    >
                      <div className="aspect-[4/3] bg-black">
                        <img
                          src={scene.thumbnail_url || scene.image_url}
                          alt={scene.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-2">
                        <p className="text-xs text-white truncate">{scene.title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {scene.hotspots.length} hotspot-e
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        <div className="glass-panel p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
            <div>
              <h2 className="font-display text-xl text-primary font-bold">
                4. Plani i Katit (Opsionale)
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Zvarrit pikat për të vendosur skenat në hartë.
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-8">
            <div
              className="flex-1 max-w-[700px] aspect-[4/3] bg-white/5 border-2 border-white/10 rounded-2xl relative overflow-hidden"
              style={{
                backgroundImage:
                  "radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center text-white/15 pointer-events-none select-none">
                <MapIcon size={70} />
              </div>

              {scenes.map((scene) => {
                const x = scene.position_x ?? 50;
                const y = scene.position_y ?? 50;
                const isSet = scene.position_x != null && scene.position_y != null;

                return (
                  <div
                    key={String(scene.id)}
                    draggable
                    title={scene.title}
                    className={`absolute w-7 h-7 -ml-3.5 -mt-3.5 rounded-full flex items-center justify-center text-[10px] font-bold cursor-move shadow-lg z-10 ${
                      isSet
                        ? "bg-primary text-black"
                        : "bg-white/50 text-black border-2 border-dashed border-white"
                    }`}
                    style={{ left: `${x}%`, top: `${y}%` }}
                    onDragEnd={(e) => {
                      const rect = (
                        e.currentTarget.parentElement as HTMLElement
                      )?.getBoundingClientRect();
                      if (!rect) return;

                      const nx = Math.max(
                        0,
                        Math.min(100, ((e.clientX - rect.left) / rect.width) * 100),
                      );
                      const ny = Math.max(
                        0,
                        Math.min(100, ((e.clientY - rect.top) / rect.height) * 100),
                      );
                      handleUpdateScenePosition(scene.id, nx, ny);
                    }}
                  >
                    {scene.sort_order + 1}
                  </div>
                );
              })}
            </div>

            <div className="w-full md:w-72 rounded-2xl border border-white/10 bg-white/5 p-4">
              <h3 className="text-white font-medium mb-4">Skenat</h3>
              <div className="space-y-3">
                {scenes
                  .slice()
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((scene) => (
                    <div
                      key={String(scene.id)}
                      className="flex items-center gap-3 rounded-xl bg-black/20 p-2.5 border border-white/5"
                    >
                      <div className="w-8 h-8 rounded-lg overflow-hidden bg-black shrink-0">
                        {scene.thumbnail_url || scene.image_url ? (
                          <img
                            src={scene.thumbnail_url || scene.image_url}
                            alt={scene.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/30">
                            <ImageIcon size={14} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{scene.title}</p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Move size={11} />{" "}
                          {scene.position_x != null && scene.position_y != null
                            ? "Pozicionuar"
                            : "Pa pozicion"}
                        </p>
                      </div>
                    </div>
                  ))}
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
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-3 text-sm focus:border-primary focus:outline-none"
                value={sceneForm.title}
                onChange={(e) =>
                  setSceneForm((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="P.sh. Salla e ndenjes"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                URL e panoramës 360° *
              </label>
              <input
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-3 text-sm focus:border-primary focus:outline-none"
                value={sceneForm.imageUrl}
                onChange={(e) =>
                  setSceneForm((prev) => ({ ...prev, imageUrl: e.target.value }))
                }
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                Thumbnail URL
              </label>
              <input
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-3 text-sm focus:border-primary focus:outline-none"
                value={sceneForm.thumbnailUrl}
                onChange={(e) =>
                  setSceneForm((prev) => ({ ...prev, thumbnailUrl: e.target.value }))
                }
                placeholder="https://..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Renditja
                </label>
                <input
                  type="number"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-3 text-sm focus:border-primary focus:outline-none"
                  value={sceneForm.sortOrder}
                  onChange={(e) =>
                    setSceneForm((prev) => ({
                      ...prev,
                      sortOrder: Number(e.target.value),
                    }))
                  }
                />
              </div>

              <div className="flex items-center gap-2 pt-8">
                <input
                  id="scene-default"
                  type="checkbox"
                  checked={sceneForm.isDefault}
                  onChange={(e) =>
                    setSceneForm((prev) => ({
                      ...prev,
                      isDefault: e.target.checked,
                    }))
                  }
                  className="accent-primary"
                />
                <label htmlFor="scene-default" className="text-sm">
                  Skena fillestare
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
              className="px-4 py-2 bg-primary text-black font-bold text-sm rounded-lg"
            >
              Ruaj Skenën
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isEditHotspotModalOpen}
        onOpenChange={(open) => {
          setIsEditHotspotModalOpen(open);
          if (!open) {
            setEditingHotspot(null);
            setIsEditingHotspotPlacement(false);
          }
        }}
      >
        <DialogContent className="bg-card border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Edito Hotspot-in</DialogTitle>
          </DialogHeader>

          {editingHotspot && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Skena destinacion
                </label>
                <select
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-3 text-white"
                  value={editingHotspot.to_scene_id}
                  onChange={(e) =>
                    setEditingHotspot((prev) =>
                      prev
                        ? {
                            ...prev,
                            to_scene_id: e.target.value ? Number(e.target.value) : "",
                          }
                        : prev,
                    )
                  }
                >
                  <option value="">Zgjidh skenën</option>
                  {scenes
                    .filter((scene) => scene.id !== selectedSceneId)
                    .map((scene) => (
                      <option key={String(scene.id)} value={scene.id}>
                        {scene.title}
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Etiketa
                </label>
                <input
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-3 text-white"
                  value={editingHotspot.label}
                  onChange={(e) =>
                    setEditingHotspot((prev) =>
                      prev ? { ...prev, label: e.target.value } : prev,
                    )
                  }
                  placeholder="P.sh. Shko në korridor"
                />
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-white/80">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <span>
                    <strong className="text-white">Pozicioni:</strong>{" "}
                    {editingHotspot.yaw.toFixed(3)} / {editingHotspot.pitch.toFixed(3)}
                  </span>
                  <span>
                    <strong className="text-white">Statusi:</strong>{" "}
                    {isEditingHotspotPlacement
                      ? "Pozicioni po rregullohet"
                      : "Gati për ruajtje"}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handlePlaceEditedHotspotAtCenter}
                  className="px-4 py-2 rounded-xl bg-primary text-black font-semibold inline-flex items-center gap-2"
                >
                  <LocateFixed size={16} />
                  Vendose në Qendër
                </button>

                <button
                  type="button"
                  onClick={() => nudgeEditingHotspotPosition(-0.02, 0)}
                  className="px-3 py-2 rounded-xl bg-white/10 text-white hover:bg-white/15"
                >
                  Majtas
                </button>
                <button
                  type="button"
                  onClick={() => nudgeEditingHotspotPosition(0.02, 0)}
                  className="px-3 py-2 rounded-xl bg-white/10 text-white hover:bg-white/15"
                >
                  Djathtas
                </button>
                <button
                  type="button"
                  onClick={() => nudgeEditingHotspotPosition(0, -0.02)}
                  className="px-3 py-2 rounded-xl bg-white/10 text-white hover:bg-white/15"
                >
                  Lart
                </button>
                <button
                  type="button"
                  onClick={() => nudgeEditingHotspotPosition(0, 0.02)}
                  className="px-3 py-2 rounded-xl bg-white/10 text-white hover:bg-white/15"
                >
                  Poshtë
                </button>

                <button
                  onClick={() => handleDeleteHotspot(editingHotspot.id)}
                  className="px-4 py-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20"
                >
                  Fshi Hotspot-in
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-white/10 pt-4">
            <button
              onClick={() => {
                setIsEditHotspotModalOpen(false);
                setEditingHotspot(null);
                setIsEditingHotspotPlacement(false);
              }}
              className="px-4 py-2 text-sm hover:bg-white/5 rounded-lg"
            >
              Anulo
            </button>
            <button
              onClick={handleSaveEditedHotspot}
              className="px-4 py-2 bg-primary text-black font-bold text-sm rounded-lg"
            >
              Ruaj Ndryshimet
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
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
import { Viewer, EquirectangularAdapter } from "@photo-sphere-viewer/core";
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
  property_id: string | null;
  virtual_tour_id?: string | null;
  title: string;
  image_url: string;
  thumbnail_url: string | null;
  is_default: boolean;
  sort_order: number;
  position_x: number | null;
  position_y: number | null;
  initial_yaw: number | null;
  initial_pitch: number | null;
  hotspots: Hotspot[];
};

const TOUR_THUMBNAIL_PLACEHOLDER =
  "/tour-thumbnail-placeholder.svg";

const getSceneThumbnailUrl = (
  scene: Pick<Scene, "thumbnail_url">,
) =>
  scene.thumbnail_url?.trim() ||
  TOUR_THUMBNAIL_PLACEHOLDER;

const handleSceneThumbnailError = (
  event: { currentTarget: HTMLImageElement },
) => {
  const image = event.currentTarget;

  if (
    !image.src.endsWith(
      TOUR_THUMBNAIL_PLACEHOLDER,
    )
  ) {
    image.src = TOUR_THUMBNAIL_PLACEHOLDER;
  }
};

type Hotspot = {
  id: number;
  scene_id: number;
  to_scene_id: number;
  yaw: number;
  pitch: number;
  target_yaw: number | null;
  target_pitch: number | null;
  label: string | null;
};

type Orientation = { yaw: number; pitch: number };

type TargetViewCapture = {
  hotspotId: number;
  sourceSceneId: number;
  targetSceneId: number;
  sourceTitle: string;
  targetTitle: string;
  existingTargetYaw: number | null;
  existingTargetPitch: number | null;
  suggestedOrientation: Orientation;
  suggestionSource: "saved" | "reverse_link" | "scene_start";
  returnOrientation: Orientation | null;
};

type PendingEditorOrientation = {
  sceneId: number;
  orientation: Orientation;
};

type Project = {
  id: string;
  title: string;
  client_token?: string | null;
  virtual_tour_status?: "draft" | "published" | "active" | "paused" | "expired";
  virtual_tour_published_at?: string | null;
  tour_expires_at?: string | null;
  paused_at?: string | null;
  
  show_aura360_branding?: boolean;
};

type HotspotFormState = {
  id: number;
  scene_id: number;
  to_scene_id: number | "";
  label: string;
  yaw: number;
  pitch: number;
  target_yaw: number | null;
  target_pitch: number | null;
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
    position: relative;
    width: 42px;
    height: 42px;
    border-radius: 9999px;
    background: rgba(239,68,68,0.88);
    border: 3px solid white;
    display:flex;
    align-items:center;
    justify-content:center;
    color:white;
    font-size:12px;
    font-weight:700;
    box-shadow:
      0 0 0 10px rgba(239,68,68,.16),
      0 10px 24px rgba(0,0,0,.38);
    cursor:pointer;
    user-select:none;
  ">
    ↗
    <div style="
      position:absolute;
      left:50%;
      top:calc(100% + 8px);
      transform:translateX(-50%);
      white-space:nowrap;
      font-size:11px;
      font-weight:700;
      color:white;
      background:rgba(0,0,0,0.72);
      border:1px solid rgba(255,255,255,0.12);
      border-radius:9999px;
      padding:4px 8px;
      box-shadow:0 6px 18px rgba(0,0,0,.28);
    ">
      Duke u edituar
    </div>
  </div>
`;

const TEMP_HOTSPOT_HTML = `
  <div style="
    position: relative;
    width: 34px;
    height: 34px;
    border-radius: 9999px;
    background: rgba(239,68,68,0.95);
    border: 3px solid white;
    box-shadow:
      0 0 0 10px rgba(239,68,68,.16),
      0 8px 24px rgba(0,0,0,.35);
    user-select:none;
  ">
    <div style="
      position:absolute;
      top:50%;
      left:50%;
      width:2px;
      height:34px;
      background:white;
      transform:translate(-50%, -50%);
      opacity:.95;
    "></div>
    <div style="
      position:absolute;
      top:50%;
      left:50%;
      width:34px;
      height:2px;
      background:white;
      transform:translate(-50%, -50%);
      opacity:.95;
    "></div>
    <div style="
      position:absolute;
      left:50%;
      top:calc(100% + 8px);
      transform:translateX(-50%);
      white-space:nowrap;
      font-size:11px;
      font-weight:700;
      color:white;
      background:rgba(0,0,0,0.72);
      border:1px solid rgba(255,255,255,0.12);
      border-radius:9999px;
      padding:4px 8px;
      box-shadow:0 6px 18px rgba(0,0,0,.28);
    ">
      Hotspot i ri
    </div>
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

const TWO_PI = Math.PI * 2;
const MIN_SAFE_PITCH = -Math.PI / 2 + 0.02;
const MAX_SAFE_PITCH = Math.PI / 2 - 0.02;

const normalizeYaw = (yaw: number) => {
  if (!Number.isFinite(yaw)) return 0;
  let normalized = ((yaw + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI;
  if (Math.abs(normalized + Math.PI) < 1e-10) normalized = Math.PI;
  return normalized;
};

const clampPitch = (pitch: number) => {
  if (!Number.isFinite(pitch)) return 0;
  return Math.max(MIN_SAFE_PITCH, Math.min(MAX_SAFE_PITCH, pitch));
};

const normalizeNullableYaw = (value: unknown) => {
  const yaw = toNullableNumber(value);
  return yaw == null ? null : normalizeYaw(yaw);
};

const normalizeNullablePitch = (value: unknown) => {
  const pitch = toNullableNumber(value);
  return pitch == null ? null : clampPitch(pitch);
};

const isFiniteOrientation = (orientation: Orientation | null): orientation is Orientation => {
  return (
    !!orientation &&
    Number.isFinite(orientation.yaw) &&
    Number.isFinite(orientation.pitch)
  );
};


type HotspotLike = {
  id: number;
  yaw: number;
  pitch: number;
};

type ClusteredHotspotPosition = {
  yaw: number;
  pitch: number;
  rawYaw: number;
  rawPitch: number;
  clusterIndex: number;
  clusterSize: number;
  isClustered: boolean;
};

const HOTSPOT_CLUSTER_RADIUS = 0.04;
const HOTSPOT_FAN_YAW_STEP = 0.052;
const HOTSPOT_FAN_PITCH_STEP = 0.018;

const getYawDistance = (a: number, b: number) => {
  return Math.abs(normalizeYaw(a - b));
};

const getHotspotDistance = (a: HotspotLike, b: HotspotLike) => {
  const dyaw = getYawDistance(a.yaw, b.yaw);
  const dpitch = Math.abs(a.pitch - b.pitch);
  return Math.sqrt(dyaw * dyaw + dpitch * dpitch);
};

const getHotspotClusterKey = (hotspot: HotspotLike) => {
  return `${Math.round(normalizeYaw(hotspot.yaw) / HOTSPOT_CLUSTER_RADIUS)}:${Math.round(
    clampPitch(hotspot.pitch) / HOTSPOT_CLUSTER_RADIUS,
  )}`;
};

const getHotspotClusters = <T extends HotspotLike>(hotspots: T[]): T[][] => {
  const clusters: T[][] = [];

  hotspots.forEach((hotspot) => {
    const existingCluster = clusters.find((cluster) =>
      cluster.some(
        (clusterHotspot) => getHotspotDistance(clusterHotspot, hotspot) <= HOTSPOT_CLUSTER_RADIUS,
      ),
    );

    if (existingCluster) {
      existingCluster.push(hotspot);
    } else {
      clusters.push([hotspot]);
    }
  });

  return clusters.map((cluster) =>
    [...cluster].sort((a, b) => {
      const keyA = getHotspotClusterKey(a);
      const keyB = getHotspotClusterKey(b);
      if (keyA !== keyB) return keyA.localeCompare(keyB);
      return Number(a.id) - Number(b.id);
    }),
  );
};

const getClusteredHotspotPositions = <T extends HotspotLike>(
  hotspots: T[],
): Map<number, ClusteredHotspotPosition> => {
  const positions = new Map<number, ClusteredHotspotPosition>();

  getHotspotClusters(hotspots).forEach((cluster) => {
    if (cluster.length === 1) {
      const hotspot = cluster[0];
      positions.set(Number(hotspot.id), {
        yaw: normalizeYaw(hotspot.yaw),
        pitch: clampPitch(hotspot.pitch),
        rawYaw: normalizeYaw(hotspot.yaw),
        rawPitch: clampPitch(hotspot.pitch),
        clusterIndex: 0,
        clusterSize: 1,
        isClustered: false,
      });
      return;
    }

    const centerIndex = (cluster.length - 1) / 2;

    cluster.forEach((hotspot, index) => {
      const offset = index - centerIndex;
      const verticalDirection = index % 2 === 0 ? 1 : -1;

      positions.set(Number(hotspot.id), {
        yaw: normalizeYaw(hotspot.yaw + offset * HOTSPOT_FAN_YAW_STEP),
        pitch: clampPitch(
          hotspot.pitch + Math.abs(offset) * HOTSPOT_FAN_PITCH_STEP * verticalDirection,
        ),
        rawYaw: normalizeYaw(hotspot.yaw),
        rawPitch: clampPitch(hotspot.pitch),
        clusterIndex: index,
        clusterSize: cluster.length,
        isClustered: true,
      });
    });
  });

  return positions;
};

const getSmartHotspotLabel = (targetTitle?: string | null) => {
  const cleanTitle = String(targetTitle || "").trim();
  return cleanTitle ? `Shko në ${cleanTitle}` : "Shko në skenën tjetër";
};

export default function AdminVirtualTour() {
  const { isAdmin, permissions, isLoading: authLoading } = useAuth();
  const [location, setLocation] = useLocation();
  const { id } = useParams();
  const recordId = id as string;
  const { toast } = useToast();

  const isClientTourEditor = location.startsWith("/admin/client-tours/");
  const ownerColumn = isClientTourEditor ? "virtual_tour_id" : "property_id";

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
  
  const selectedSceneDisplayNumber = useMemo(() => {
  if (!selectedScene) return null;

  const sortedScenes = scenes
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);

  const index = sortedScenes.findIndex(
    (scene) => Number(scene.id) === Number(selectedScene.id)
  );

  return index >= 0 ? index + 1 : null;
}, [scenes, selectedScene]);

  useEffect(() => {
    selectedSceneIdRef.current = selectedSceneId;
  }, [selectedSceneId]);

  const [viewerError, setViewerError] = useState("");
  const [isPlacementMode, setIsPlacementMode] = useState(false);
  const [draft, setDraft] = useState<PlacementDraft>({
    to_scene_id: "",
    label: "",
    yaw: null,
    pitch: null,
  });
  const [autoCalibrateAfterAdd, setAutoCalibrateAfterAdd] = useState(true);

  const [cameraCenter, setCameraCenter] = useState<{
    yaw: number;
    pitch: number;
  } | null>(null);

  const [targetViewCapture, setTargetViewCapture] =
    useState<TargetViewCapture | null>(null);

  const [expiresAtInput, setExpiresAtInput] = useState<string>("");
  
  const [isSavingBranding, setIsSavingBranding] = useState(false);

  const [isEditHotspotModalOpen, setIsEditHotspotModalOpen] = useState(false);
  const [editingHotspot, setEditingHotspot] = useState<HotspotFormState | null>(
    null,
  );
  const [isEditingHotspotPlacement, setIsEditingHotspotPlacement] =
    useState(false);

  const editorContainerRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const editorSectionRef = useRef<HTMLDivElement>(null);
  const previewSectionRef = useRef<HTMLDivElement>(null);
  const editorViewerRef = useRef<Viewer | null>(null);
  const previewViewerRef = useRef<Viewer | null>(null);
  const editorViewerLoadIdRef = useRef(0);
  const selectedSceneIdRef = useRef<number | null>(null);
  const pendingEditorOrientationRef = useRef<PendingEditorOrientation | null>(null);

  const [isSavingStartView, setIsSavingStartView] = useState(false);
  const [isSavingTargetView, setIsSavingTargetView] = useState(false);
  const [isSavingHotspot, setIsSavingHotspot] = useState(false);
  const [isSavingHotspotEdit, setIsSavingHotspotEdit] = useState(false);
  const [isSavingScene, setIsSavingScene] = useState(false);

  const todayInputValue = useMemo(() => {
    return new Date().toISOString().slice(0, 10);
  }, []);

  const computedTourStatus = useMemo(() => {
    if (
      project?.virtual_tour_status === "active" &&
      project?.tour_expires_at
    ) {
      const expiresAt = new Date(project.tour_expires_at).getTime();

      if (Number.isFinite(expiresAt) && expiresAt < Date.now()) {
        return "expired";
      }
    }

    return project?.virtual_tour_status;
  }, [project?.virtual_tour_status, project?.tour_expires_at]);

  const getExpiresAtFromInput = useCallback(() => {
    if (!expiresAtInput) return null;

    const expiresAt = new Date(`${expiresAtInput}T23:59:59`);

    if (!Number.isFinite(expiresAt.getTime())) {
      return null;
    }

    return expiresAt.toISOString();
  }, [expiresAtInput]);

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

  const getLiveViewerPosition = useCallback((): Orientation | null => {
    try {
      const viewer = editorViewerRef.current;
      if (!viewer) return null;

      const position = viewer.getPosition();
      if (!position) return null;

      if (!Number.isFinite(position.yaw) || !Number.isFinite(position.pitch)) {
        return null;
      }

      return {
        yaw: normalizeYaw(position.yaw),
        pitch: clampPitch(position.pitch),
      };
    } catch (error) {
      console.error("Live viewer position read error:", error);
      return null;
    }
  }, []);

  const usedTargetSceneIds = useMemo(() => {
    if (!selectedScene) return new Set<number>();

    return new Set(
      selectedScene.hotspots
        .filter((hotspot) => hotspot.id !== editingHotspot?.id)
        .map((hotspot) => Number(hotspot.to_scene_id)),
    );
  }, [selectedScene, editingHotspot]);

  const targetUsageCounts = useMemo(() => {
    const counts = new Map<number, number>();
    if (!selectedScene) return counts;

    selectedScene.hotspots.forEach((hotspot) => {
      const targetId = Number(hotspot.to_scene_id);
      counts.set(targetId, (counts.get(targetId) || 0) + 1);
    });

    return counts;
  }, [selectedScene]);

  const availableTargetScenes = useMemo(() => {
    return scenes.filter((scene) => {
      if (!selectedScene) return false;
      return Number(scene.id) !== Number(selectedScene.id);
    });
  }, [scenes, selectedScene]);

  const selectedSceneClusterGroups = useMemo(() => {
    if (!selectedScene) return [];
    return getHotspotClusters(selectedScene.hotspots).filter(
      (cluster) => cluster.length > 1,
    );
  }, [selectedScene]);

  const missingTargetViewHotspots = useMemo(() => {
    return [...scenes]
      .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
      .flatMap((scene) =>
        [...scene.hotspots]
          .sort((a, b) => a.id - b.id)
          .filter(
            (hotspot) =>
              hotspot.target_yaw == null || hotspot.target_pitch == null,
          )
          .map((hotspot) => ({ hotspot, sourceScene: scene })),
      );
  }, [scenes]);

  const missingSceneStartViews = useMemo(
    () =>
      [...scenes]
        .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
        .filter(
          (scene) =>
            scene.initial_yaw == null ||
            scene.initial_pitch == null ||
            !Number.isFinite(scene.initial_yaw) ||
            !Number.isFinite(scene.initial_pitch),
        ),
    [scenes],
  );

  const invalidSceneImages = useMemo(
    () => scenes.filter((scene) => !String(scene.image_url || "").trim()),
    [scenes],
  );

  const brokenHotspotConnections = useMemo(() => {
    const sceneIds = new Set(scenes.map((scene) => Number(scene.id)));

    return scenes.flatMap((scene) =>
      scene.hotspots
        .filter(
          (hotspot) =>
            !sceneIds.has(Number(hotspot.to_scene_id)) ||
            Number(hotspot.to_scene_id) === Number(scene.id),
        )
        .map((hotspot) => ({ hotspot, sourceScene: scene })),
    );
  }, [scenes]);

  const totalHotspots = useMemo(
    () => scenes.reduce((total, scene) => total + scene.hotspots.length, 0),
    [scenes],
  );

  const calibratedHotspots = Math.max(
    0,
    totalHotspots - missingTargetViewHotspots.length,
  );

  const defaultScenes = useMemo(
    () => scenes.filter((scene) => scene.is_default),
    [scenes],
  );

  const defaultScene = defaultScenes[0] || null;

  const tourReadiness = useMemo(() => {
    const validImageCount = scenes.length - invalidSceneImages.length;
    const savedStartViewCount = scenes.length - missingSceneStartViews.length;
    const validConnectionCount = totalHotspots - brokenHotspotConnections.length;
    const maximumPoints = Math.max(1, scenes.length * 2 + totalHotspots * 2 + 1);
    const earnedPoints =
      validImageCount +
      savedStartViewCount +
      validConnectionCount +
      calibratedHotspots +
      (defaultScenes.length === 1 ? 1 : 0);

    const remainingTasks =
      (scenes.length === 0 ? 1 : 0) +
      (scenes.length > 0 && defaultScenes.length !== 1 ? 1 : 0) +
      invalidSceneImages.length +
      missingSceneStartViews.length +
      brokenHotspotConnections.length +
      missingTargetViewHotspots.length;

    return {
      qualityScore:
        scenes.length === 0
          ? 0
          : Math.max(0, Math.min(100, Math.round((earnedPoints / maximumPoints) * 100))),
      remainingTasks,
      isReady:
        scenes.length > 0 &&
        defaultScenes.length === 1 &&
        invalidSceneImages.length === 0 &&
        missingSceneStartViews.length === 0 &&
        brokenHotspotConnections.length === 0 &&
        missingTargetViewHotspots.length === 0,
    };
  }, [
    scenes.length,
    invalidSceneImages.length,
    missingSceneStartViews.length,
    brokenHotspotConnections.length,
    missingTargetViewHotspots.length,
    totalHotspots,
    calibratedHotspots,
    defaultScenes.length,
  ]);

  const refreshTour = useCallback(async () => {
    if (!recordId) return;

    const currentSelectedSceneId = selectedSceneIdRef.current;

const { data: rawRecordData, error: recordError } = isClientTourEditor
  ? await supabase
      .from("virtual_tours")
      .select(
        "id, title, status, client_token, expires_at, activated_at, paused_at, show_aura360_branding",
      )
      .eq("id", recordId)
      .single()
  : await supabase
      .from("properties")
      .select(
        "id, title, virtual_tour_status, virtual_tour_published_at, show_aura360_branding",
      )
      .eq("id", recordId)
      .single();

    if (recordError || !rawRecordData) {
      toast({
        title: "Gabim",
        description: isClientTourEditor
          ? "Virtual tour nuk u gjet."
          : "Projekti nuk u gjet.",
        variant: "destructive",
      });
      return;
    }

    const projectData: Project = isClientTourEditor
      ? {
          id: rawRecordData.id,
          title: rawRecordData.title || "Virtual Tour",
          client_token: rawRecordData.client_token,
          virtual_tour_status: rawRecordData.status,
          tour_expires_at: rawRecordData.expires_at,
          virtual_tour_published_at: rawRecordData.activated_at,
          paused_at: rawRecordData.paused_at,
		show_aura360_branding:
        rawRecordData.show_aura360_branding ?? true,		  
        }
      : {
          id: rawRecordData.id,
          title: rawRecordData.title || "Pronë",
          virtual_tour_status: rawRecordData.virtual_tour_status || "draft",
          virtual_tour_published_at: rawRecordData.virtual_tour_published_at,
		show_aura360_branding:
        rawRecordData.show_aura360_branding ?? true,		  
        };

    const { data: scenesData, error: scenesError } = await supabase
      .from("virtual_tour_scenes")
      .select("*")
      .eq(ownerColumn, recordId)
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
            yaw: normalizeYaw(toNumber(hotspot.yaw, 0)),
            pitch: clampPitch(toNumber(hotspot.pitch, 0)),
            target_yaw: normalizeNullableYaw(hotspot.target_yaw),
            target_pitch: normalizeNullablePitch(hotspot.target_pitch),
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
        property_id: scene.property_id ?? null,
        virtual_tour_id: scene.virtual_tour_id ?? null,
        title: scene.title || "",
        image_url: (scene.image_url || "").trim(),
        thumbnail_url: scene.thumbnail_url ? String(scene.thumbnail_url).trim() : null,
        is_default: !!scene.is_default,
        sort_order: toNumber(scene.sort_order, 0),
        position_x: toNullableNumber(scene.position_x),
        position_y: toNullableNumber(scene.position_y),
        initial_yaw: normalizeNullableYaw(scene.initial_yaw),
        initial_pitch: normalizeNullablePitch(scene.initial_pitch),
        hotspots: hotspotsMap.get(normalizedId) || [],
      };
    });

    setProject(projectData);
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
  }, [recordId, ownerColumn, isClientTourEditor, toast]);

  useEffect(() => {
    const load = async () => {
      if (authLoading || !isAdmin || !recordId) return;

      setIsLoading(true);
      await refreshTour();
      setIsLoading(false);
    };

    load();
  }, [authLoading, isAdmin, recordId, refreshTour]);

  useEffect(() => {
    setViewerError("");
    setIsPlacementMode(false);
    resetDraft(false);
    setEditingHotspot(null);
    setIsEditingHotspotPlacement(false);
    setIsEditHotspotModalOpen(false);
    setCameraCenter(null);
  }, [selectedSceneId, resetDraft]);

  useEffect(() => {
    if (project?.tour_expires_at) {
      setExpiresAtInput(project.tour_expires_at.slice(0, 10));
    } else {
      setExpiresAtInput("");
    }
  }, [project?.tour_expires_at]);

  const handlePublishTour = async () => {
    if (!tourReadiness.isReady) {
      toast({
        title: "Turi ende nuk është gati",
        description:
          tourReadiness.remainingTasks === 1
            ? "Përfundo detyrën e mbetur para publikimit."
            : `Përfundo ${tourReadiness.remainingTasks} detyrat e mbetura para publikimit.`,
        variant: "destructive",
      });
      return;
    }

    const confirmMessage = isClientTourEditor
      ? "A dëshironi ta aktivizoni këtë virtual tour privat?"
      : "A jeni i sigurt që dëshironi ta publikoni turin virtual? Pasi të publikohet, do të shfaqet në faqen publike.";

    if (!confirm(confirmMessage)) return;

    const nowIso = new Date().toISOString();
    const expiresAt = getExpiresAtFromInput();

    if (isClientTourEditor && expiresAt) {
      const expiresAtTime = new Date(expiresAt).getTime();

      if (Number.isFinite(expiresAtTime) && expiresAtTime < Date.now()) {
        toast({
          title: "Datë e pavlefshme",
          description: "Data e skadimit nuk mund të jetë në të kaluarën.",
          variant: "destructive",
        });
        return;
      }
    }

    try {
      if (isClientTourEditor) {
        const { error } = await supabase
          .from("virtual_tours")
          .update({
            status: "active",
            expires_at: expiresAt,
            activated_at: nowIso,
            paused_at: null,
            updated_at: nowIso,
          })
          .eq("id", recordId);

        if (error) throw error;

        setProject((prev) =>
          prev
            ? {
                ...prev,
                virtual_tour_status: "active",
                tour_expires_at: expiresAt,
                virtual_tour_published_at: nowIso,
                paused_at: null,
              }
            : prev,
        );

        toast({
          title: "Virtual Tour u aktivizua",
          description: expiresAt
            ? `Turi është aktiv deri më ${new Date(expiresAt).toLocaleDateString("sq-AL")}.`
            : "Turi është aktiv pa datë skadimi.",
        });

        return;
      }

      const { error } = await supabase
        .from("properties")
        .update({
          virtual_tour_status: "published",
          virtual_tour_published_at: nowIso,
        })
        .eq("id", recordId);

      if (error) throw error;

      setProject((prev) =>
        prev
          ? {
              ...prev,
              virtual_tour_status: "published",
              virtual_tour_published_at: nowIso,
            }
          : prev,
      );

      toast({
        title: "Sukses",
        description: "Turi virtual u publikua dhe tani është live.",
      });
    } catch (error: any) {
      toast({
        title: "Gabim",
        description: error.message || "Publikimi i turit virtual dështoi.",
        variant: "destructive",
      });
    }
  };

  const handleUnpublishTour = async () => {
    const confirmMessage = isClientTourEditor
      ? "A dëshironi ta ktheni këtë virtual tour privat në Draft?"
      : "A jeni i sigurt që dëshironi ta ktheni turin virtual në Draft? Pasi të kthehet në Draft, nuk do të shfaqet më në faqen publike.";

    if (!confirm(confirmMessage)) return;

    try {
      if (isClientTourEditor) {
        const { error } = await supabase
          .from("virtual_tours")
          .update({
            status: "draft",
            paused_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", recordId);

        if (error) throw error;

        setProject((prev) =>
          prev
            ? {
                ...prev,
                virtual_tour_status: "draft",
                paused_at: null,
              }
            : prev,
        );

        toast({
          title: "Draft u ruajt",
          description: "Virtual tour privat nuk është aktiv.",
        });

        return;
      }

      const { error } = await supabase
        .from("properties")
        .update({
          virtual_tour_status: "draft",
        })
        .eq("id", recordId);

      if (error) throw error;

      setProject((prev) =>
        prev ? { ...prev, virtual_tour_status: "draft" } : prev,
      );

      toast({
        title: "Draft u ruajt",
        description: "Turi virtual nuk është publik.",
      });
    } catch (error: any) {
      toast({
        title: "Gabim",
        description: error.message || "Ruajtja si draft dështoi.",
        variant: "destructive",
      });
    }
  };

  const handlePauseTour = async () => {
    if (!isClientTourEditor) return;

    if (!confirm("A dëshironi ta pezulloni këtë virtual tour privat?")) return;

    try {
      const pausedAt = new Date().toISOString();

      const { error } = await supabase
        .from("virtual_tours")
        .update({
          status: "paused",
          paused_at: pausedAt,
          updated_at: pausedAt,
        })
        .eq("id", recordId);

      if (error) throw error;

      setProject((prev) =>
        prev
          ? {
              ...prev,
              virtual_tour_status: "paused",
              paused_at: pausedAt,
            }
          : prev,
      );

      toast({
        title: "Virtual tour u pezullua",
        description:
          "Linku publik nuk do të jetë aktiv derisa ta aktivizoni përsëri.",
      });
    } catch (error: any) {
      toast({
        title: "Gabim",
        description: error.message || "Pezullimi dështoi.",
        variant: "destructive",
      });
    }
  };

  const handleSaveClientExpiry = async () => {
    if (!isClientTourEditor) return;

    const expiresAt = getExpiresAtFromInput();

    if (expiresAt) {
      const expiresAtTime = new Date(expiresAt).getTime();

      if (Number.isFinite(expiresAtTime) && expiresAtTime < Date.now()) {
        toast({
          title: "Datë e pavlefshme",
          description: "Data e skadimit nuk mund të jetë në të kaluarën.",
          variant: "destructive",
        });
        return;
      }
    }

    try {
      const updatedAt = new Date().toISOString();

      const { error } = await supabase
        .from("virtual_tours")
        .update({
          expires_at: expiresAt,
          updated_at: updatedAt,
        })
        .eq("id", recordId);

      if (error) throw error;

      setProject((prev) =>
        prev
          ? {
              ...prev,
              tour_expires_at: expiresAt,
            }
          : prev,
      );

      toast({
        title: "Data u ruajt",
        description: expiresAt
          ? `Turi do të skadojë më ${new Date(expiresAt).toLocaleDateString("sq-AL")}.`
          : "Turi nuk ka datë skadimi.",
      });
    } catch (error: any) {
      toast({
        title: "Gabim",
        description: error.message || "Ruajtja e datës dështoi.",
        variant: "destructive",
      });
    }
  };
  
    const handleAura360BrandingChange = async (enabled: boolean) => {
    if (!project || !recordId || isSavingBranding) return;

    try {
      setIsSavingBranding(true);

      const { error } = await supabase.rpc(
        "set_virtual_tour_branding",
        {
          p_owner_type: isClientTourEditor
            ? "client"
            : "property",
          p_owner_id: recordId,
          p_enabled: enabled,
        },
      );

      if (error) throw error;

      setProject((prev) =>
        prev
          ? {
              ...prev,
              show_aura360_branding: enabled,
            }
          : prev,
      );

      toast({
        title: "Branding u ruajt",
        description: enabled
          ? "“Powered by Aura360” do të shfaqet në turin virtual."
          : "“Powered by Aura360” nuk do të shfaqet në këtë tur.",
      });
    } catch (error: any) {
      toast({
        title: "Gabim",
        description:
          error?.message ||
          "Nuk u ruajt konfigurimi i branding-ut.",
        variant: "destructive",
      });
    } finally {
      setIsSavingBranding(false);
    }
  };

  const openCreateScene = () => {
    setEditingSceneId(null);
    setSceneForm({
      title: "",
      imageUrl: "",
      thumbnailUrl: "",
      isDefault: scenes.length === 0,
      sortOrder:
        scenes.length > 0
          ? Math.max(...scenes.map((scene) => scene.sort_order)) + 1
          : 0,
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
      target_yaw: hotspot.target_yaw,
      target_pitch: hotspot.target_pitch,
    });

    setIsEditingHotspotPlacement(false);
    setIsPlacementMode(false);
    resetDraft(false);
    setIsEditHotspotModalOpen(true);
  };

  const handleSaveScene = async () => {
    if (isSavingScene) return;

    if (!sceneForm.title.trim() || !sceneForm.imageUrl.trim()) {
      toast({
        title: "Gabim",
        description: "Titulli dhe URL e imazhit janë të detyrueshme.",
        variant: "destructive",
      });
      return;
    }

    const wasCreating = editingSceneId === null;
    const editingSceneRecord =
      editingSceneId !== null
        ? scenes.find((scene) => Number(scene.id) === Number(editingSceneId)) || null
        : null;
    const isEditingOnlyDefaultScene =
      !!editingSceneRecord?.is_default && defaultScenes.length === 1;
    const shouldBeDefault =
      scenes.length === 0 || isEditingOnlyDefaultScene || sceneForm.isDefault;
    let savedSceneId = editingSceneId;

    try {
      setIsSavingScene(true);

      if (editingSceneId !== null) {
        const { error } = await supabase
          .from("virtual_tour_scenes")
          .update({
            title: sceneForm.title.trim(),
            image_url: sceneForm.imageUrl.trim(),
            thumbnail_url: sceneForm.thumbnailUrl.trim() || null,
            is_default: shouldBeDefault,
            sort_order: Number(sceneForm.sortOrder) || 0,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingSceneId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("virtual_tour_scenes")
          .insert({
            ...(isClientTourEditor
              ? { virtual_tour_id: recordId }
              : { property_id: recordId }),
            title: sceneForm.title.trim(),
            image_url: sceneForm.imageUrl.trim(),
            thumbnail_url: sceneForm.thumbnailUrl.trim() || null,
            is_default: shouldBeDefault,
            sort_order: Number(sceneForm.sortOrder) || 0,
          })
          .select("id")
          .single();

        if (error || !data) throw error || new Error("Skena nuk u krijua.");
        savedSceneId = toNumber(data.id);
      }

      if (savedSceneId !== null && shouldBeDefault) {
        const { error: clearOtherDefaultsError } = await supabase
          .from("virtual_tour_scenes")
          .update({ is_default: false })
          .eq(ownerColumn, recordId)
          .neq("id", savedSceneId);

        if (clearOtherDefaultsError) throw clearOtherDefaultsError;
      }

      if (savedSceneId !== null) {
        selectedSceneIdRef.current = savedSceneId;
      }

      setIsSceneModalOpen(false);
      await refreshTour();

      if (savedSceneId !== null) {
        setSelectedSceneId(savedSceneId);
      }

      toast({
        title: wasCreating ? "Skena u shtua" : "Skena u përditësua",
        description: wasCreating
          ? "Hapi tjetër: rrotullo panoramën dhe ruaj këndin fillestar të skenës."
          : "Të dhënat e skenës u ruajtën me sukses.",
      });

      window.setTimeout(() => {
        editorSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 160);
    } catch (error: any) {
      toast({
        title: "Gabim",
        description: error?.message || "Ruajtja dështoi.",
        variant: "destructive",
      });
    } finally {
      setIsSavingScene(false);
    }
  };

  const handleDeleteScene = async (sceneId: number) => {
    if (!confirm("A dëshironi ta fshini këtë skenë?")) return;

    try {
      const { error: sourceHotspotsError } = await supabase
        .from("virtual_tour_hotspots")
        .delete()
        .eq("scene_id", sceneId);
      if (sourceHotspotsError) throw sourceHotspotsError;

      const { error: targetHotspotsError } = await supabase
        .from("virtual_tour_hotspots")
        .delete()
        .eq("to_scene_id", sceneId);
      if (targetHotspotsError) throw targetHotspotsError;

      const deletedScene = scenes.find(
        (scene) => Number(scene.id) === Number(sceneId),
      );
      const nextDefaultScene = [...scenes]
        .filter((scene) => Number(scene.id) !== Number(sceneId))
        .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)[0];

      const { error: sceneDeleteError } = await supabase
        .from("virtual_tour_scenes")
        .delete()
        .eq("id", sceneId);
      if (sceneDeleteError) throw sceneDeleteError;

      if (deletedScene?.is_default && nextDefaultScene) {
        const { error: promoteDefaultError } = await supabase
          .from("virtual_tour_scenes")
          .update({ is_default: true })
          .eq("id", nextDefaultScene.id);
        if (promoteDefaultError) throw promoteDefaultError;
      }

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

  const handleSaveSceneStartView = async () => {
    if (!selectedScene || isSavingStartView) return;

    if (targetViewCapture) {
      toast({
        title: "Kalibrimi i hyrjes është aktiv",
        description: "Përfundo ose anulo kalibrimin para se të ndryshosh këndin fillestar.",
      });
      return;
    }

    const livePosition = getLiveViewerPosition();

    if (!livePosition) {
      toast({
        title: "Gabim",
        description: "Pozicioni aktual i kamerës nuk u lexua.",
        variant: "destructive",
      });
      return;
    }

    const normalizedStartView = {
      yaw: normalizeYaw(livePosition.yaw),
      pitch: clampPitch(livePosition.pitch),
    };

    try {
      setIsSavingStartView(true);

      const { error } = await supabase
        .from("virtual_tour_scenes")
        .update({
          initial_yaw: normalizedStartView.yaw,
          initial_pitch: normalizedStartView.pitch,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedScene.id);

      if (error) throw error;

      setScenes((prev) =>
        prev.map((scene) =>
          scene.id === selectedScene.id
            ? {
                ...scene,
                initial_yaw: normalizedStartView.yaw,
                initial_pitch: normalizedStartView.pitch,
              }
            : scene,
        ),
      );

      toast({
        title: "Këndi fillestar u ruajt",
        description: `Skena “${selectedScene.title}” do të hapet pikërisht në këtë drejtim.`,
      });
    } catch (error: any) {
      toast({
        title: "Gabim",
        description: error.message || "Ruajtja e pamjes fillestare dështoi.",
        variant: "destructive",
      });
    } finally {
      setIsSavingStartView(false);
    }
  };

  const handleSetDefaultScene = async (sceneId: number) => {
    try {
      const { error: setDefaultError } = await supabase
        .from("virtual_tour_scenes")
        .update({ is_default: true })
        .eq("id", sceneId);

      if (setDefaultError) throw setDefaultError;

      const { error: clearOtherDefaultsError } = await supabase
        .from("virtual_tour_scenes")
        .update({ is_default: false })
        .eq(ownerColumn, recordId)
        .neq("id", sceneId);

      if (clearOtherDefaultsError) throw clearOtherDefaultsError;

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
    if (targetViewCapture) {
      toast({
        title: "Kalibrimi i hyrjes është aktiv",
        description: "Ruaje ose anuloje kalibrimin para se të shtosh hotspot të ri.",
      });
      return;
    }

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

    const livePosition = getLiveViewerPosition();

    if (!livePosition) {
      toast({
        title: "Gabim",
        description: "Pozicioni aktual i kamerës nuk u lexua.",
        variant: "destructive",
      });
      return;
    }

    setDraft((prev) => ({
      ...prev,
      yaw: livePosition.yaw,
      pitch: livePosition.pitch,
    }));

    setCameraCenter(livePosition);

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
        yaw: normalizeYaw(prev.yaw + yawDelta),
        pitch: clampPitch(prev.pitch + pitchDelta),
      };
    });
  };

  const handlePlaceEditedHotspotAtCenter = () => {
    if (!editingHotspot) return;

    const livePosition = getLiveViewerPosition();

    if (!livePosition) {
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
            yaw: livePosition.yaw,
            pitch: livePosition.pitch,
          }
        : prev,
    );

    setCameraCenter(livePosition);
    setIsEditingHotspotPlacement(true);

    toast({
      title: "Pozicioni u përditësua",
      description: "Pozicioni i ri u vendos në qendrën aktuale të pamjes.",
    });
  };

  const startTargetViewCapture = useCallback(
    (hotspot: Hotspot) => {
      const sourceScene = scenes.find(
        (scene) => Number(scene.id) === Number(hotspot.scene_id),
      );
      const targetScene = scenes.find(
        (scene) => Number(scene.id) === Number(hotspot.to_scene_id),
      );

      if (!sourceScene || !targetScene) {
        toast({
          title: "Gabim",
          description: "Skena burim ose destinacion nuk u gjet.",
          variant: "destructive",
        });
        return;
      }

      const returnOrientation =
        Number(selectedSceneIdRef.current) === Number(sourceScene.id)
          ? getLiveViewerPosition()
          : null;
      const existingTargetYaw = normalizeNullableYaw(hotspot.target_yaw);
      const existingTargetPitch = normalizeNullablePitch(hotspot.target_pitch);
      const targetSceneStart = {
        yaw: normalizeYaw(targetScene.initial_yaw ?? 0),
        pitch: clampPitch(targetScene.initial_pitch ?? 0),
      };
      const reverseHotspot = targetScene.hotspots.find(
        (candidate) =>
          Number(candidate.to_scene_id) === Number(sourceScene.id),
      );
      const savedOrientation =
        existingTargetYaw != null
          ? {
              yaw: existingTargetYaw,
              pitch: existingTargetPitch ?? targetSceneStart.pitch,
            }
          : null;
      const reverseLinkOrientation = reverseHotspot
        ? {
            yaw: normalizeYaw(reverseHotspot.yaw + Math.PI),
            pitch: targetSceneStart.pitch,
          }
        : null;
      const suggestedOrientation =
        savedOrientation || reverseLinkOrientation || targetSceneStart;
      const suggestionSource = savedOrientation
        ? "saved"
        : reverseLinkOrientation
          ? "reverse_link"
          : "scene_start";

      setTargetViewCapture({
        hotspotId: hotspot.id,
        sourceSceneId: sourceScene.id,
        targetSceneId: targetScene.id,
        sourceTitle: sourceScene.title,
        targetTitle: targetScene.title,
        existingTargetYaw,
        existingTargetPitch,
        suggestedOrientation,
        suggestionSource,
        returnOrientation,
      });

      setIsPlacementMode(false);
      setIsEditingHotspotPlacement(false);
      setIsEditHotspotModalOpen(false);
      setEditingHotspot(null);
      setSelectedSceneId(targetScene.id);

      toast({
        title: "Kalibrimi i drejtimit aktiv",
        description:
          "Rrotullo skenën destinacion në drejtimin ku duhet të shikojë vizitori pas kalimit, pastaj ruaje.",
      });
    },
    [scenes, toast, getLiveViewerPosition],
  );

  const handleSaveHotspotTargetView = (hotspotId: number) => {
    const hotspot = scenes
      .flatMap((scene) => scene.hotspots)
      .find((item) => Number(item.id) === Number(hotspotId));

    if (!hotspot) {
      toast({
        title: "Gabim",
        description: "Hotspot-i nuk u gjet.",
        variant: "destructive",
      });
      return;
    }

    startTargetViewCapture(hotspot);
  };

  const handleCancelTargetViewCapture = () => {
    if (!targetViewCapture) return;

    if (isFiniteOrientation(targetViewCapture.returnOrientation)) {
      pendingEditorOrientationRef.current = {
        sceneId: targetViewCapture.sourceSceneId,
        orientation: targetViewCapture.returnOrientation,
      };
    }

    const sourceSceneId = targetViewCapture.sourceSceneId;
    setTargetViewCapture(null);
    setSelectedSceneId(sourceSceneId);
  };

  const handleSaveTargetViewCapture = async () => {
    if (!targetViewCapture || isSavingTargetView) return;

    const livePosition = getLiveViewerPosition();

    if (!livePosition) {
      toast({
        title: "Gabim",
        description: "Pozicioni aktual i kamerës në skenën destinacion nuk u lexua.",
        variant: "destructive",
      });
      return;
    }

    const normalizedTargetYaw = normalizeYaw(livePosition.yaw);
    const normalizedTargetPitch = clampPitch(livePosition.pitch);

    try {
      setIsSavingTargetView(true);

      const { error } = await supabase
        .from("virtual_tour_hotspots")
        .update({
          target_yaw: normalizedTargetYaw,
          target_pitch: normalizedTargetPitch,
        })
        .eq("id", targetViewCapture.hotspotId);

      if (error) throw error;

      setScenes((prev) =>
        prev.map((scene) => ({
          ...scene,
          hotspots: scene.hotspots.map((hotspot) =>
            Number(hotspot.id) === Number(targetViewCapture.hotspotId)
              ? {
                  ...hotspot,
                  target_yaw: normalizedTargetYaw,
                  target_pitch: normalizedTargetPitch,
                }
              : hotspot,
          ),
        })),
      );

      toast({
        title: "Drejtimi i hyrjes u ruajt",
        description: `Kalimi nga “${targetViewCapture.sourceTitle}” në “${targetViewCapture.targetTitle}” tani hapet pikërisht në drejtimin e kalibruar.`,
      });

      const sourceSceneId = targetViewCapture.sourceSceneId;

      if (isFiniteOrientation(targetViewCapture.returnOrientation)) {
        pendingEditorOrientationRef.current = {
          sceneId: sourceSceneId,
          orientation: targetViewCapture.returnOrientation,
        };
      }

      setTargetViewCapture(null);
      setSelectedSceneId(sourceSceneId);
    } catch (error: any) {
      toast({
        title: "Gabim",
        description: error.message || "Ruajtja e drejtimit të hyrjes dështoi.",
        variant: "destructive",
      });
    } finally {
      setIsSavingTargetView(false);
    }
  };

  const handleCalibrateNextMissingTargetView = () => {
    if (targetViewCapture) {
      toast({
        title: "Kalibrimi është aktiv",
        description: "Ruaje ose anuloje drejtimin aktual para kalibrimit tjetër.",
      });
      return;
    }

    const nextMissing = missingTargetViewHotspots[0];

    if (!nextMissing) {
      toast({
        title: "Gjithçka është në rregull",
        description: "Të gjitha hotspot-et kanë drejtim hyrjeje të kalibruar.",
      });
      return;
    }

    startTargetViewCapture(nextMissing.hotspot);
  };

  const nudgeEditingHotspotPosition = (yawDelta: number, pitchDelta: number) => {
    setEditingHotspot((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        yaw: normalizeYaw(prev.yaw + yawDelta),
        pitch: clampPitch(prev.pitch + pitchDelta),
      };
    });
    setIsEditingHotspotPlacement(true);
  };

  const handleAddHotspot = async () => {
    if (isSavingHotspot) return;

    if (
      !selectedScene ||
      draft.to_scene_id === "" ||
      draft.yaw === null ||
      draft.pitch === null
    ) {
      toast({
        title: "Gabim",
        description: "Zgjidh destinacionin dhe vendose pozicionin e hotspot-it.",
        variant: "destructive",
      });
      return;
    }

    const normalizedHotspotPosition = {
      yaw: normalizeYaw(draft.yaw),
      pitch: clampPitch(draft.pitch),
    };

    try {
      setIsSavingHotspot(true);

      const { data: insertedHotspot, error } = await supabase
        .from("virtual_tour_hotspots")
        .insert({
          scene_id: selectedScene.id,
          to_scene_id: Number(draft.to_scene_id),
          yaw: normalizedHotspotPosition.yaw,
          pitch: normalizedHotspotPosition.pitch,
          target_yaw: null,
          target_pitch: null,
          label: draft.label.trim() || null,
        })
        .select("*")
        .single();

      if (error) throw error;

      const normalizedInsertedHotspot: Hotspot = {
        id: toNumber(insertedHotspot.id),
        scene_id: toNumber(insertedHotspot.scene_id),
        to_scene_id: toNumber(insertedHotspot.to_scene_id),
        yaw: normalizeYaw(Number(insertedHotspot.yaw)),
        pitch: clampPitch(Number(insertedHotspot.pitch)),
        target_yaw: toNullableNumber(insertedHotspot.target_yaw),
        target_pitch: toNullableNumber(insertedHotspot.target_pitch),
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

      if (autoCalibrateAfterAdd) {
        toast({
          title: "Hotspot u ruajt",
          description: "Tani cakto drejtimin e saktë të hyrjes në skenën destinacion.",
        });

        window.setTimeout(() => {
          startTargetViewCapture(normalizedInsertedHotspot);
        }, 80);
      } else {
        toast({
          title: "Hotspot u ruajt",
          description: "Mund të vazhdosh me hotspot-in tjetër në të njëjtën skenë.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Gabim",
        description: error.message || "Shtimi i hotspot-it dështoi.",
        variant: "destructive",
      });
    } finally {
      setIsSavingHotspot(false);
    }
  };

  const saveEditedHotspot = async (calibrateAfterSave: boolean) => {
    if (isSavingHotspotEdit) return;

    if (!editingHotspot || editingHotspot.to_scene_id === "") {
      toast({
        title: "Gabim",
        description: "Zgjidh skenën destinacion.",
        variant: "destructive",
      });
      return;
    }

    const originalHotspot = scenes
      .flatMap((scene) => scene.hotspots)
      .find((hotspot) => Number(hotspot.id) === Number(editingHotspot.id));
    const targetChanged =
      !!originalHotspot &&
      Number(originalHotspot.to_scene_id) !== Number(editingHotspot.to_scene_id);
    const normalizedHotspotPosition = {
      yaw: normalizeYaw(editingHotspot.yaw),
      pitch: clampPitch(editingHotspot.pitch),
    };
    const existingTargetYaw = toNullableNumber(editingHotspot.target_yaw);
    const existingTargetPitch = toNullableNumber(editingHotspot.target_pitch);
    const nextTargetYaw =
      targetChanged || existingTargetYaw == null
        ? null
        : normalizeYaw(existingTargetYaw);
    const nextTargetPitch =
      targetChanged || existingTargetPitch == null
        ? null
        : clampPitch(existingTargetPitch);

    const updatedHotspot: Hotspot = {
      id: editingHotspot.id,
      scene_id: editingHotspot.scene_id,
      to_scene_id: Number(editingHotspot.to_scene_id),
      label: editingHotspot.label.trim() || null,
      yaw: normalizedHotspotPosition.yaw,
      pitch: normalizedHotspotPosition.pitch,
      target_yaw: nextTargetYaw,
      target_pitch: nextTargetPitch,
    };

    try {
      setIsSavingHotspotEdit(true);

      const { error } = await supabase
        .from("virtual_tour_hotspots")
        .update({
          to_scene_id: updatedHotspot.to_scene_id,
          label: updatedHotspot.label,
          yaw: updatedHotspot.yaw,
          pitch: updatedHotspot.pitch,
          target_yaw: updatedHotspot.target_yaw,
          target_pitch: updatedHotspot.target_pitch,
        })
        .eq("id", editingHotspot.id);

      if (error) throw error;

      setScenes((prev) =>
        prev.map((scene) =>
          scene.id === editingHotspot.scene_id
            ? {
                ...scene,
                hotspots: scene.hotspots.map((hotspot) =>
                  hotspot.id === editingHotspot.id ? updatedHotspot : hotspot,
                ),
              }
            : scene,
        ),
      );

      setIsEditHotspotModalOpen(false);
      setEditingHotspot(null);
      setIsEditingHotspotPlacement(false);

      if (targetChanged || calibrateAfterSave) {
        toast({
          title: targetChanged
            ? "Destinacioni u ndryshua"
            : "Ndryshimet u ruajtën",
          description: targetChanged
            ? "Drejtimi i vjetër u pastrua. Tani kalibro hyrjen për destinacionin e ri."
            : "Tani cakto drejtimin e saktë të hyrjes në skenën destinacion.",
        });

        window.setTimeout(() => {
          startTargetViewCapture(updatedHotspot);
        }, 80);
      } else {
        toast({
          title: "Hotspot-i u përditësua",
          description: "Pozicioni dhe të dhënat u ruajtën me sukses.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Gabim",
        description: error.message || "Përditësimi i hotspot-it dështoi.",
        variant: "destructive",
      });
    } finally {
      setIsSavingHotspotEdit(false);
    }
  };

  const handleSaveEditedHotspot = () => {
    void saveEditedHotspot(false);
  };

  const handleSaveEditedHotspotAndCalibrate = () => {
    void saveEditedHotspot(true);
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

    editorViewerLoadIdRef.current += 1;
    const currentLoadId = editorViewerLoadIdRef.current;
    let isCurrentViewerReady = false;
    let pendingErrorTimeout: number | null = null;
    let cameraInterval: number | null = null;
    let viewer: Viewer | null = null;

    const pendingOrientation =
      pendingEditorOrientationRef.current?.sceneId === selectedScene.id
        ? pendingEditorOrientationRef.current.orientation
        : null;

    const savedCalibrationOrientation =
      targetViewCapture &&
      Number(targetViewCapture.targetSceneId) === Number(selectedScene.id)
        ? targetViewCapture.suggestedOrientation
        : null;

    const sceneStartOrientation = {
      yaw: normalizeYaw(selectedScene.initial_yaw ?? 0),
      pitch: clampPitch(selectedScene.initial_pitch ?? 0),
    };

    const startOrientation = isFiniteOrientation(pendingOrientation)
      ? pendingOrientation
      : isFiniteOrientation(savedCalibrationOrientation)
        ? savedCalibrationOrientation
        : sceneStartOrientation;

    if (pendingOrientation) {
      pendingEditorOrientationRef.current = null;
    }

    if (editorViewerRef.current) {
      try {
        editorViewerRef.current.destroy();
      } catch (error) {
        console.error("Previous editor viewer destroy error:", error);
      }
      editorViewerRef.current = null;
    }

    try {
      viewer = new Viewer({
        container: editorContainerRef.current,
        panorama: selectedScene.image_url,
        navbar: ["zoom", "move", "fullscreen"],
        adapter: EquirectangularAdapter.withConfig({
          resolution: 128,
        }),
        defaultYaw: normalizeYaw(startOrientation.yaw),
        defaultPitch: clampPitch(startOrientation.pitch),
        moveInertia: true,
        mousewheelCtrlKey: false,
        touchmoveTwoFingers: false,
        plugins: [[MarkersPlugin, {}]],
      });

      editorViewerRef.current = viewer;

      let lastCameraPosition: Orientation | null = null;
      const syncCameraCenter = () => {
        try {
          const position = viewer?.getPosition?.();
          if (!position) return;
          if (!Number.isFinite(position.yaw) || !Number.isFinite(position.pitch)) {
            return;
          }

          const nextPosition = {
            yaw: normalizeYaw(position.yaw),
            pitch: clampPitch(position.pitch),
          };

          if (
            lastCameraPosition &&
            Math.abs(normalizeYaw(nextPosition.yaw - lastCameraPosition.yaw)) < 0.0005 &&
            Math.abs(nextPosition.pitch - lastCameraPosition.pitch) < 0.0005
          ) {
            return;
          }

          lastCameraPosition = nextPosition;
          setCameraCenter(nextPosition);
        } catch (error) {
          console.error("Camera position read error:", error);
        }
      };

      setCameraCenter({
        yaw: normalizeYaw(startOrientation.yaw),
        pitch: clampPitch(startOrientation.pitch),
      });
      cameraInterval = window.setInterval(syncCameraCenter, 180);

      viewer.addEventListener("ready", () => {
        if (editorViewerLoadIdRef.current !== currentLoadId) return;

        isCurrentViewerReady = true;
        setViewerError("");
        syncCameraCenter();

        if (pendingErrorTimeout) {
          window.clearTimeout(pendingErrorTimeout);
          pendingErrorTimeout = null;
        }
      });

      viewer.addEventListener("panorama-error", () => {
        if (editorViewerLoadIdRef.current !== currentLoadId) return;

        if (pendingErrorTimeout) {
          window.clearTimeout(pendingErrorTimeout);
        }

        pendingErrorTimeout = window.setTimeout(() => {
          if (editorViewerLoadIdRef.current !== currentLoadId) return;
          if (isCurrentViewerReady) return;

          setViewerError(
            `Fotoja 360°${
              selectedSceneDisplayNumber ? ` #${selectedSceneDisplayNumber}` : ""
            }${
              selectedScene.title ? ` (“${selectedScene.title}”)` : ""
            } nuk mund të ngarkohet. Kontrollo URL-në e fotos ose zëvendësoje këtë skenë.`,
          );
        }, 900);
      });
    } catch (error) {
      console.error("Viewer/editor setup error:", error);
      setViewerError(
        `Fotoja 360°${
          selectedSceneDisplayNumber ? ` #${selectedSceneDisplayNumber}` : ""
        }${
          selectedScene.title ? ` (“${selectedScene.title}”)` : ""
        } nuk mund të inicializohet. Kontrollo URL-në e fotos ose zëvendësoje këtë skenë.`,
      );
    }

    return () => {
      if (pendingErrorTimeout) {
        window.clearTimeout(pendingErrorTimeout);
      }

      if (cameraInterval) {
        window.clearInterval(cameraInterval);
      }

      if (viewer) {
        try {
          viewer.destroy();
        } catch (error) {
          console.error("Editor viewer destroy error:", error);
        }
      }

      if (editorViewerRef.current === viewer) {
        editorViewerRef.current = null;
      }
    };
  }, [
    selectedScene?.id,
    selectedScene?.image_url,
    targetViewCapture?.hotspotId,
    targetViewCapture?.targetSceneId,
    targetViewCapture?.suggestedOrientation.yaw,
    targetViewCapture?.suggestedOrientation.pitch,
  ]);

  useEffect(() => {
    const viewer = editorViewerRef.current;
    if (!viewer || !selectedScene) return;

    try {
      const markersPlugin = viewer.getPlugin(MarkersPlugin) as any;
      if (!markersPlugin) return;

      const existingMarkers = markersPlugin.getMarkers?.() || [];
      existingMarkers.forEach((marker: any) => {
        try {
          markersPlugin.removeMarker(marker.id);
        } catch (error) {
          console.error("Marker removal error:", error);
        }
      });

      const markerHotspots = selectedScene.hotspots.map((hotspot) => {
        const isEditingThis = editingHotspot?.id === hotspot.id;

        return isEditingThis
          ? {
              ...hotspot,
              yaw: normalizeYaw(editingHotspot!.yaw),
              pitch: clampPitch(editingHotspot!.pitch),
            }
          : {
              ...hotspot,
              yaw: normalizeYaw(hotspot.yaw),
              pitch: clampPitch(hotspot.pitch),
            };
      });

      const tempDraftMarker =
        isPlacementMode && draft.yaw !== null && draft.pitch !== null
          ? {
              id: -1,
              yaw: normalizeYaw(draft.yaw),
              pitch: clampPitch(draft.pitch),
            }
          : null;

      const clusteredMarkerPositions = getClusteredHotspotPositions([
        ...markerHotspots,
        ...(tempDraftMarker ? [tempDraftMarker] : []),
      ]);

      selectedScene.hotspots.forEach((hotspot) => {
        const target = scenes.find(
          (scene) => Number(scene.id) === Number(hotspot.to_scene_id),
        );
        const isEditingThis = editingHotspot?.id === hotspot.id;
        const displayPosition = clusteredMarkerPositions.get(Number(hotspot.id));
        const clusterSuffix = displayPosition?.isClustered
          ? ` · Grup ${displayPosition.clusterIndex + 1}/${displayPosition.clusterSize}`
          : "";

        markersPlugin.addMarker({
          id: `hs-${hotspot.id}`,
          longitude:
            displayPosition?.yaw ??
            (isEditingThis ? editingHotspot!.yaw : normalizeYaw(hotspot.yaw)),
          latitude:
            displayPosition?.pitch ??
            (isEditingThis ? editingHotspot!.pitch : clampPitch(hotspot.pitch)),
          html: isEditingThis ? EDITING_HOTSPOT_HTML : NORMAL_HOTSPOT_HTML,
          tooltip: `${hotspot.label || target?.title || "Lidhje"}${clusterSuffix}`,
        });
      });

      if (tempDraftMarker) {
        const displayPosition = clusteredMarkerPositions.get(tempDraftMarker.id);
        markersPlugin.addMarker({
          id: "temp-new-hotspot",
          longitude: displayPosition?.yaw ?? tempDraftMarker.yaw,
          latitude: displayPosition?.pitch ?? tempDraftMarker.pitch,
          html: TEMP_HOTSPOT_HTML,
          tooltip: "Pozicioni i hotspot-it të ri",
        });
      }

    } catch (error) {
      console.error("Editor marker sync error:", error);
    }
  }, [
    selectedScene?.id,
    selectedScene?.hotspots,
    scenes,
    draft.yaw,
    draft.pitch,
    isPlacementMode,
    editingHotspot?.id,
    editingHotspot?.yaw,
    editingHotspot?.pitch,
    isEditingHotspotPlacement,
    targetViewCapture?.hotspotId,
  ]);

  const virtualTourNodes = useMemo(() => {
    const validScenes = scenes.filter(
      (scene) => scene.image_url && String(scene.image_url).trim() !== "",
    );

    const validSceneIds = new Set(validScenes.map((scene) => Number(scene.id)));
    const validScenesById = new Map(
      validScenes.map((scene) => [Number(scene.id), scene]),
    );

    return validScenes.map((scene) => {
      const validHotspots = scene.hotspots.filter((hotspot) =>
        validSceneIds.has(Number(hotspot.to_scene_id)),
      );
      const clusteredPositions = getClusteredHotspotPositions(validHotspots);

      return {
        id: String(scene.id),
        panorama: scene.image_url,
        name: scene.title,
        thumbnail: getSceneThumbnailUrl(scene),
        data: {
          initialYaw: scene.initial_yaw ?? null,
          initialPitch: scene.initial_pitch ?? null,
        },
        links: validHotspots.map((hotspot) => {
          const displayPosition = clusteredPositions.get(Number(hotspot.id));
          const targetTitle = validScenesById.get(Number(hotspot.to_scene_id))?.title;
          const baseName = hotspot.label || targetTitle || "Lidhje";

          return {
            nodeId: String(hotspot.to_scene_id),
            position: {
              yaw: displayPosition?.yaw ?? hotspot.yaw,
              pitch: displayPosition?.pitch ?? hotspot.pitch,
            },
            name: displayPosition?.isClustered
              ? `${baseName} · ${displayPosition.clusterIndex + 1}/${displayPosition.clusterSize}`
              : baseName,
            data: {
              hotspotId: hotspot.id,
              fromSceneId: scene.id,
              toSceneId: hotspot.to_scene_id,
              targetYaw: hotspot.target_yaw ?? null,
              targetPitch: hotspot.target_pitch ?? null,
              rawYaw: displayPosition?.rawYaw ?? hotspot.yaw,
              rawPitch: displayPosition?.rawPitch ?? hotspot.pitch,
              displayYaw: displayPosition?.yaw ?? hotspot.yaw,
              displayPitch: displayPosition?.pitch ?? hotspot.pitch,
              isClustered: !!displayPosition?.isClustered,
              clusterIndex: displayPosition?.clusterIndex ?? 0,
              clusterSize: displayPosition?.clusterSize ?? 1,
            },
          };
        }),
      };
    });
  }, [scenes]);

  const getPreviewSceneStartOrientation = useCallback(
    (sceneId: number): Orientation | null => {
      const scene = scenes.find(
        (item) => Number(item.id) === Number(sceneId),
      );

      if (
        !scene ||
        scene.initial_yaw == null ||
        scene.initial_pitch == null ||
        !Number.isFinite(scene.initial_yaw) ||
        !Number.isFinite(scene.initial_pitch)
      ) {
        return null;
      }

      return {
        yaw: normalizeYaw(scene.initial_yaw),
        pitch: clampPitch(scene.initial_pitch),
      };
    },
    [scenes],
  );

  const getPreviewDirectEntryOrientation = useCallback(
    (targetSceneId: number, link: any | null): Orientation | null => {
      const targetYaw = toNullableNumber(link?.data?.targetYaw);
      if (targetYaw == null) return null;

      const targetPitch = toNullableNumber(link?.data?.targetPitch);
      const sceneStart = getPreviewSceneStartOrientation(targetSceneId);

      return {
        yaw: normalizeYaw(targetYaw),
        pitch: clampPitch(targetPitch ?? sceneStart?.pitch ?? 0),
      };
    },
    [getPreviewSceneStartOrientation],
  );

  const getPreviewReverseEntryOrientation = useCallback(
    (targetSceneId: number, sourceSceneId: number | null): Orientation | null => {
      if (sourceSceneId == null) return null;

      const targetScene = scenes.find(
        (scene) => Number(scene.id) === Number(targetSceneId),
      );
      if (!targetScene) return null;

      const reverseHotspot = targetScene.hotspots.find(
        (hotspot) =>
          Number(hotspot.to_scene_id) === Number(sourceSceneId),
      );
      if (!reverseHotspot) return null;

      const sceneStart = getPreviewSceneStartOrientation(targetSceneId);

      return {
        yaw: normalizeYaw(reverseHotspot.yaw + Math.PI),
        pitch: clampPitch(sceneStart?.pitch ?? 0),
      };
    },
    [scenes, getPreviewSceneStartOrientation],
  );

  const getPreviewNavigationEntryOrientation = useCallback(
    (targetSceneId: number, link: any | null): Orientation | null => {
      const directOrientation = getPreviewDirectEntryOrientation(
        targetSceneId,
        link,
      );
      if (directOrientation) return directOrientation;

      const sourceSceneId = toNullableNumber(link?.data?.fromSceneId);
      const reverseOrientation = link
        ? getPreviewReverseEntryOrientation(targetSceneId, sourceSceneId)
        : null;
      if (reverseOrientation) return reverseOrientation;

      return getPreviewSceneStartOrientation(targetSceneId);
    },
    [
      getPreviewDirectEntryOrientation,
      getPreviewReverseEntryOrientation,
      getPreviewSceneStartOrientation,
    ],
  );

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

    const defaultStartOrientation = getPreviewSceneStartOrientation(
      Number(defaultScene.id),
    );

    let viewer: Viewer | null = null;

    const getPreviewTransitionWithOrientation = (
      orientation: Orientation | null,
    ) => {
      const transition: {
        showLoader: boolean;
        effect: "fade";
        speed: number;
        rotation: boolean;
        rotateTo?: Orientation;
      } = {
        showLoader: false,
        effect: "fade",
        speed: 240,
        rotation: false,
      };

      if (isFiniteOrientation(orientation)) {
        transition.rotateTo = {
          yaw: normalizeYaw(orientation.yaw),
          pitch: clampPitch(orientation.pitch),
        };
      }

      return transition;
    };

    const getPreviewTransitionOptions = (toNode: any, _fromNode?: any, fromLink?: any) => {
      const targetSceneId = Number(toNode?.id ?? fromLink?.nodeId);
      const orientation = Number.isFinite(targetSceneId)
        ? getPreviewNavigationEntryOrientation(targetSceneId, fromLink ?? null)
        : null;

      return getPreviewTransitionWithOrientation(orientation);
    };

    try {
      viewer = new Viewer({
        container: previewContainerRef.current,
        navbar: ["zoom", "move", "fullscreen"],
        defaultYaw: defaultStartOrientation?.yaw ?? 0,
        defaultPitch: defaultStartOrientation?.pitch ?? 0,
        plugins: [
          [
            VirtualTourPlugin,
            {
              positionMode: "manual",
              renderMode: "3d",
              startNodeId: String(defaultScene.id),
              nodes: virtualTourNodes,
              transitionOptions: getPreviewTransitionOptions,
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
  }, [
    virtualTourNodes,
    scenes,
    getPreviewNavigationEntryOrientation,
    getPreviewSceneStartOrientation,
  ]);

  if (authLoading) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!isAdmin) return null;

  const appOrigin = typeof window !== "undefined" ? window.location.origin : "";

  const publicTourUrl = project
    ? isClientTourEditor
      ? `${appOrigin}/client-tour/${project.client_token}`
      : `${appOrigin}/tour/${project.id}`
    : "";

  const embedTourCode = project
    ? isClientTourEditor
      ? `<iframe src="${appOrigin}/embed/client-tour/${project.client_token}" width="100%" height="600" style="border:none;" allowfullscreen loading="lazy"></iframe>`
      : `<iframe src="${appOrigin}/embed/tour/${project.id}" width="100%" height="600" style="border:none;" allowfullscreen loading="lazy"></iframe>`
    : "";

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);

      toast({
        title: "U kopjua",
        description: `${label} u kopjua me sukses.`,
      });
    } catch (error) {
      toast({
        title: "Gabim",
        description: "Kopjimi dështoi. Kopjoje manualisht.",
        variant: "destructive",
      });
    }
  };

  const handleSelectScene = (sceneId: number) => {
    if (
      targetViewCapture &&
      Number(targetViewCapture.targetSceneId) !== Number(sceneId)
    ) {
      toast({
        title: "Kalibrimi është aktiv",
        description:
          "Ruaje ose anuloje drejtimin aktual para se të kalosh në një skenë tjetër.",
      });
      editorSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }

    setSelectedSceneId(sceneId);
  };

  const handleGuidedHotspotAction = async () => {
    if (draft.to_scene_id === "") {
      toast({
        title: "Zgjidh destinacionin",
        description: "Zgjidh skenën ku duhet të dërgojë ky hotspot.",
        variant: "destructive",
      });
      return;
    }

    if (!isPlacementMode) {
      handleStartPlacement();
      return;
    }

    if (draft.yaw === null || draft.pitch === null) {
      handlePlaceHotspotAtCenter();
      return;
    }

    await handleAddHotspot();
  };

  const handleNextSetupAction = async () => {
    if (targetViewCapture) {
      editorSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      toast({
        title: "Përfundo kalibrimin aktiv",
        description: "Ruaje ose anuloje drejtimin e hyrjes para hapit tjetër.",
      });
      return;
    }

    if (scenes.length === 0) {
      openCreateScene();
      return;
    }

    const invalidImageScene = invalidSceneImages[0];
    if (invalidImageScene) {
      setSelectedSceneId(invalidImageScene.id);
      openEditScene(invalidImageScene);
      toast({
        title: "Fotoja 360° duhet rregulluar",
        description: `Kontrollo URL-në e skenës “${invalidImageScene.title}”.`,
        variant: "destructive",
      });
      return;
    }

    if (defaultScenes.length !== 1) {
      const preferredScene =
        defaultScenes[0] ||
        [...scenes].sort(
          (a, b) => a.sort_order - b.sort_order || a.id - b.id,
        )[0];
      if (preferredScene) {
        await handleSetDefaultScene(preferredScene.id);
      }
      return;
    }

    const sceneWithoutStartView = missingSceneStartViews[0];
    if (sceneWithoutStartView) {
      setSelectedSceneId(sceneWithoutStartView.id);
      toast({
        title: "Ruaj këndin fillestar",
        description: `Rrotullo skenën “${sceneWithoutStartView.title}” në drejtimin ideal dhe kliko “Ruaj këndin fillestar”.`,
      });
      window.setTimeout(() => {
        editorSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 120);
      return;
    }

    const brokenConnection = brokenHotspotConnections[0];
    if (brokenConnection) {
      setSelectedSceneId(brokenConnection.sourceScene.id);
      toast({
        title: "Lidhje e pavlefshme",
        description: `Zgjidh një destinacion të ri për hotspot-in në “${brokenConnection.sourceScene.title}”.`,
        variant: "destructive",
      });
      window.setTimeout(() => {
        openEditHotspot(brokenConnection.hotspot);
        editorSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 140);
      return;
    }

    const missingCalibration = missingTargetViewHotspots[0];
    if (missingCalibration) {
      startTargetViewCapture(missingCalibration.hotspot);
      window.setTimeout(() => {
        editorSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 120);
      return;
    }

    previewSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    toast({
      title: "Turi është gati",
      description: "Kontrollo preview-in final dhe pastaj publikoje ose aktivizoje turin.",
    });
  };

  const guidedHotspotActionLabel =
    draft.to_scene_id === ""
      ? "Zgjidh destinacionin"
      : !isPlacementMode
        ? "1. Fillo vendosjen"
        : draft.yaw === null || draft.pitch === null
          ? "2. Vendose hotspot-in në qendër"
          : isSavingHotspot
            ? "Duke ruajtur..."
            : autoCalibrateAfterAdd
              ? "3. Ruaj dhe kalibro hyrjen"
              : "3. Ruaj hotspot-in";

  const nextSetupActionLabel =
    targetViewCapture
      ? "Përfundo kalibrimin aktiv"
      : scenes.length === 0
      ? "Shto skenën e parë"
      : invalidSceneImages.length > 0
        ? "Rregullo foton 360°"
        : defaultScenes.length !== 1
          ? "Normalizo skenën fillestare"
          : missingSceneStartViews.length > 0
            ? "Ruaj këndin fillestar të radhës"
            : brokenHotspotConnections.length > 0
              ? "Rregullo lidhjen e pavlefshme"
              : missingTargetViewHotspots.length > 0
                ? "Kalibro hyrjen e radhës"
                : "Kontrollo preview-in final";

  const publishButtonTitle = tourReadiness.isReady
    ? "Turi është gati për publikim."
    : `${tourReadiness.remainingTasks} detyrë(a) duhen përfunduar para publikimit.`;

  const sceneBeingEdited =
    editingSceneId !== null
      ? scenes.find((scene) => Number(scene.id) === Number(editingSceneId)) || null
      : null;
  const isEditingOnlyDefaultScene =
    !!sceneBeingEdited?.is_default && defaultScenes.length === 1;

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border p-4 md:p-6 flex items-center justify-between">
        <div className="flex items-center gap-4 flex-wrap w-full">
          <button
            onClick={() =>
              setLocation(isClientTourEditor ? "/admin/client-tours" : "/admin")
            }
            className="w-10 h-10 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center text-foreground transition-colors"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold text-foreground leading-none">
              Menaxho Turin Virtual
            </h1>
            <p className="text-muted-foreground text-xs uppercase tracking-widest mt-1 truncate">
              {project?.title || "Duke ngarkuar..."}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <span
              className={`px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-widest border ${
                computedTourStatus === "published" ||
                computedTourStatus === "active"
                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                  : computedTourStatus === "paused"
                    ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
                    : computedTourStatus === "expired"
                      ? "bg-red-500/10 text-red-400 border-red-500/30"
                      : "bg-muted text-muted-foreground border-border"
              }`}
            >
              {isClientTourEditor
                ? computedTourStatus === "active"
                  ? "Active"
                  : computedTourStatus === "paused"
                    ? "Paused"
                    : computedTourStatus === "expired"
                      ? "Expired"
                      : "Draft"
                : computedTourStatus === "published"
                  ? "Published"
                  : "Draft"}
            </span>

            {isClientTourEditor && project?.tour_expires_at && (
              <span className="text-xs text-muted-foreground border border-border px-3 py-2 rounded-xl">
                Skadon:{" "}
                {new Date(project.tour_expires_at).toLocaleDateString("sq-AL")}
              </span>
            )}

            {isClientTourEditor && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  min={todayInputValue}
                  value={expiresAtInput}
                  onChange={(e) => setExpiresAtInput(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary"
                />

                <button
                  onClick={handleSaveClientExpiry}
                  className="px-4 py-2 rounded-xl bg-muted text-foreground hover:bg-muted/80 font-semibold text-sm"
                >
                  Ruaj Datën
                </button>
              </div>
            )}

            {isClientTourEditor ? (
              <>
                {computedTourStatus !== "active" && (
                  <button
                    onClick={handlePublishTour}
                    disabled={!tourReadiness.isReady}
                    title={publishButtonTitle}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Aktivizo Turin
                  </button>
                )}

                {computedTourStatus === "active" && (
                  <button
                    onClick={handlePauseTour}
                    className="px-4 py-2 rounded-xl bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 font-semibold text-sm"
                  >
                    Pezullo
                  </button>
                )}

                {computedTourStatus !== "draft" && (
                  <button
                    onClick={handleUnpublishTour}
                    className="px-4 py-2 rounded-xl bg-muted text-foreground hover:bg-muted/80 font-semibold text-sm"
                  >
                    Kthe në Draft
                  </button>
                )}
              </>
            ) : (
              <>
                {computedTourStatus === "published" ? (
                  <button
                    onClick={handleUnpublishTour}
                    className="px-4 py-2 rounded-xl bg-muted text-foreground hover:bg-muted/80 font-semibold text-sm"
                  >
                    Kthe në Draft
                  </button>
                ) : (
                  <button
                    onClick={handlePublishTour}
                    disabled={!tourReadiness.isReady}
                    title={publishButtonTitle}
                    className="px-4 py-2 rounded-xl bg-primary text-black hover:bg-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Publiko Turin
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-8 space-y-8">
	  
	  <div className="glass-panel rounded-2xl border border-border px-5 py-4">
  <label className="flex items-center justify-between gap-5 cursor-pointer">
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-foreground">
          Aura360 Branding
        </span>

        <span className="text-[10px] uppercase tracking-widest text-primary border border-primary/25 bg-primary/5 px-2 py-1 rounded-full">
          Default On
        </span>
      </div>

      <p className="text-sm text-muted-foreground mt-1">
        Shfaq “Powered by Aura360” në turin virtual publik.
      </p>
    </div>

    <input
      type="checkbox"
      checked={project?.show_aura360_branding ?? true}
      disabled={!project || isSavingBranding}
      onChange={(event) =>
        void handleAura360BrandingChange(
          event.target.checked,
        )
      }
      className="h-5 w-5 shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-50"
      aria-label="Shfaq Powered by Aura360"
    />
  </label>
</div>
	  
	  
        <div
          className={`glass-panel p-6 rounded-2xl border ${
            tourReadiness.isReady
              ? "border-emerald-500/30"
              : "border-primary/20"
          }`}
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  tourReadiness.isReady
                    ? "bg-emerald-500/10 text-emerald-500"
                    : "bg-primary/10 text-primary"
                }`}
              >
                {tourReadiness.isReady ? <Check size={22} /> : <Crosshair size={22} />}
              </div>

              <div>
                <h2 className="font-display text-xl font-bold text-foreground">
                  Asistenti i Konfigurimit Profesional
                </h2>
                <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
                  Ndiq hapin e radhës. Sistemi kontrollon skenat, këndet fillestare,
                  lidhjet dhe drejtimin e saktë të hyrjes për secilin hotspot.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-3xl font-bold text-foreground">
                  {tourReadiness.qualityScore}%
                </div>
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  Gatishmëria
                </div>
              </div>

              <button
                type="button"
                onClick={handleNextSetupAction}
                className="px-5 py-3 rounded-xl bg-primary text-black font-bold text-sm hover:bg-white transition-colors inline-flex items-center gap-2"
              >
                <LocateFixed size={16} />
                {nextSetupActionLabel}
              </button>
            </div>
          </div>

          <div className="h-2 rounded-full bg-muted overflow-hidden mt-5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                tourReadiness.isReady ? "bg-emerald-500" : "bg-primary"
              }`}
              style={{ width: `${tourReadiness.qualityScore}%` }}
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                <ImageIcon size={14} /> Skenat
              </div>
              <div className="text-xl font-bold text-foreground mt-2">
                {scenes.length}
              </div>
              <div className="text-xs text-muted-foreground mt-1 truncate">
                {defaultScenes.length === 1 && defaultScene
                  ? `Fillestare: ${defaultScene.title}`
                  : defaultScenes.length > 1
                    ? `${defaultScenes.length} skena fillestare - rregullo`
                    : "Pa skenë fillestare"}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                <Crosshair size={14} /> Këndet fillestare
              </div>
              <div className="text-xl font-bold text-foreground mt-2">
                {scenes.length - missingSceneStartViews.length}/{scenes.length}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {missingSceneStartViews.length === 0
                  ? "Të gjitha të ruajtura"
                  : `${missingSceneStartViews.length} pa u ruajtur`}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                <Link2 size={14} /> Lidhjet
              </div>
              <div className="text-xl font-bold text-foreground mt-2">
                {totalHotspots}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {brokenHotspotConnections.length === 0
                  ? "Të gjitha destinacionet valide"
                  : `${brokenHotspotConnections.length} lidhje të pavlefshme`}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                <LocateFixed size={14} /> Hyrjet e kalibruara
              </div>
              <div className="text-xl font-bold text-foreground mt-2">
                {calibratedHotspots}/{totalHotspots}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {missingTargetViewHotspots.length === 0
                  ? "Drejtimet janë të sakta"
                  : `${missingTargetViewHotspots.length} hyrje për kalibrim`}
              </div>
            </div>
          </div>

          <div
            className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
              tourReadiness.isReady
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                : "border-border bg-muted/30 text-muted-foreground"
            }`}
          >
            {tourReadiness.isReady
              ? "Turi është plotësisht i konfiguruar. Kontrollo preview-in final dhe publikoje."
              : tourReadiness.remainingTasks === 1
                ? "Ka mbetur 1 detyrë. Butoni sipër të dërgon direkt te hapi i duhur."
                : `Kanë mbetur ${tourReadiness.remainingTasks} detyra. Butoni sipër të dërgon gjithmonë te hapi i radhës.`}
          </div>
        </div>

        {((!isClientTourEditor && computedTourStatus === "published") ||
          (isClientTourEditor && computedTourStatus === "active")) && (
          <div className="glass-panel p-6 rounded-2xl border border-primary/20">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 border-b border-border pb-4 mb-5">
              <div>
                <h2 className="font-display text-xl text-primary font-bold">
                  Share Virtual Tour
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Dërgoja klientit si link ose vendose në website-in e tij me embed code.
                </p>
              </div>

              <span className="px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-widest border bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                Live
              </span>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Public Link
                </label>

                <div className="flex flex-col md:flex-row gap-2">
                  <input
                    readOnly
                    value={publicTourUrl}
                    className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none"
                  />

                  <button
                    type="button"
                    onClick={() => copyText(publicTourUrl, "Linku")}
                    className="px-5 py-3 rounded-xl bg-primary text-black font-bold text-sm hover:bg-white transition-colors"
                  >
                    Copy Link
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Embed Code
                </label>

                <div className="flex flex-col md:flex-row gap-2">
                  <textarea
                    readOnly
                    value={embedTourCode}
                    className="flex-1 min-h-[96px] bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground font-mono resize-none focus:outline-none"
                  />

                  <button
                    type="button"
                    onClick={() => copyText(embedTourCode, "Embed code")}
                    className="px-5 py-3 rounded-xl bg-primary text-black font-bold text-sm hover:bg-white transition-colors md:self-start"
                  >
                    Copy Embed
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="glass-panel p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-6 border-b border-border pb-4">
            <div>
              <h2 className="font-display text-xl text-primary font-bold">
                1. Skenat 360°
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Shto panoramat, renditjen dhe skenën fillestare.
              </p>
            </div>

            <button
              onClick={openCreateScene}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-bold tracking-widest uppercase text-xs rounded-xl hover:bg-white hover:text-foreground transition-colors"
            >
              <Plus size={14} /> Shto Skenë
            </button>
          </div>

          {isLoading ? (
            <div className="text-center py-10 text-muted-foreground">
              Duke ngarkuar...
            </div>
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
                        : "border-border"
                    }`}
                  >
                    <div className="aspect-[2/1] bg-black relative">
                      <img
  src={getSceneThumbnailUrl(scene)}
  alt={scene.title}
  loading="lazy"
  decoding="async"
  onError={handleSceneThumbnailError}
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
                        <h3 className="text-foreground font-medium truncate">
                          {scene.title}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Renditja: {scene.sort_order}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Hotspot-e: {scene.hotspots.length}
                        </p>
                        <p
                          className={`text-xs ${
                            scene.initial_yaw != null && scene.initial_pitch != null
                              ? "text-emerald-400"
                              : "text-amber-300"
                          }`}
                        >
                          {scene.initial_yaw != null && scene.initial_pitch != null
                            ? "Këndi fillestar: i ruajtur"
                            : "Këndi fillestar: mungon"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Hyrje të kalibruara:{" "}
                          {
                            scene.hotspots.filter(
                              (hotspot) =>
                                hotspot.target_yaw != null &&
                                hotspot.target_pitch != null,
                            ).length
                          }
                          /{scene.hotspots.length}
                        </p>
                      </div>

                      <button
                        onClick={() => handleSelectScene(Number(scene.id))}
                        className={`w-full py-2 rounded-xl text-sm flex items-center justify-center gap-2 ${
                          selectedSceneId === scene.id
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-foreground hover:bg-muted/80"
                        }`}
                      >
                        <Crosshair size={14} /> Konfiguro Skenën
                      </button>

                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => openEditScene(scene)}
                          className="py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground flex items-center justify-center"
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
          <div ref={editorSectionRef} className="glass-panel p-6 rounded-2xl scroll-mt-28">
            <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
              <div>
                <h2 className="font-display text-xl text-primary font-bold">
                  2. Editor Profesional i Hotspot-eve
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Puno me radhë: ruaj këndin fillestar, zgjidh destinacionin,
                  vendose hotspot-in në qendër dhe kalibro drejtimin e hyrjes.
                  Viewer-i mbetet stabil gjatë vendosjes dhe rregullimeve.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={handleSaveSceneStartView}
                disabled={isSavingStartView || !!targetViewCapture}
                className="px-4 py-2 rounded-xl bg-muted text-foreground hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingStartView
                  ? "Duke ruajtur..."
                  : selectedScene.initial_yaw != null &&
                      selectedScene.initial_pitch != null
                    ? "Përditëso këndin fillestar"
                    : "Ruaj këndin fillestar"}
              </button>

              {selectedScene.initial_yaw != null && selectedScene.initial_pitch != null && (
                <div className="px-4 py-2 rounded-xl bg-muted text-xs text-muted-foreground border border-border">
                  Start view: {selectedScene.initial_yaw.toFixed(3)} /{" "}
                  {selectedScene.initial_pitch.toFixed(3)}
                </div>
              )}

              <button
                type="button"
                onClick={handleCalibrateNextMissingTargetView}
                disabled={!!targetViewCapture}
                className={`px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed ${
                  missingTargetViewHotspots.length > 0
                    ? "bg-primary text-black"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                Kalibro hyrjen e radhës
                {missingTargetViewHotspots.length > 0
                  ? ` (${missingTargetViewHotspots.length})`
                  : ""}
              </button>

              <div className="px-4 py-2 rounded-xl bg-muted text-xs text-muted-foreground border border-border">
                Target-e unike: {usedTargetSceneIds.size} · Cluster-e: {selectedSceneClusterGroups.length}
              </div>
            </div>

            {selectedSceneClusterGroups.length > 0 && (
              <div className="mb-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
                U gjetën {selectedSceneClusterGroups.length} grup(e) hotspot-esh afër njëra-tjetrës.
                Në editor dhe në turin publik ato shfaqen me fan-out që të mos mbivendosen,
                ndërsa pozicioni real i hotspot-it mbetet i pandryshuar për kalibrim.
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                {targetViewCapture && selectedScene.id === targetViewCapture.targetSceneId && (
                  <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm text-foreground space-y-3">
                    <div>
                      <h3 className="font-semibold text-primary">
                        Kalibrimi i drejtimit të hyrjes
                      </h3>
                      <p className="text-muted-foreground mt-1">
                        Po rregullon hyrjen nga “{targetViewCapture.sourceTitle}” në
                        “{targetViewCapture.targetTitle}”. Rrotullo këtë skenë në
                        drejtimin ku duhet të shikojë klienti menjëherë pas kalimit,
                        pastaj ruaje.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-xl border border-primary/20 bg-background/40 p-3 text-xs">
                      <div>
                        <span className="text-muted-foreground">Këndi aktual</span>
                        <div className="font-mono text-foreground mt-1">
                          {cameraCenter
                            ? `${cameraCenter.yaw.toFixed(4)} / ${cameraCenter.pitch.toFixed(4)}`
                            : "Duke lexuar..."}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          {targetViewCapture.suggestionSource === "saved"
                            ? "Këndi i ruajtur më parë"
                            : targetViewCapture.suggestionSource === "reverse_link"
                              ? "Sugjerim nga lidhja e kundërt"
                              : "Pikënisje nga skena"}
                        </span>
                        <div className="font-mono text-foreground mt-1">
                          {targetViewCapture.suggestedOrientation.yaw.toFixed(4)} /{" "}
                          {targetViewCapture.suggestedOrientation.pitch.toFixed(4)}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1">
                          {targetViewCapture.suggestionSource === "saved"
                            ? "Po rihapet kalibrimi ekzistues për rregullim të imët."
                            : targetViewCapture.suggestionSource === "reverse_link"
                              ? "Sistemi e ka kthyer automatikisht drejtimin 180° nga hotspot-i i kthimit."
                              : "Nuk ka lidhje të kundërt; kontrolloje dhe rrotulloje manualisht."}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleSaveTargetViewCapture}
                        disabled={isSavingTargetView}
                        className="px-4 py-2 rounded-xl bg-primary text-black font-semibold inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <LocateFixed size={16} />
                        {isSavingTargetView
                          ? "Duke ruajtur..."
                          : `Ruaj dhe kthehu te ${targetViewCapture.sourceTitle}`}
                      </button>

                      <button
                        type="button"
                        onClick={handleCancelTargetViewCapture}
                        className="px-4 py-2 rounded-xl bg-muted text-foreground hover:bg-muted/80"
                      >
                        Anulo
                      </button>
                    </div>
                  </div>
                )}

                {viewerError && (
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                    {viewerError}
                  </div>
                )}

                <div className="aspect-[16/9] rounded-2xl overflow-hidden border border-border bg-black relative">
                  <div ref={editorContainerRef} className="w-full h-full" />

                  {(isPlacementMode || isEditingHotspotPlacement || !!targetViewCapture) && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20">
                      <div className="relative w-10 h-10">
                        <div className="absolute left-1/2 top-0 bottom-0 w-[2px] -translate-x-1/2 bg-white/90 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.35)]" />
                        <div className="absolute top-1/2 left-0 right-0 h-[2px] -translate-y-1/2 bg-white/90 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.35)]" />
                        <div className="absolute left-1/2 top-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-black/40 shadow-[0_0_16px_rgba(212,175,55,0.35)]" />
                      </div>
                    </div>
                  )}

                  <div className="absolute top-3 left-3 px-3 py-1.5 rounded-xl bg-black/50 text-xs text-white/90 pointer-events-none backdrop-blur-md">
                    {targetViewCapture
                      ? "Kalibrim aktiv: drejtimi në qendër të pamjes do të ruhet si hyrja në këtë skenë"
                      : isEditingHotspotPlacement
                        ? "Rrotullo panoramën dhe përdor “Vendose në Qendër” për pozicionin e ri"
                      : isPlacementMode
                        ? draft.yaw !== null && draft.pitch !== null
                          ? "Pozicioni u vendos. Shiko markerin e kuq në pamje, rafinoje me butonat ose ruaje"
                          : "Placement mode aktiv. Rrotullo panoramën derisa pika e dëshiruar të jetë në qendër dhe kliko “Vendose në Qendër”"
                        : "Zgjidh target-in dhe aktivizo placement mode"}
                  </div>

                  <div className="absolute top-3 right-3 px-3 py-1.5 rounded-xl bg-black/50 text-xs text-white/90 backdrop-blur-md">
                    Qendra aktuale:{" "}
                    {cameraCenter
                      ? `${cameraCenter.yaw.toFixed(3)} / ${cameraCenter.pitch.toFixed(3)}`
                      : "Duke lexuar..."}
                  </div>
                </div>


                {!targetViewCapture && (
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-4">
                  <h3 className="text-foreground font-medium flex items-center gap-2">
                    <Link2 size={16} /> Shto hotspot të ri
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-2">
                        Skena destinacion
                      </label>
                      <select
                        className="w-full bg-background border border-border rounded-xl px-3 py-3 text-foreground"
                        value={draft.to_scene_id}
                        onChange={(e) => {
                          const nextTargetId = e.target.value
                            ? Number(e.target.value)
                            : "";
                          const targetScene =
                            nextTargetId === ""
                              ? null
                              : scenes.find(
                                  (scene) => Number(scene.id) === Number(nextTargetId),
                                );

                          setDraft((prev) => ({
                            ...prev,
                            to_scene_id: nextTargetId,
                            label:
                              prev.label.trim() === ""
                                ? getSmartHotspotLabel(targetScene?.title)
                                : prev.label,
                          }));
                        }}
                      >
                        <option value="">Zgjidh skenën</option>
                        {availableTargetScenes.map((scene) => {
                          const usageCount = targetUsageCounts.get(Number(scene.id)) || 0;

                          return (
                            <option key={String(scene.id)} value={scene.id}>
                              {scene.title}
                              {usageCount > 0
                                ? ` · përdorur ${usageCount} ${usageCount === 1 ? "herë" : "herë"}`
                                : ""}
                            </option>
                          );
                        })}
                      </select>

                      {draft.to_scene_id !== "" &&
                        (targetUsageCounts.get(Number(draft.to_scene_id)) || 0) > 0 && (
                          <p className="mt-2 text-xs text-primary">
                            Ky target është përdorur më parë në këtë skenë. Sistemi do ta
                            trajtojë si hyrje të veçantë dhe do ta shfaqë me fan-out nëse
                            hotspot-et janë afër.
                          </p>
                        )}

                      {availableTargetScenes.length === 0 && (
                        <p className="mt-2 text-xs text-amber-300">
                          Shto të paktën edhe një skenë tjetër për të krijuar hotspot.
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-2">
                        Etiketa
                      </label>
                      <input
                        className="w-full bg-background border border-border rounded-xl px-3 py-3 text-foreground"
                        value={draft.label}
                        onChange={(e) =>
                          setDraft((prev) => ({ ...prev, label: e.target.value }))
                        }
                        placeholder="P.sh. Shko në korridor"
                      />
                    </div>
                  </div>

                  <label className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={autoCalibrateAfterAdd}
                      onChange={(e) => setAutoCalibrateAfterAdd(e.target.checked)}
                      className="mt-0.5 accent-primary"
                    />
                    <span>
                      <strong className="text-foreground">Smart workflow:</strong>{" "}
                      pas ruajtjes së hotspot-it më dërgo automatikisht në skenën
                      destinacion për të ruajtur drejtimin e hyrjes.
                    </span>
                  </label>

                  <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <span>
                        <strong className="text-foreground">Status:</strong>{" "}
                        {isPlacementMode
                          ? draft.yaw !== null && draft.pitch !== null
                            ? "Gati për ruajtje"
                            : "Rrotullo panoramën dhe vendose në qendër"
                          : "Joaktiv"}
                      </span>
                      <span>
                        <strong className="text-foreground">Yaw/Pitch:</strong>{" "}
                        {draft.yaw !== null && draft.pitch !== null
                          ? `${draft.yaw.toFixed(3)} / ${draft.pitch.toFixed(3)}`
                          : "Pa zgjedhur"}
                      </span>
                      <span>
                        <strong className="text-foreground">Target:</strong>{" "}
                        {draft.to_scene_id === ""
                          ? "Pa zgjedhur"
                          : scenes.find(
                              (scene) => scene.id === Number(draft.to_scene_id),
                            )?.title || "Pa zgjedhur"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleGuidedHotspotAction}
                      disabled={draft.to_scene_id === "" || isSavingHotspot}
                      className="px-5 py-3 rounded-xl bg-primary text-black font-bold inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {draft.yaw !== null && draft.pitch !== null ? (
                        <Check size={16} />
                      ) : (
                        <LocateFixed size={16} />
                      )}
                      {guidedHotspotActionLabel}
                    </button>

                    {isPlacementMode && (
                      <>
                        <button
                          type="button"
                          onClick={() => resetDraft(true)}
                          disabled={draft.yaw === null || draft.pitch === null}
                          className="px-4 py-3 rounded-xl bg-muted text-foreground hover:bg-muted/80 inline-flex items-center gap-2 disabled:opacity-50"
                        >
                          <X size={16} />
                          Rivendos pozicionin
                        </button>

                        <button
                          type="button"
                          onClick={handleStopPlacement}
                          className="px-4 py-3 rounded-xl bg-muted text-foreground hover:bg-muted/80"
                        >
                          Anulo vendosjen
                        </button>
                      </>
                    )}
                  </div>

                  {isPlacementMode && draft.yaw !== null && draft.pitch !== null && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                      <button
                        type="button"
                        onClick={() => nudgeDraftPosition(-0.005, 0)}
                        className="px-3 py-2 rounded-xl bg-muted text-foreground hover:bg-muted/80 inline-flex items-center gap-2"
                      >
                        <ArrowLeftRight size={14} />
                        Majtas
                      </button>
                      <button
                        type="button"
                        onClick={() => nudgeDraftPosition(0.005, 0)}
                        className="px-3 py-2 rounded-xl bg-muted text-foreground hover:bg-muted/80"
                      >
                        Djathtas
                      </button>
                      <button
                        type="button"
                        onClick={() => nudgeDraftPosition(0, -0.005)}
                        className="px-3 py-2 rounded-xl bg-muted text-foreground hover:bg-muted/80 inline-flex items-center gap-2"
                      >
                        <ArrowUp size={14} />
                        Lart
                      </button>
                      <button
                        type="button"
                        onClick={() => nudgeDraftPosition(0, 0.005)}
                        className="px-3 py-2 rounded-xl bg-muted text-foreground hover:bg-muted/80 inline-flex items-center gap-2"
                      >
                        <ArrowDown size={14} />
                        Poshtë
                      </button>
                    </div>

                  )}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-border bg-card p-4">
                <h3 className="text-foreground font-medium mb-4">
                  Hotspot-et ekzistuese
                </h3>

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
                            className="rounded-xl border border-border bg-muted/40 p-3 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="text-sm text-foreground font-medium truncate">
                                {target?.title || "Skenë e panjohur"}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {hotspot.label || "Pa etiketë"}
                              </div>
                              <div className="text-[11px] text-muted-foreground mt-1">
                                yaw {hotspot.yaw.toFixed(3)} / pitch{" "}
                                {hotspot.pitch.toFixed(3)}
                              </div>
                              <div className="text-[11px] mt-1">
                                {hotspot.target_yaw != null && hotspot.target_pitch != null ? (
                                  <span className="text-emerald-400">
                                    Drejtimi i hyrjes: {hotspot.target_yaw.toFixed(3)} /{" "}
                                    {hotspot.target_pitch.toFixed(3)}
                                  </span>
                                ) : (
                                  <span className="text-amber-300">
                                    Drejtimi i hyrjes: jo i kalibruar
                                  </span>
                                )}
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
                                onClick={() => handleSaveHotspotTargetView(hotspot.id)}
                                className={`p-2 rounded-lg hover:bg-muted/80 ${
                                  hotspot.target_yaw != null && hotspot.target_pitch != null
                                    ? "bg-emerald-500/10 text-emerald-500"
                                    : "bg-muted text-foreground"
                                }`}
                                title="Rregullo drejtimin e hyrjes"
                              >
                                <LocateFixed size={14} />
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

        <div ref={previewSectionRef} className="glass-panel p-6 rounded-2xl scroll-mt-28">
          <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
            <div>
              <h2 className="font-display text-xl text-primary font-bold">
                3. Preview i Turit
              </h2>
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
              <div className="aspect-[16/9] rounded-2xl overflow-hidden border border-border bg-black">
                <div ref={previewContainerRef} className="w-full h-full" />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {scenes
                  .slice()
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((scene) => (
                    <div
                      key={String(scene.id)}
                      className="rounded-xl overflow-hidden border border-border bg-card"
                    >
                      <div className="aspect-[4/3] bg-black">
<img
  src={getSceneThumbnailUrl(scene)}
  alt={scene.title}
  loading="lazy"
  decoding="async"
  onError={handleSceneThumbnailError}
  className="w-full h-full object-cover"
/>
                      </div>
                      <div className="p-2">
                        <p className="text-xs text-foreground truncate">
                          {scene.title}
                        </p>
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
          <div className="flex items-center justify-between mb-6 border-b border-border pb-4">
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
              className="flex-1 max-w-[700px] aspect-[4/3] bg-muted/40 border-2 border-border rounded-2xl relative overflow-hidden"
              style={{
                backgroundImage:
                  "radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/20 pointer-events-none select-none">
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

            <div className="w-full md:w-72 rounded-2xl border border-border bg-white/5 p-4">
              <h3 className="text-foreground font-medium mb-4">Skenat</h3>
              <div className="space-y-3">
                {scenes
                  .slice()
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((scene) => (
                    <div
                      key={String(scene.id)}
                      className="flex items-center gap-3 rounded-xl bg-muted/40 p-2.5 border border-border"
                    >
                      
					  
					  <div className="w-8 h-8 rounded-lg overflow-hidden bg-black shrink-0">
  <img
    src={getSceneThumbnailUrl(scene)}
    alt={scene.title}
    loading="lazy"
    decoding="async"
    onError={handleSceneThumbnailError}
    className="w-full h-full object-cover"
  />
</div>
					  
					  
					  
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">
                          {scene.title}
                        </p>
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
        <DialogContent className="bg-card border-border text-foreground">
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
                className="w-full bg-background border border-border rounded-xl px-3 py-3 text-sm text-foreground focus:border-primary focus:outline-none"
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
                className="w-full bg-background border border-border rounded-xl px-3 py-3 text-sm text-foreground focus:border-primary focus:outline-none"
                value={sceneForm.imageUrl}
                onChange={(e) =>
                  setSceneForm((prev) => ({ ...prev, imageUrl: e.target.value }))
                }
                placeholder="https://..."
              />
            </div>

            
			<div className="space-y-2">
  <label className="text-xs uppercase tracking-wider text-muted-foreground">
    Thumbnail URL{" "}
    <span className="normal-case tracking-normal opacity-60">
      (opsionale)
    </span>
  </label>

  <input
    className="w-full bg-background border border-border rounded-xl px-3 py-3 text-sm text-foreground focus:border-primary focus:outline-none"
    value={sceneForm.thumbnailUrl}
    onChange={(e) =>
      setSceneForm((prev) => ({
        ...prev,
        thumbnailUrl: e.target.value,
      }))
    }
    placeholder="https://.../thumbnail.webp"
  />

  <p className="text-[11px] leading-5 text-muted-foreground">
    Nëse lihet bosh, përdoret automatikisht një
    thumbnail i lehtë. Fotografia e plotë 360° nuk
    ngarkohet si preview.
  </p>
</div>
			

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Renditja
                </label>
                <input
                  type="number"
                  className="w-full bg-background border border-border rounded-xl px-3 py-3 text-sm text-foreground focus:border-primary focus:outline-none"
                  value={sceneForm.sortOrder}
                  onChange={(e) =>
                    setSceneForm((prev) => ({
                      ...prev,
                      sortOrder: Number(e.target.value),
                    }))
                  }
                />
              </div>

              <div className="pt-8 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    id="scene-default"
                    type="checkbox"
                    checked={isEditingOnlyDefaultScene ? true : sceneForm.isDefault}
                    disabled={isEditingOnlyDefaultScene}
                    onChange={(e) =>
                      setSceneForm((prev) => ({
                        ...prev,
                        isDefault: e.target.checked,
                      }))
                    }
                    className="accent-primary disabled:opacity-50"
                  />
                  <label htmlFor="scene-default" className="text-sm">
                    Skena fillestare
                  </label>
                </div>
                {isEditingOnlyDefaultScene && (
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Për ta ndryshuar, cakto një skenë tjetër si fillestare.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button
              onClick={() => setIsSceneModalOpen(false)}
              className="px-4 py-2 text-sm hover:bg-muted rounded-lg"
            >
              Anulo
            </button>
            <button
              onClick={handleSaveScene}
              disabled={isSavingScene}
              className="px-4 py-2 bg-primary text-black font-bold text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSavingScene ? "Duke ruajtur..." : "Ruaj Skenën"}
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
        <DialogContent className="bg-card border-border text-foreground">
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
                  className="w-full bg-background border border-border rounded-xl px-3 py-3 text-foreground"
                  value={editingHotspot.to_scene_id}
                  onChange={(e) =>
                    setEditingHotspot((prev) => {
                      if (!prev) return prev;

                      const nextTargetId = e.target.value
                        ? Number(e.target.value)
                        : "";
                      const didTargetChange =
                        Number(prev.to_scene_id) !== Number(nextTargetId);
                      const targetScene =
                        nextTargetId === ""
                          ? null
                          : scenes.find(
                              (scene) => Number(scene.id) === Number(nextTargetId),
                            );

                      return {
                        ...prev,
                        to_scene_id: nextTargetId,
                        label:
                          prev.label.trim() === ""
                            ? getSmartHotspotLabel(targetScene?.title)
                            : prev.label,
                        target_yaw: didTargetChange ? null : prev.target_yaw,
                        target_pitch: didTargetChange ? null : prev.target_pitch,
                      };
                    })
                  }
                >
                  {scenes
                    .filter((scene) => Number(scene.id) !== Number(selectedSceneId))
                    .map((scene) => {
                      const usageCount = targetUsageCounts.get(Number(scene.id)) || 0;

                      return (
                        <option key={String(scene.id)} value={scene.id}>
                          {scene.title}
                          {usageCount > 0 && Number(scene.id) !== Number(editingHotspot?.to_scene_id)
                            ? ` · përdorur ${usageCount} herë`
                            : ""}
                        </option>
                      );
                    })}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Etiketa
                </label>
                <input
                  className="w-full bg-background border border-border rounded-xl px-3 py-3 text-foreground"
                  value={editingHotspot.label}
                  onChange={(e) =>
                    setEditingHotspot((prev) =>
                      prev ? { ...prev, label: e.target.value } : prev,
                    )
                  }
                  placeholder="P.sh. Shko në korridor"
                />
              </div>

              <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <span>
                    <strong className="text-foreground">Pozicioni:</strong>{" "}
                    {editingHotspot.yaw.toFixed(3)} /{" "}
                    {editingHotspot.pitch.toFixed(3)}
                  </span>
                  <span>
                    <strong className="text-foreground">Statusi:</strong>{" "}
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
                  onClick={handleSaveEditedHotspotAndCalibrate}
                  disabled={isSavingHotspotEdit}
                  className="px-4 py-2 rounded-xl bg-muted text-foreground hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingHotspotEdit
                    ? "Duke ruajtur..."
                    : "Ruaj dhe kalibro drejtimin e hyrjes"}
                </button>

                <button
                  type="button"
                  onClick={() => nudgeEditingHotspotPosition(-0.005, 0)}
                  className="px-3 py-2 rounded-xl bg-muted text-foreground hover:bg-muted/80"
                >
                  Majtas
                </button>
                <button
                  type="button"
                  onClick={() => nudgeEditingHotspotPosition(0.005, 0)}
                  className="px-3 py-2 rounded-xl bg-muted text-foreground hover:bg-muted/80"
                >
                  Djathtas
                </button>
                <button
                  type="button"
                  onClick={() => nudgeEditingHotspotPosition(0, -0.005)}
                  className="px-3 py-2 rounded-xl bg-muted text-foreground hover:bg-muted/80"
                >
                  Lart
                </button>
                <button
                  type="button"
                  onClick={() => nudgeEditingHotspotPosition(0, 0.005)}
                  className="px-3 py-2 rounded-xl bg-muted text-foreground hover:bg-muted/80"
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

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button
              onClick={() => {
                setIsEditHotspotModalOpen(false);
                setEditingHotspot(null);
                setIsEditingHotspotPlacement(false);
              }}
              className="px-4 py-2 text-sm hover:bg-muted rounded-lg"
            >
              Anulo
            </button>
            <button
              onClick={handleSaveEditedHotspot}
              disabled={isSavingHotspotEdit}
              className="px-4 py-2 bg-primary text-black font-bold text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSavingHotspotEdit ? "Duke ruajtur..." : "Ruaj Ndryshimet"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
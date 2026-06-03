import PropertyVirtualTourViewer from "@/components/PropertyVirtualTourViewer";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "wouter";
import useEmblaCarousel from "embla-carousel-react";
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Maximize,
  BedDouble,
  Bath,
  LayoutGrid,
  Calendar,
  Layers,
  CheckCircle2,
  Play,
  X,
  Phone,
  Mail,
  Building2,
  ZoomIn,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/lib/supabase";
import { Helmet } from "react-helmet-async";

type ProjectImage = {
  id?: string | number;
  url: string;
  thumbnailUrl?: string;
  thumbnail_url?: string;
  thumbUrl?: string;
  thumb_url?: string;
  caption?: string;
  isPrimary?: boolean;
};

type VirtualTourScene = {
  id: string | number;
  title?: string;
  image?: string;
  yaw?: number;
  pitch?: number;
  hfov?: number;
  hotSpots?: any[];
};

type ProjectType = {
  id: string | number;
  title?: string;
  description?: string;
  address?: string;
  city?: string;
  country?: string;
  status?: string;
  propertyType?: string;
  price?: number;
  currency?: string;
  images?: ProjectImage[];
  areaM2?: number | string;
  area_m2?: number | string;
  bedrooms?: number;
  bathrooms?: number;
  livingRooms?: number;
  living_rooms?: number;
  floors?: number;
  yearBuilt?: number | string;
  year_built?: number | string;
  customFields?: Record<string, any>;
  custom_fields?: Record<string, any>;
  contactCompany?: string;
  contactPhone?: string;
  contactEmail?: string;
  contact_company?: string;
  contact_phone?: string;
  contact_email?: string;
  hasCustomVirtualTour?: boolean;
  has_custom_virtual_tour?: boolean;
  virtualTourUrl?: string;
  virtual_tour_url?: string;
  virtualTourEmbedCode?: string;
  virtual_tour_embed_code?: string;
  virtualTourScenes?: VirtualTourScene[];
  virtual_tour_scenes?: VirtualTourScene[];
  virtual_tour_status?: "draft" | "published";
  virtualTourStatus?: "draft" | "published";
  virtual_tour_published_at?: string | null;
  virtualTourPublishedAt?: string | null;
  defaultSceneId?: string | number;
  default_scene_id?: string | number;
};

function normalizeProject(raw: any): ProjectType {
  return {
    ...raw,
    areaM2: raw?.areaM2 ?? raw?.area_m2,
    livingRooms: raw?.livingRooms ?? raw?.living_rooms,
    yearBuilt: raw?.yearBuilt ?? raw?.year_built,
    customFields: raw?.customFields ?? raw?.custom_fields ?? {},
    contactCompany: raw?.contactCompany ?? raw?.contact_company,
    contactPhone: raw?.contactPhone ?? raw?.contact_phone,
    contactEmail: raw?.contactEmail ?? raw?.contact_email,
    hasCustomVirtualTour:
      raw?.hasCustomVirtualTour ?? raw?.has_custom_virtual_tour ?? false,
    virtualTourUrl: raw?.virtualTourUrl ?? raw?.virtual_tour_url,
    virtualTourEmbedCode:
      raw?.virtualTourEmbedCode ?? raw?.virtual_tour_embed_code,
    virtualTourScenes: raw?.virtualTourScenes ?? raw?.virtual_tour_scenes ?? [],
	virtualTourStatus:
  raw?.virtualTourStatus ?? raw?.virtual_tour_status ?? "draft",
virtualTourPublishedAt:
  raw?.virtualTourPublishedAt ?? raw?.virtual_tour_published_at ?? null,
    defaultSceneId: raw?.defaultSceneId ?? raw?.default_scene_id,
    images: Array.isArray(raw?.images) ? raw.images : [],
  };
}

const formatAreaLabel = (value: number | string) => {
  const n = Number(value);
  return n === 1 ? "Metër Katror" : "Metra Katrorë";
};

const formatFloorLabel = (value: number | string) => {
  const n = Number(value);
  return n === 1 ? "Kat" : "Kate";
};

const formatBedroomLabel = (value: number | string) => {
  const n = Number(value);
  return n === 1 ? "Dhomë Gjumi" : "Dhoma Gjumi";
};

const formatLivingRoomLabel = (value: number | string) => {
  const n = Number(value);
  return n === 1 ? "Dhomë Ndenjeje" : "Dhoma Ndenjeje";
};

const formatBathroomLabel = (_value: number | string) => {
  return "Banjo";
};

export default function ProjectDetails() {
  const { id } = useParams();

  const [project, setProject] = useState<ProjectType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const [hasBuiltInVirtualTour, setHasBuiltInVirtualTour] = useState(false);

const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [showVirtualTour, setShowVirtualTour] = useState(false);
const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
const [showContactModal, setShowContactModal] = useState(false);

const lightboxContainerRef = useRef<HTMLDivElement | null>(null);
const lightboxImageRef = useRef<HTMLImageElement | null>(null);
const lightboxTransformRef = useRef({ scale: 1, x: 0, y: 0 });
const lightboxGestureRef = useRef({
  startX: 0,
  startY: 0,
  startPanX: 0,
  startPanY: 0,
  startScale: 1,
  startDistance: 0,
  isPinching: false,
});
const [lightboxScale, setLightboxScale] = useState(1);
const [isLightboxFullscreen, setIsLightboxFullscreen] = useState(false);
const [imageOrientations, setImageOrientations] = useState<
  Record<number, "landscape" | "portrait" | "square">
>({});
const [viewportSize, setViewportSize] = useState({
  width: typeof window !== "undefined" ? window.innerWidth : 0,
  height: typeof window !== "undefined" ? window.innerHeight : 0,
});

  useEffect(() => {
    requestAnimationFrame(() => {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: "auto",
      });
    });
  }, [id]);

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

const applyLightboxTransform = useCallback((animated = false) => {
  const image = lightboxImageRef.current;
  if (!image) return;

  const { scale, x, y } = lightboxTransformRef.current;

  image.style.transition = animated ? "transform 180ms ease-out" : "none";
  image.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;

  setLightboxScale(scale);
}, []);

const resetLightboxZoom = useCallback(
  (animated = false) => {
    lightboxTransformRef.current = { scale: 1, x: 0, y: 0 };
    lightboxGestureRef.current.isPinching = false;
    applyLightboxTransform(animated);
  },
  [applyLightboxTransform],
);

const openLightbox = (idx: number) => {
  resetLightboxZoom(false);
  setIsLightboxFullscreen(false);
  setLightboxIndex(idx);
};

const closeLightbox = () => {
  resetLightboxZoom(false);
  setIsLightboxFullscreen(false);
  setLightboxIndex(null);

  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
};

  const images = project?.images || [];
  
  const getImagePreviewUrl = (img: any) =>
  img?.thumbnailUrl ||
  img?.thumbnail_url ||
  img?.thumbUrl ||
  img?.thumb_url ||
  img?.url;
  
  const getLightboxImageUrl = (img: any, idx: number) => {
  if (lightboxIndex === null || images.length === 0) {
    return getImagePreviewUrl(img);
  }

  const prevIndex = (lightboxIndex - 1 + images.length) % images.length;
  const nextIndex = (lightboxIndex + 1) % images.length;

  const shouldLoadFullImage =
    idx === lightboxIndex || idx === prevIndex || idx === nextIndex;

  return shouldLoadFullImage ? img.url : getImagePreviewUrl(img);
};
  

const lightboxPrev = useCallback(() => {
  resetLightboxZoom(false);
  setLightboxIndex((current) => {
    if (current === null) return current;
    return Math.max(0, current - 1);
  });
}, [resetLightboxZoom]);

const lightboxNext = useCallback(() => {
  resetLightboxZoom(false);
  setLightboxIndex((current) => {
    if (current === null) return current;
    return Math.min(images.length - 1, current + 1);
  });
}, [images.length, resetLightboxZoom]);

const canLightboxPrev = lightboxIndex !== null && lightboxIndex > 0;
const canLightboxNext =
  lightboxIndex !== null && lightboxIndex < images.length - 1;

const getTouchDistance = (touches: React.TouchList) => {
  const first = touches[0];
  const second = touches[1];

  return Math.hypot(
    second.clientX - first.clientX,
    second.clientY - first.clientY,
  );
};

const handleLightboxTouchStart = useCallback(
  (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2) {
      event.preventDefault();

      lightboxGestureRef.current.isPinching = true;
      lightboxGestureRef.current.startDistance = getTouchDistance(event.touches);
      lightboxGestureRef.current.startScale =
        lightboxTransformRef.current.scale;
      return;
    }

    if (event.touches.length === 1) {
      const touch = event.touches[0];

      lightboxGestureRef.current.startX = touch.clientX;
      lightboxGestureRef.current.startY = touch.clientY;
      lightboxGestureRef.current.startPanX = lightboxTransformRef.current.x;
      lightboxGestureRef.current.startPanY = lightboxTransformRef.current.y;
    }
  },
  [],
);

const handleLightboxTouchMove = useCallback(
  (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2 && lightboxGestureRef.current.isPinching) {
      event.preventDefault();

      const nextDistance = getTouchDistance(event.touches);
      const rawScale =
        lightboxGestureRef.current.startScale *
        (nextDistance / lightboxGestureRef.current.startDistance);
      const nextScale = Math.min(5, Math.max(1, rawScale));

      lightboxTransformRef.current.scale = nextScale;

      if (nextScale <= 1.01) {
        lightboxTransformRef.current.x = 0;
        lightboxTransformRef.current.y = 0;
      }

      applyLightboxTransform(false);
      return;
    }

    if (event.touches.length === 1 && lightboxTransformRef.current.scale > 1) {
      event.preventDefault();

      const touch = event.touches[0];

      lightboxTransformRef.current.x =
        lightboxGestureRef.current.startPanX +
        touch.clientX -
        lightboxGestureRef.current.startX;
      lightboxTransformRef.current.y =
        lightboxGestureRef.current.startPanY +
        touch.clientY -
        lightboxGestureRef.current.startY;

      applyLightboxTransform(false);
    }
  },
  [applyLightboxTransform],
);

const handleLightboxTouchEnd = useCallback(
  (event: React.TouchEvent<HTMLDivElement>) => {
    if (lightboxGestureRef.current.isPinching) {
      lightboxGestureRef.current.isPinching = false;

      if (lightboxTransformRef.current.scale <= 1.03) {
        resetLightboxZoom(true);
      }

      return;
    }

    if (event.changedTouches.length === 0) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - lightboxGestureRef.current.startX;
    const deltaY = touch.clientY - lightboxGestureRef.current.startY;
    const canSwipe = lightboxTransformRef.current.scale <= 1.01;
    const isHorizontalSwipe =
      Math.abs(deltaX) > 55 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4;

    if (canSwipe && isHorizontalSwipe) {
      if (deltaX < 0 && canLightboxNext) {
        lightboxNext();
      }

      if (deltaX > 0 && canLightboxPrev) {
        lightboxPrev();
      }
    }
  },
  [canLightboxNext, canLightboxPrev, lightboxNext, lightboxPrev, resetLightboxZoom],
);

const toggleLightboxFullscreen = useCallback(
  async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    const nextFullscreen = !isLightboxFullscreen;
    setIsLightboxFullscreen(nextFullscreen);
    resetLightboxZoom(true);

    try {
      const container = lightboxContainerRef.current;

      if (
        nextFullscreen &&
        container?.requestFullscreen &&
        !document.fullscreenElement
      ) {
        await container.requestFullscreen();

        const orientationApi = screen.orientation as ScreenOrientation & {
          lock?: (orientation: OrientationLockType) => Promise<void>;
        };

        if (orientationApi.lock) {
          const currentOrientation =
            lightboxIndex !== null ? imageOrientations[lightboxIndex] : null;

          if (currentOrientation === "landscape") {
            await orientationApi.lock("landscape").catch(() => {});
          }
        }
      } else if (!nextFullscreen && document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // Mobile Safari mund të mos lejojë Fullscreen API / Orientation Lock.
      // Modal-i mbetet fixed full-screen si fallback vizual.
    }
  },
  [
    imageOrientations,
    isLightboxFullscreen,
    lightboxIndex,
    resetLightboxZoom,
  ],
);

useEffect(() => {
  const syncViewportSize = () => {
    setViewportSize({
      width: window.innerWidth,
      height: window.innerHeight,
    });
  };

  syncViewportSize();

  window.addEventListener("resize", syncViewportSize);
  window.addEventListener("orientationchange", syncViewportSize);

  return () => {
    window.removeEventListener("resize", syncViewportSize);
    window.removeEventListener("orientationchange", syncViewportSize);
  };
}, []);

useEffect(() => {
  const handleFullscreenChange = () => {
    if (!document.fullscreenElement) {
      setIsLightboxFullscreen(false);

      const orientationApi = screen.orientation as ScreenOrientation & {
        unlock?: () => void;
      };

      orientationApi.unlock?.();
    }
  };

  document.addEventListener("fullscreenchange", handleFullscreenChange);

  return () => {
    document.removeEventListener("fullscreenchange", handleFullscreenChange);
  };
}, []);

useEffect(() => {
  resetLightboxZoom(false);
}, [lightboxIndex, viewportSize.width, viewportSize.height, resetLightboxZoom]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (lightboxIndex !== null) closeLightbox();
        else if (showContactModal) setShowContactModal(false);
        else if (showVirtualTour) setShowVirtualTour(false);
      }

      if (lightboxIndex === null) return;

      if (e.key === "ArrowLeft") lightboxPrev();
      if (e.key === "ArrowRight") lightboxNext();
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxIndex, lightboxPrev, lightboxNext, showContactModal, showVirtualTour]);

  
  
  useEffect(() => {
  let isMounted = true;

  const fetchProject = async () => {
    if (!id) {
      if (isMounted) {
        setProject(null);
        setFetchError(true);
        setIsLoading(false);
      }
      return;
    }

    setIsLoading(true);
    setFetchError(false);

    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!isMounted) return;

    if (error || !data) {
      console.error("Project details fetch error:", error);
      setProject(null);
      setHasBuiltInVirtualTour(false);
      setFetchError(true);
      setIsLoading(false);
      return;
    }

    setProject(normalizeProject(data));

    const { count, error: scenesError } = await supabase
      .from("virtual_tour_scenes")
      .select("id", { count: "exact", head: true })
      .eq("property_id", data.id);

    if (scenesError) {
      console.error("Virtual tour scenes count error:", scenesError);
      setHasBuiltInVirtualTour(false);
    } else {
      setHasBuiltInVirtualTour(
        data.virtual_tour_status === "published" && (count || 0) > 0
      );
    }

    setFetchError(false);
    setIsLoading(false);
  };

  fetchProject();

  return () => {
    isMounted = false;
  };
}, [id]);
  


useEffect(() => {
  if (lightboxIndex === null) return;

  const originalOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  return () => {
    document.body.style.overflow = originalOverflow;
  };
}, [lightboxIndex]);



  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen pt-32 flex items-center justify-center">
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-primary price-font tracking-widest uppercase">
              Duke Ngarkuar Pronën
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  if (fetchError || !project) {
    return (
      <Layout>
        <div className="min-h-screen pt-32 flex items-center justify-center text-center px-4">
          <div>
            <h1 className="price-font text-4xl text-foreground mb-4">
              Prona Nuk U Gjet
            </h1>
            <p className="text-muted-foreground">
              Prona e kërkuar nuk është e disponueshme ose nuk ekziston.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  const formattedPrice = project.price
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: project.currency || "USD",
        maximumFractionDigits: 0,
      }).format(project.price)
    : "Çmimi sipas kërkesës";

const hasFallbackVirtualTour = !!(
  project.virtualTourUrl ||
  project.virtual_tour_url ||
  project.virtualTourEmbedCode ||
  project.virtual_tour_embed_code
);

const hasVirtualTour = hasBuiltInVirtualTour || hasFallbackVirtualTour;

  const statusLabels: Record<string, string> = {
    for_sale: "Në Shitje",
    for_rent: "Me Qira",
  };

  const hasContact = !!(
    project.contactCompany ||
    project.contactPhone ||
    project.contactEmail
  );

  return (
    <Layout>
	<Helmet>
        <title>
          {project
            ? `${project.title ?? "Pronë"}${project.city ? ` — ${project.city}` : ""}${project.country ? `, ${project.country}` : ""} | Aura Estates`
            : "Pronë | Aura Estates"}
        </title>
        <meta
          name="description"
          content={
            project
              ? `${project.title ?? "Pronë ekskluzive"}. ${project.areaM2 ? `${project.areaM2}m². ` : ""}${project.bedrooms ? `${project.bedrooms} dhoma gjumi. ` : ""}${project.city ?? ""}${project.country ? `, ${project.country}` : ""}.`
              : "Shiko detajet e pronës në Aura Estates."
          }
        />
        <meta
          property="og:title"
          content={project ? `${project.title} | Aura Estates` : "Pronë | Aura Estates"}
        />
        <meta
          property="og:description"
          content={
            project?.price
              ? `€${project.price.toLocaleString()} — ${project.city ?? ""}`
              : "Shiko detajet e pronës."
          }
        />
<meta
  property="og:image"
  content={
    project?.images?.[0]?.url ||
    "https://auraks.com/images/hero-bg.png"
  }
/>
        <meta
          property="og:url"
          content={`https://auraks.com/projects/${project?.id ?? ""}`}
        />
        <meta property="og:type" content="article" />
      </Helmet>
      <div className="bg-background pt-24 pb-32 min-h-screen">
        <div className="relative w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 mb-12">
          <div
            className="overflow-hidden rounded-2xl aspect-video md:aspect-[21/9] bg-card border border-border shadow-2xl relative cursor-zoom-in"
            ref={emblaRef}
          >
            <div className="flex h-full">
              {images.length > 0 ? (
                images.map((img, idx) => (
                  <div
                    className="flex-[0_0_100%] min-w-0 h-full relative group"
                    key={img.id || idx}
                    onClick={() => openLightbox(idx)}
                  >
<img
  src={idx === 0 ? img.url : getImagePreviewUrl(img)}
  alt={img.caption || `${project.title} - Foto ${idx + 1}`}
  loading={idx === 0 ? "eager" : "lazy"}
  decoding="async"
  fetchPriority={idx === 0 ? "high" : "low"}
  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
/>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                      <ZoomIn
                        size={40}
                        className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg"
                      />
                    </div>
                    {img.caption && (
                      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
                        <p className="text-white/90 text-sm font-medium">
                          {img.caption}
                        </p>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="flex-[0_0_100%] flex items-center justify-center text-muted-foreground font-display text-xl">
                  Nuk ka foto të disponueshme
                </div>
              )}
            </div>

            {images.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    scrollPrev();
                  }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 md:w-10 md:h-10 rounded-full bg-black/40 hover:bg-black/60 text-white/90 flex items-center justify-center backdrop-blur-md transition-all duration-300 border border-white/10 hover:border-white/20 z-10 group"
                >
                  <ChevronLeft size={18} strokeWidth={2.2} className="group-hover:-translate-x-0.5 transition-transform" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    scrollNext();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 md:w-10 md:h-10 rounded-full bg-black/40 hover:bg-black/60 text-white/90 flex items-center justify-center backdrop-blur-md transition-all duration-300 border border-white/10 hover:border-white/20 z-10 group"
                >
                  <ChevronRight size={18} strokeWidth={2.2} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
              </>
            )}

            {hasVirtualTour && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowVirtualTour(true);
                }}
                className="absolute top-6 right-6 px-6 py-3 rounded-full bg-primary/90 text-primary-foreground font-bold tracking-widest uppercase text-xs flex items-center gap-2 hover:bg-primary hover:scale-105 transition-all shadow-xl backdrop-blur-md z-10"
              >
                <Play size={14} className="fill-current" /> Hap Turin Virtual 360°
              </button>
            )}

            {images.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-black/50 backdrop-blur-md text-white text-xs font-medium z-10 pointer-events-none">
                {images.length} foto
              </div>
            )}
          </div>

          {images.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
              {images.map((img, idx) => (
                <button
                  key={img.id || idx}
                  onClick={() => {
                    openLightbox(idx);
                    emblaApi?.scrollTo(idx);
                  }}
                  className="flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 border-transparent hover:border-primary transition-colors"
                >
                  <img
  src={getImagePreviewUrl(img)}
  alt=""
  loading="lazy"
  decoding="async"
  className="w-full h-full object-cover"
/>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-16">
          <div className="lg:col-span-2 space-y-12">
            <div>
              <div className="flex items-center gap-4 mb-4">
<span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
  {project.status
    ? statusLabels[project.status] || project.status.replaceAll("_", " ")
    : "Pa status"}
</span>
                {project.propertyType && (
                  <span className="text-primary text-sm font-medium tracking-wide uppercase">
                    {project.propertyType}
                  </span>
                )}
              </div>

              <h1 className="price-font text-4xl md:text-5xl font-bold text-foreground mb-4 leading-tight tracking-tight">
                {project.title}
              </h1>

              <div className="flex items-center gap-2 text-muted-foreground text-lg">
                <MapPin className="text-primary" size={20} />
                <span>
                  {project.address ? `${project.address}, ` : ""}
                  {[project.city, project.country].filter(Boolean).join(", ")}
                </span>
              </div>
            </div>

            {project.description && (
              <div>
                <h3 className="price-font text-2xl text-foreground mb-6 border-b border-border pb-4 font-bold">
                  Prona
                </h3>
                <div className="price-font max-w-none text-[17px] leading-8 text-muted-foreground">
                  {String(project.description)
                    .split("\n")
                    .filter((paragraph) => paragraph.trim() !== "")
                    .map((paragraph, i) => (
                      <p key={i} className="mb-5 last:mb-0">
                        {paragraph}
                      </p>
                    ))}
                </div>
              </div>
            )}

            {project.customFields &&
              Object.keys(project.customFields).length > 0 && (
                <div>
                  <h3 className="price-font text-2xl text-foreground mb-6 border-b border-border pb-4 font-bold">
                    Karakteristikat dhe Lehtësitë
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(project.customFields).map(([key, value]) => (
                      <div key={key} className="flex items-start gap-3">
                        <CheckCircle2
                          size={20}
                          className="text-primary shrink-0 mt-0.5"
                        />
                        <div>
                          <span className="block text-foreground capitalize">
                            {key.replace(/_/g, " ")}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {String(value)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-32 space-y-6">
              <div className="glass-panel rounded-2xl p-8">
                <div className="price-font text-4xl text-primary font-semibold mb-5">
                  {formattedPrice}
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                  {project.areaM2 && (
                    <div className="bg-background/50 p-4 rounded-xl border border-border">
                      <Maximize size={20} className="text-primary mb-2" />
                      <span className="block text-foreground text-lg font-medium">
                        {project.areaM2}
                      </span>
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">
                        {formatAreaLabel(project.areaM2)}
                      </span>
                    </div>
                  )}

                  {project.bedrooms && (
                    <div className="bg-background/50 p-4 rounded-xl border border-border">
                      <BedDouble size={20} className="text-primary mb-2" />
                      <span className="block text-foreground text-lg font-medium">
                        {project.bedrooms}
                      </span>
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">
                        {formatBedroomLabel(project.bedrooms)}
                      </span>
                    </div>
                  )}

                  {project.bathrooms && (
                    <div className="bg-background/50 p-4 rounded-xl border border-border">
                      <Bath size={20} className="text-primary mb-2" />
                      <span className="block text-foreground text-lg font-medium">
                        {project.bathrooms}
                      </span>
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">
                        {formatBathroomLabel(project.bathrooms)}
                      </span>
                    </div>
                  )}

                  {project.livingRooms && (
                    <div className="bg-background/50 p-4 rounded-xl border border-border">
                      <LayoutGrid size={20} className="text-primary mb-2" />
                      <span className="block text-foreground text-lg font-medium">
                        {project.livingRooms}
                      </span>
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">
                        {formatLivingRoomLabel(project.livingRooms)}
                      </span>
                    </div>
                  )}

                  {project.floors && (
                    <div className="bg-background/50 p-4 rounded-xl border border-border">
                      <Layers size={20} className="text-primary mb-2" />
                      <span className="block text-foreground text-lg font-medium">
                        {project.floors}
                      </span>
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">
                        {formatFloorLabel(project.floors)}
                      </span>
                    </div>
                  )}

                  {project.yearBuilt && (
                    <div className="bg-background/50 p-4 rounded-xl border border-border">
                      <Calendar size={20} className="text-primary mb-2" />
                      <span className="block text-foreground text-lg font-medium">
                        {project.yearBuilt}
                      </span>
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">
                        Ndërtuar
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
<button
  onClick={() => (window.location.href = "/Contact")}
  className="w-full py-4 bg-primary text-primary-foreground font-bold tracking-widest uppercase text-sm rounded-xl hover:bg-white hover:text-foreground transition-colors"
>
  Planifiko një Vizitë
</button>
                  <button
                    onClick={() => setShowContactModal(true)}
                    className="w-full py-4 bg-transparent border border-border text-foreground font-bold tracking-widest uppercase text-sm rounded-xl hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
                  >
                    <Phone size={16} /> Kërko Informacion
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showContactModal && (
        <div
          className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm flex items-center justify-center px-4"
          onClick={() => setShowContactModal(false)}
        >
          <div
            className="relative w-full max-w-md bg-background rounded-2xl p-8 border border-border shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-2xl text-foreground flex items-center gap-2">
                <Building2 size={22} className="text-primary" /> Kërko Informacion
              </h3>
              <button
                onClick={() => setShowContactModal(false)}
                className="w-9 h-9 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-foreground transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-muted-foreground text-sm mb-6">
              Kontaktoni agjentin për pronën:
              <br />
              <span className="text-foreground font-medium">{project.title}</span>
            </p>

            {hasContact ? (
              <div className="space-y-4">
                {project.contactCompany && (
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-muted border border-border">
                    <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                      <Building2 size={20} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">
                        Kompania
                      </p>
                      <p className="text-foreground font-semibold text-lg">
                        {project.contactCompany}
                      </p>
                    </div>
                  </div>
                )}

                {project.contactPhone && (
                  <a
                    href={`tel:${project.contactPhone}`}
                    className="flex items-center gap-4 p-4 rounded-xl bg-muted border border-border hover:border-primary/50 hover:bg-primary/5 transition-all group"
                  >
                    <div className="w-11 h-11 rounded-xl bg-primary/15 group-hover:bg-primary/25 flex items-center justify-center shrink-0 transition-colors">
                      <Phone size={20} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">
                        Telefoni
                      </p>
                      <p className="text-foreground group-hover:text-primary font-semibold text-lg transition-colors">
                        {project.contactPhone}
                      </p>
                    </div>
                  </a>
                )}

                {project.contactEmail && (
                  <a
                    href={`mailto:${project.contactEmail}`}
                    className="flex items-center gap-4 p-4 rounded-xl bg-muted border border-border hover:border-primary/50 hover:bg-primary/5 transition-all group"
                  >
                    <div className="w-11 h-11 rounded-xl bg-primary/15 group-hover:bg-primary/25 flex items-center justify-center shrink-0 transition-colors">
                      <Mail size={20} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">
                        Email
                      </p>
                      <p className="text-foreground group-hover:text-primary font-semibold text-lg transition-colors">
                        {project.contactEmail}
                      </p>
                    </div>
                  </a>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Phone size={24} className="text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">
                  Informacioni i kontaktit nuk është vendosur ende nga agjenti.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {lightboxIndex !== null && images.length > 0 && (
        <div
          ref={lightboxContainerRef}
          className="fixed inset-0 z-[200] bg-black flex items-center justify-center overflow-hidden select-none"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-5 right-5 w-11 h-11 rounded-full bg-black/55 hover:bg-black/75 backdrop-blur-md flex items-center justify-center text-white transition-colors z-30 border border-white/10"
            aria-label="Mbyll galerinë"
          >
            <X size={22} />
          </button>

          <div className="absolute top-5 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-black/55 backdrop-blur-md text-white text-sm font-medium z-30 border border-white/10">
            {lightboxIndex + 1} / {images.length}
          </div>

          <div
            className="relative w-screen h-[100dvh] flex items-center justify-center overflow-hidden bg-black"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleLightboxTouchStart}
            onTouchMove={handleLightboxTouchMove}
            onTouchEnd={handleLightboxTouchEnd}
            onTouchCancel={handleLightboxTouchEnd}
            style={{
              touchAction: lightboxScale > 1 ? "none" : "pan-y",
            }}
          >
            {(() => {
              const activeImage = images[lightboxIndex];
              const currentOrientation = imageOrientations[lightboxIndex];
              const isLandscapeViewport = viewportSize.width > viewportSize.height;
              const shouldFillViewport =
                isLightboxFullscreen ||
                (isLandscapeViewport && currentOrientation === "landscape");

              return (
                <>
                  <img
                    ref={lightboxImageRef}
                    src={getLightboxImageUrl(activeImage, lightboxIndex)}
                    alt={
                      activeImage.caption ||
                      `${project.title} - Foto ${lightboxIndex + 1}`
                    }
                    loading="eager"
                    decoding="async"
                    onLoad={(event) => {
                      const { naturalWidth, naturalHeight } = event.currentTarget;

                      if (!naturalWidth || !naturalHeight) return;

                      const nextOrientation =
                        naturalWidth > naturalHeight
                          ? "landscape"
                          : naturalHeight > naturalWidth
                            ? "portrait"
                            : "square";

                      setImageOrientations((prev) =>
                        prev[lightboxIndex] === nextOrientation
                          ? prev
                          : { ...prev, [lightboxIndex]: nextOrientation },
                      );
                    }}
                    className={`select-none will-change-transform ${
                      shouldFillViewport
                        ? "w-screen h-[100dvh] object-contain rounded-none"
                        : "max-w-[92vw] max-h-[88dvh] object-contain rounded-xl shadow-2xl"
                    }`}
                    draggable={false}
                  />

                  <button
                    onClick={toggleLightboxFullscreen}
                    className="absolute bottom-5 right-5 w-12 h-12 rounded-full bg-black/55 hover:bg-black/75 backdrop-blur-md flex items-center justify-center text-white transition-colors z-30 border border-white/10"
                    aria-label="Hap foton në fullscreen"
                  >
                    <Maximize size={21} />
                  </button>

                  {lightboxScale > 1.01 && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        resetLightboxZoom(true);
                      }}
                      className="absolute bottom-5 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/55 hover:bg-black/75 backdrop-blur-md text-white text-sm font-medium z-30 transition-colors border border-white/10"
                    >
                      Reset Zoom
                    </button>
                  )}
                </>
              );
            })()}
          </div>

          {images[lightboxIndex].caption && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full bg-black/60 backdrop-blur-md text-white text-sm z-20 pointer-events-none">
              {images[lightboxIndex].caption}
            </div>
          )}

          {images.length > 1 && lightboxScale <= 1.01 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  lightboxPrev();
                }}
                disabled={!canLightboxPrev}
                aria-disabled={!canLightboxPrev}
                className={`absolute left-3 md:left-6 top-1/2 -translate-y-1/2 w-10 h-10 md:w-11 md:h-11 rounded-full bg-black/55 text-white/90 flex items-center justify-center backdrop-blur-md transition-all duration-300 border border-white/10 group z-30 ${
                  canLightboxPrev
                    ? "hover:bg-black/75"
                    : "opacity-30 cursor-not-allowed"
                }`}
              >
                <ChevronLeft
                  size={19}
                  strokeWidth={2.2}
                  className="group-hover:-translate-x-0.5 transition-transform"
                />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  lightboxNext();
                }}
                disabled={!canLightboxNext}
                aria-disabled={!canLightboxNext}
                className={`absolute right-3 md:right-6 top-1/2 -translate-y-1/2 w-10 h-10 md:w-11 md:h-11 rounded-full bg-black/55 text-white/90 flex items-center justify-center backdrop-blur-md transition-all duration-300 border border-white/10 group z-30 ${
                  canLightboxNext
                    ? "hover:bg-black/75"
                    : "opacity-30 cursor-not-allowed"
                }`}
              >
                <ChevronRight
                  size={19}
                  strokeWidth={2.2}
                  className="group-hover:translate-x-0.5 transition-transform"
                />
              </button>
            </>
          )}
        </div>
      )}

      {showVirtualTour && (
        <div className="fixed inset-0 z-[100] bg-background flex flex-col">
          <div className="flex items-center justify-between p-4 glass-panel border-b border-border z-10">
            <div className="flex items-center gap-3">
              <span className="font-display font-bold text-foreground text-xl">
                Tur Virtual 360°
              </span>
              <span className="text-muted-foreground">|</span>
              <span className="text-primary truncate">
                {project.title}
              </span>
            </div>

            <button
              onClick={() => setShowVirtualTour(false)}
              className="w-10 h-10 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-foreground"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 p-4 overflow-auto">
            <PropertyVirtualTourViewer
              propertyId={hasBuiltInVirtualTour ? (project.id as any) : undefined}
              fallbackUrl={project.virtualTourUrl}
              fallbackEmbedCode={project.virtualTourEmbedCode}
              onClose={() => setShowVirtualTour(false)}
            />
          </div>
        </div>
      )}
    </Layout>
  );
}
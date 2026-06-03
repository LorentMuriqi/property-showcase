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

type ImageOrientation = "landscape" | "portrait";

type LightboxViewport = {
  width: number;
  height: number;
  offsetTop: number;
  offsetLeft: number;
};

const getImageOrientation = (width: number, height: number): ImageOrientation => {
  if (!width || !height) return "portrait";

  // Square and near-square images stay in the natural vertical layout.
  // Only clearly horizontal images rotate in mobile fullscreen.
  return width / height > 1.08 ? "landscape" : "portrait";
};

const getLightboxViewport = (): LightboxViewport => {
  if (typeof window === "undefined") {
    return { width: 0, height: 0, offsetTop: 0, offsetLeft: 0 };
  }

  const visualViewport = window.visualViewport;

  return {
    width: Math.round(visualViewport?.width ?? window.innerWidth),
    height: Math.round(visualViewport?.height ?? window.innerHeight),
    offsetTop: Math.round(visualViewport?.offsetTop ?? 0),
    offsetLeft: Math.round(visualViewport?.offsetLeft ?? 0),
  };
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
  const [imageOrientations, setImageOrientations] = useState<Record<number, ImageOrientation>>({});
  const [lightboxViewport, setLightboxViewport] = useState<LightboxViewport>(() => getLightboxViewport());
  const [isScreenPortrait, setIsScreenPortrait] = useState(() => {
    const viewport = getLightboxViewport();
    return viewport.height >= viewport.width;
  });
  const [isLightboxFullscreen, setIsLightboxFullscreen] = useState(false);

  const activeLightboxOrientation =
    lightboxIndex !== null ? imageOrientations[lightboxIndex] : undefined;

  const shouldUseHorizontalFullscreenAxis =
    isLightboxFullscreen &&
    isScreenPortrait &&
    activeLightboxOrientation === "landscape";

  const shouldUseVerticalLightboxAxis =
    isLightboxFullscreen &&
    activeLightboxOrientation === "portrait" &&
    !shouldUseHorizontalFullscreenAxis;

  const lightboxAxis: "x" | "y" = shouldUseVerticalLightboxAxis ? "y" : "x";
  const [lightboxRef, lightboxApi] = useEmblaCarousel({
    loop: false,
    axis: lightboxAxis,
  });

  const lightboxStartIndexRef = useRef(0);
  const [canLightboxPrev, setCanLightboxPrev] = useState(false);
  const [canLightboxNext, setCanLightboxNext] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);

  useEffect(() => {
    let frame = 0;

    const updateViewport = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const viewport = getLightboxViewport();
        setLightboxViewport(viewport);
        setIsScreenPortrait(viewport.height >= viewport.width);
      });
    };

    updateViewport();

    window.addEventListener("resize", updateViewport);
    window.addEventListener("orientationchange", updateViewport);
    window.visualViewport?.addEventListener("resize", updateViewport);
    window.visualViewport?.addEventListener("scroll", updateViewport);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateViewport);
      window.removeEventListener("orientationchange", updateViewport);
      window.visualViewport?.removeEventListener("resize", updateViewport);
      window.visualViewport?.removeEventListener("scroll", updateViewport);
    };
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      const doc = document as any;
      const isNativeActive = !!(document.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement);
      if (!isNativeActive && (document.fullscreenEnabled || doc.webkitFullscreenEnabled)) {
        setIsLightboxFullscreen(false);
      }
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
    };
  }, []);

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

  const openLightbox = (idx: number) => {
    lightboxStartIndexRef.current = idx;
    setLightboxIndex(idx);
  };

  const closeLightbox = () => {
    setLightboxIndex(null);
    setIsLightboxFullscreen(false);
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
    if (!images.length || !lightboxApi || !lightboxApi.canScrollPrev()) return;
    lightboxApi.scrollPrev();
  }, [lightboxApi, images.length]);

  const lightboxNext = useCallback(() => {
    if (!images.length || !lightboxApi || !lightboxApi.canScrollNext()) return;
    lightboxApi.scrollNext();
  }, [lightboxApi, images.length]);

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

  useEffect(() => {
    if (!lightboxApi) return;

    const updateLightboxState = () => {
      setLightboxIndex(lightboxApi.selectedScrollSnap());
      setCanLightboxPrev(lightboxApi.canScrollPrev());
      setCanLightboxNext(lightboxApi.canScrollNext());
    };

    updateLightboxState();

    lightboxApi.on("select", updateLightboxState);
    lightboxApi.on("reInit", updateLightboxState);

    return () => {
      lightboxApi.off("select", updateLightboxState);
      lightboxApi.off("reInit", updateLightboxState);
    };
  }, [lightboxApi]);

  const isLightboxOpen = lightboxIndex !== null;

  useEffect(() => {
    if (!isLightboxOpen || !lightboxApi) return;

    const frame = requestAnimationFrame(() => {
      lightboxApi.reInit();
      lightboxApi.scrollTo(lightboxStartIndexRef.current, true);
    });

    return () => cancelAnimationFrame(frame);
  }, [isLightboxOpen, lightboxApi]);

  useEffect(() => {
    if (!isLightboxOpen || !lightboxApi) return;

    const frame = requestAnimationFrame(() => {
      const currentIndex = lightboxIndex ?? lightboxApi.selectedScrollSnap();
      lightboxApi.reInit({ loop: false, axis: lightboxAxis });
      lightboxApi.scrollTo(currentIndex, true);
    });

    return () => cancelAnimationFrame(frame);
  }, [isLightboxOpen, lightboxApi, lightboxAxis]);

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

      {/* Lightbox profesional me orientim dinamik për landscape dhe portrait/square */}
      {lightboxIndex !== null && images.length > 0 && (() => {
        const fallbackViewportWidth = typeof window !== "undefined" ? window.innerWidth : 1;
        const fallbackViewportHeight = typeof window !== "undefined" ? window.innerHeight : 1;
        const viewportWidth = Math.max(1, lightboxViewport.width || fallbackViewportWidth);
        const viewportHeight = Math.max(1, lightboxViewport.height || fallbackViewportHeight);
        const activeImageOrientation = imageOrientations[lightboxIndex];
        const shouldUseHorizontalFullscreen =
          isLightboxFullscreen && isScreenPortrait && activeImageOrientation === "landscape";
        const isVerticalSwipeMode = lightboxAxis === "y";

        // The carousel itself always stays in the real screen coordinate system.
        // Landscape fullscreen rotates only the image stage inside each slide.
        // This keeps horizontal swipes and horizontal slide movement truly horizontal.
        const shellWidth = viewportWidth;
        const shellHeight = viewportHeight;

        return (
          <div
            id="lightbox-container"
            className="fixed z-[200] bg-black overflow-hidden touch-none selection:bg-transparent"
            onClick={closeLightbox}
            style={{
              top: `${lightboxViewport.offsetTop}px`,
              left: `${lightboxViewport.offsetLeft}px`,
              width: `${viewportWidth}px`,
              height: `${viewportHeight}px`,
              maxWidth: `${viewportWidth}px`,
              maxHeight: `${viewportHeight}px`,
            }}
          >
            <div
              className="absolute flex items-center justify-center overflow-hidden bg-black transition-transform duration-300 ease-out"
              style={{
                left: `${viewportWidth / 2}px`,
                top: `${viewportHeight / 2}px`,
                width: `${shellWidth}px`,
                height: `${shellHeight}px`,
                marginLeft: `${-shellWidth / 2}px`,
                marginTop: `${-shellHeight / 2}px`,
                maxWidth: `${shellWidth}px`,
                maxHeight: `${shellHeight}px`,
                transform: "none",
                transformOrigin: "center center",
              }}
            >
              <div
                className="relative h-full w-full overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className="h-full w-full overflow-hidden"
                  ref={lightboxRef}
                  style={{ touchAction: isVerticalSwipeMode ? "pan-y" : "pan-x" }}
                >
                  <div
                    className={`flex h-full w-full ${
                      isVerticalSwipeMode ? "flex-col" : "flex-row"
                    }`}
                  >
                    {images.map((img, idx) => (
                      <div
                        key={img.id || idx}
                        className={`relative flex h-full w-full flex-[0_0_100%] items-center justify-center overflow-hidden ${
                          isVerticalSwipeMode ? "min-h-0" : "min-w-0"
                        } ${isLightboxFullscreen ? "p-0" : "p-4 md:p-8"}`}
                        ref={(node) => {
                          if (!node) return;
                          if (node.hasAttribute("data-zoom-attached")) return;
                          node.setAttribute("data-zoom-attached", "true");

                          let startDist = 0;

                          node.addEventListener("touchstart", (e) => {
                            if (e.touches.length === 2) {
                              e.preventDefault();
                              e.stopPropagation();

                              startDist = Math.hypot(
                                e.touches[0].pageX - e.touches[1].pageX,
                                e.touches[0].pageY - e.touches[1].pageY
                              );

                              const imgEl = node.querySelector("img");
                              if (imgEl) {
                                imgEl.style.transition = "none";
                                imgEl.style.position = "relative";
                                imgEl.style.zIndex = "9999";

                                const rect = imgEl.getBoundingClientRect();
                                const centerX =
                                  (e.touches[0].clientX + e.touches[1].clientX) / 2;
                                const centerY =
                                  (e.touches[0].clientY + e.touches[1].clientY) / 2;
                                const originX = ((centerX - rect.left) / rect.width) * 100;
                                const originY = ((centerY - rect.top) / rect.height) * 100;
                                imgEl.style.transformOrigin = `${originX}% ${originY}%`;
                              }
                            }
                          }, { passive: false });

                          node.addEventListener("touchmove", (e) => {
                            if (e.touches.length === 2 && startDist > 0) {
                              e.preventDefault();
                              e.stopPropagation();

                              const dist = Math.hypot(
                                e.touches[0].pageX - e.touches[1].pageX,
                                e.touches[0].pageY - e.touches[1].pageY
                              );

                              const currentScale = Math.min(Math.max(1, dist / startDist), 4);

                              const imgEl = node.querySelector("img");
                              if (imgEl) {
                                imgEl.style.transform = `scale(${currentScale})`;
                              }
                            }
                          }, { passive: false });

                          node.addEventListener("touchend", (e) => {
                            if (e.touches.length < 2) {
                              startDist = 0;
                              const imgEl = node.querySelector("img");
                              if (imgEl) {
                                imgEl.style.transition =
                                  "transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)";
                                imgEl.style.transform = "scale(1)";
                                setTimeout(() => {
                                  imgEl.style.zIndex = "1";
                                }, 300);
                              }
                            }
                          });
                        }}
                      >
                        {(() => {
                          const slideImageOrientation = imageOrientations[idx];
                          const shouldRotateSlideImage =
                            isLightboxFullscreen &&
                            isScreenPortrait &&
                            slideImageOrientation === "landscape";

                          return (
                            <div
                              className="flex items-center justify-center"
                              style={
                                shouldRotateSlideImage
                                  ? {
                                      width: `${viewportHeight}px`,
                                      height: `${viewportWidth}px`,
                                      maxWidth: `${viewportHeight}px`,
                                      maxHeight: `${viewportWidth}px`,
                                      transform: "rotate(90deg)",
                                      transformOrigin: "center center",
                                    }
                                  : {
                                      width: "100%",
                                      height: "100%",
                                    }
                              }
                            >
                              <img
                                src={getLightboxImageUrl(img, idx)}
                                alt={img.caption || `${project.title} - Foto ${idx + 1}`}
                                onLoad={(e) => {
                                  const { naturalWidth, naturalHeight } = e.currentTarget;
                                  const orientation = getImageOrientation(naturalWidth, naturalHeight);
                                  setImageOrientations((prev) => {
                                    if (prev[idx] === orientation) return prev;
                                    return { ...prev, [idx]: orientation };
                                  });
                                }}
                                loading={
                                  lightboxIndex !== null &&
                                  (idx === lightboxIndex ||
                                    idx === (lightboxIndex - 1 + images.length) % images.length ||
                                    idx === (lightboxIndex + 1) % images.length)
                                    ? "eager"
                                    : "lazy"
                                }
                                decoding="async"
                                draggable={false}
                                className={`select-none object-contain transition-all duration-300 ${
                                  isLightboxFullscreen
                                    ? "h-full w-full max-h-full max-w-full rounded-none"
                                    : "max-h-full max-w-full rounded-xl shadow-2xl md:max-h-[85vh] md:max-w-[85vw]"
                                }`}
                              />
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={closeLightbox}
                  className="absolute right-4 top-4 z-[210] flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/15 text-white shadow-2xl backdrop-blur-md transition-colors hover:bg-white/25 md:right-5 md:top-5"
                  aria-label="Mbyll galerinë"
                >
                  <X size={22} />
                </button>

                <div className="absolute left-1/2 top-4 z-[210] -translate-x-1/2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-md md:top-5">
                  {lightboxIndex + 1} / {images.length}
                </div>

                {images[lightboxIndex].caption && (
                  <div
                    className={`absolute left-1/2 z-[210] max-w-[min(720px,80vw)] -translate-x-1/2 rounded-full bg-black/60 px-5 py-2 text-center text-sm leading-relaxed text-white shadow-2xl backdrop-blur-md ${
                      isLightboxFullscreen ? "bottom-5" : "bottom-20"
                    }`}
                  >
                    {images[lightboxIndex].caption}
                  </div>
                )}

                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    const container = document.getElementById("lightbox-container");
                    if (!container) return;

                    const nextState = !isLightboxFullscreen;
                    setIsLightboxFullscreen(nextState);

                    try {
                      const doc = document as any;
                      const isNativeActive = !!(
                        document.fullscreenElement ||
                        doc.webkitFullscreenElement ||
                        doc.mozFullScreenElement ||
                        doc.msFullscreenElement
                      );

                      if (nextState && !isNativeActive) {
                        if (container.requestFullscreen) {
                          await container.requestFullscreen();
                        } else if ((container as any).webkitRequestFullscreen) {
                          await (container as any).webkitRequestFullscreen();
                        }
                      } else if (!nextState && isNativeActive) {
                        if (document.exitFullscreen) {
                          await document.exitFullscreen();
                        } else if (doc.webkitExitFullscreen) {
                          await doc.webkitExitFullscreen();
                        }
                      }
                    } catch (error) {
                      console.error("Fullscreen error handled natively via simulation:", error);
                    }
                  }}
                  className="absolute bottom-4 right-4 z-[210] flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/15 text-white shadow-2xl backdrop-blur-md transition-colors hover:bg-white/25 md:bottom-5 md:right-5"
                  title="Full Screen"
                  aria-label="Hap ose mbyll fullscreen"
                >
                  <Maximize size={20} />
                </button>

                {images.length > 1 && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        lightboxPrev();
                      }}
                      disabled={!canLightboxPrev}
                      className={`absolute left-3 top-1/2 z-[210] flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/90 backdrop-blur-md transition-all duration-300 group md:left-6 md:h-11 md:w-11 ${
                        canLightboxPrev
                          ? "hover:border-white/20 hover:bg-white/20"
                          : "cursor-not-allowed opacity-30"
                      }`}
                      aria-label="Fotoja e mëparshme"
                    >
                      <ChevronLeft
                        size={19}
                        strokeWidth={2.2}
                        className="transition-transform group-hover:-translate-x-0.5"
                      />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        lightboxNext();
                      }}
                      disabled={!canLightboxNext}
                      className={`absolute right-3 top-1/2 z-[210] flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/90 backdrop-blur-md transition-all duration-300 group md:right-6 md:h-11 md:w-11 ${
                        canLightboxNext
                          ? "hover:border-white/20 hover:bg-white/20"
                          : "cursor-not-allowed opacity-30"
                      }`}
                      aria-label="Fotoja tjetër"
                    >
                      <ChevronRight
                        size={19}
                        strokeWidth={2.2}
                        className="transition-transform group-hover:translate-x-0.5"
                      />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

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
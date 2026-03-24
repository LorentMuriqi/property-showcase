import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
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

type ProjectImage = {
  id?: string | number;
  url: string;
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
    defaultSceneId: raw?.defaultSceneId ?? raw?.default_scene_id,
    images: Array.isArray(raw?.images) ? raw.images : [],
  };
}

export default function ProjectDetails() {
  const { id } = useParams();
  const [, setLocation] = useLocation();

  const [project, setProject] = useState<ProjectType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [showVirtualTour, setShowVirtualTour] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  const openLightbox = (idx: number) => setLightboxIndex(idx);
  const closeLightbox = () => setLightboxIndex(null);

  const images = project?.images || [];

  const lightboxPrev = useCallback(() => {
    if (lightboxIndex === null || !images.length) return;
    setLightboxIndex((lightboxIndex - 1 + images.length) % images.length);
  }, [lightboxIndex, images.length]);

  const lightboxNext = useCallback(() => {
    if (lightboxIndex === null || !images.length) return;
    setLightboxIndex((lightboxIndex + 1) % images.length);
  }, [lightboxIndex, images.length]);

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
        .single();

      if (!isMounted) return;

      if (error || !data) {
        console.error("Project details fetch error:", error);
        setProject(null);
        setFetchError(true);
      } else {
        setProject(normalizeProject(data));
        setFetchError(false);
      }

      setIsLoading(false);
    };

    fetchProject();

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen pt-32 flex items-center justify-center">
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-primary font-display tracking-widest uppercase">
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
            <h1 className="font-display text-4xl text-white mb-4">
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

  const hasVirtualTour = !!(
    project.hasCustomVirtualTour ||
    project.virtualTourUrl ||
    project.virtualTourEmbedCode
  );

  const statusLabels: Record<string, string> = {
    for_sale: "Në Shitje",
    sold: "Shitur",
    rented: "Dhënë me Qira",
    for_rent: "Me Qira",
  };

  const hasContact = !!(
    project.contactCompany ||
    project.contactPhone ||
    project.contactEmail
  );

  return (
    <Layout>
      <div className="bg-background pt-24 pb-32 min-h-screen">
        {/* Gallery Carousel */}
        <div className="relative w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 mb-12">
          <div
            className="overflow-hidden rounded-2xl aspect-video md:aspect-[21/9] bg-card border border-white/5 shadow-2xl relative cursor-zoom-in"
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
                      src={img.url}
                      alt={img.caption || `${project.title} - Foto ${idx + 1}`}
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
                  className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/40 hover:bg-primary text-white flex items-center justify-center backdrop-blur-md transition-all border border-white/10 z-10"
                >
                  <ChevronLeft size={24} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    scrollNext();
                  }}
                  className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/40 hover:bg-primary text-white flex items-center justify-center backdrop-blur-md transition-all border border-white/10 z-10"
                >
                  <ChevronRight size={24} />
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
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content Wrapper */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-16">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-12">
            <div>
              <div className="flex items-center gap-4 mb-4">
                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest bg-white/5 border border-white/10 text-white/80">
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

              <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
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
                <h3 className="font-display text-2xl text-white mb-6 border-b border-white/10 pb-4">
                  Prona
                </h3>
                <div className="prose prose-invert max-w-none text-muted-foreground leading-relaxed">
                  {String(project.description)
                    .split("\n")
                    .map((paragraph, i) => (
                      <p key={i}>{paragraph}</p>
                    ))}
                </div>
              </div>
            )}

            {project.customFields &&
              Object.keys(project.customFields).length > 0 && (
                <div>
                  <h3 className="font-display text-2xl text-white mb-6 border-b border-white/10 pb-4">
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
                          <span className="block text-white/90 capitalize">
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

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-32 space-y-6">
              <div className="glass-panel rounded-2xl p-8">
                <div className="text-4xl font-display text-primary mb-8 font-medium">
                  {formattedPrice}
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                  {project.areaM2 && (
                    <div className="bg-background/50 p-4 rounded-xl border border-white/5">
                      <Maximize size={20} className="text-primary mb-2" />
                      <span className="block text-white text-lg font-medium">
                        {project.areaM2}
                      </span>
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">
                        Metra Katrorë
                      </span>
                    </div>
                  )}

                  {project.bedrooms && (
                    <div className="bg-background/50 p-4 rounded-xl border border-white/5">
                      <BedDouble size={20} className="text-primary mb-2" />
                      <span className="block text-white text-lg font-medium">
                        {project.bedrooms}
                      </span>
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">
                        Dhoma Gjumi
                      </span>
                    </div>
                  )}

                  {project.bathrooms && (
                    <div className="bg-background/50 p-4 rounded-xl border border-white/5">
                      <Bath size={20} className="text-primary mb-2" />
                      <span className="block text-white text-lg font-medium">
                        {project.bathrooms}
                      </span>
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">
                        Banjo
                      </span>
                    </div>
                  )}

                  {project.livingRooms && (
                    <div className="bg-background/50 p-4 rounded-xl border border-white/5">
                      <LayoutGrid size={20} className="text-primary mb-2" />
                      <span className="block text-white text-lg font-medium">
                        {project.livingRooms}
                      </span>
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">
                        Dh. Ndenjeje
                      </span>
                    </div>
                  )}

                  {project.floors && (
                    <div className="bg-background/50 p-4 rounded-xl border border-white/5">
                      <Layers size={20} className="text-primary mb-2" />
                      <span className="block text-white text-lg font-medium">
                        {project.floors}
                      </span>
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">
                        Kate
                      </span>
                    </div>
                  )}

                  {project.yearBuilt && (
                    <div className="bg-background/50 p-4 rounded-xl border border-white/5">
                      <Calendar size={20} className="text-primary mb-2" />
                      <span className="block text-white text-lg font-medium">
                        {project.yearBuilt}
                      </span>
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">
                        Ndërtuar
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <button className="w-full py-4 bg-primary text-primary-foreground font-bold tracking-widest uppercase text-sm rounded-xl hover:bg-white transition-colors">
                    Planifiko një Vizitë
                  </button>
                  <button
                    onClick={() => setShowContactModal(true)}
                    className="w-full py-4 bg-transparent border border-white/20 text-white font-bold tracking-widest uppercase text-sm rounded-xl hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
                  >
                    <Phone size={16} /> Kërko Informacion
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Modal */}
      {showContactModal && (
        <div
          className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm flex items-center justify-center px-4"
          onClick={() => setShowContactModal(false)}
        >
          <div
            className="relative w-full max-w-md glass-panel rounded-2xl p-8 border border-primary/30 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-2xl text-white flex items-center gap-2">
                <Building2 size={22} className="text-primary" /> Kërko Informacion
              </h3>
              <button
                onClick={() => setShowContactModal(false)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-muted-foreground text-sm mb-6">
              Kontaktoni agjentin për pronën:
              <br />
              <span className="text-white font-medium">{project.title}</span>
            </p>

            {hasContact ? (
              <div className="space-y-4">
                {project.contactCompany && (
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                      <Building2 size={20} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">
                        Kompania
                      </p>
                      <p className="text-white font-semibold text-lg">
                        {project.contactCompany}
                      </p>
                    </div>
                  </div>
                )}

                {project.contactPhone && (
                  <a
                    href={`tel:${project.contactPhone}`}
                    className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-primary/50 hover:bg-primary/5 transition-all group"
                  >
                    <div className="w-11 h-11 rounded-xl bg-primary/15 group-hover:bg-primary/25 flex items-center justify-center shrink-0 transition-colors">
                      <Phone size={20} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">
                        Telefoni
                      </p>
                      <p className="text-white group-hover:text-primary font-semibold text-lg transition-colors">
                        {project.contactPhone}
                      </p>
                    </div>
                  </a>
                )}

                {project.contactEmail && (
                  <a
                    href={`mailto:${project.contactEmail}`}
                    className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-primary/50 hover:bg-primary/5 transition-all group"
                  >
                    <div className="w-11 h-11 rounded-xl bg-primary/15 group-hover:bg-primary/25 flex items-center justify-center shrink-0 transition-colors">
                      <Mail size={20} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">
                        Email
                      </p>
                      <p className="text-white group-hover:text-primary font-semibold text-lg transition-colors">
                        {project.contactEmail}
                      </p>
                    </div>
                  </a>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
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

      {/* Lightbox */}
      {lightboxIndex !== null && images.length > 0 && (
        <div
          className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-5 right-5 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-10"
          >
            <X size={22} />
          </button>

          <div className="absolute top-5 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-white text-sm font-medium z-10">
            {lightboxIndex + 1} / {images.length}
          </div>

          <img
            src={images[lightboxIndex].url}
            alt={
              images[lightboxIndex].caption ||
              `${project.title} - Foto ${lightboxIndex + 1}`
            }
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />

          {images[lightboxIndex].caption && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full bg-black/60 backdrop-blur-md text-white text-sm">
              {images[lightboxIndex].caption}
            </div>
          )}

          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  lightboxPrev();
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white/10 hover:bg-primary text-white flex items-center justify-center backdrop-blur-md transition-all border border-white/10"
              >
                <ChevronLeft size={28} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  lightboxNext();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white/10 hover:bg-primary text-white flex items-center justify-center backdrop-blur-md transition-all border border-white/10"
              >
                <ChevronRight size={28} />
              </button>
            </>
          )}
        </div>
      )}

      {/* Virtual Tour Fullscreen Modal */}
      {showVirtualTour && (
        <div className="fixed inset-0 z-[100] bg-background flex flex-col">
          <div className="flex items-center justify-between p-4 glass-panel border-b border-white/10 z-10">
            <div className="flex items-center gap-3">
              <span className="font-display font-bold text-white text-xl">
                Tur Virtual 360°
              </span>
              <span className="text-muted-foreground">|</span>
              <span className="text-primary truncate max-w-[200px] sm:max-w-none">
                {project.title}
              </span>
            </div>
            <button
              onClick={() => setShowVirtualTour(false)}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 w-full bg-black relative">
            {project.virtualTourEmbedCode ? (
              <div
                className="w-full h-full [&>iframe]:w-full [&>iframe]:h-full"
                dangerouslySetInnerHTML={{ __html: project.virtualTourEmbedCode }}
              />
            ) : project.virtualTourUrl ? (
              <iframe
                src={project.virtualTourUrl}
                className="w-full h-full border-none"
                allowFullScreen
                title={`Tur virtual - ${project.title}`}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                Tur virtual nuk është i disponueshëm.
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
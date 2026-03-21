import { useState, useEffect, useCallback } from "react";
import { useParams } from "wouter";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, MapPin, Maximize, BedDouble, Bath, LayoutGrid, Calendar, Layers, CheckCircle2, Play, X, Phone, Mail, Building2, ZoomIn } from "lucide-react";
import { Layout } from "@/components/Layout";
import { useGetProject, useGetVirtualTour } from "@workspace/api-client-react";
import { VirtualTour360 } from "@/components/VirtualTour360";

export default function ProjectDetails() {
  const { id } = useParams();
  const { data: project, isLoading, error } = useGetProject(Number(id));
  
  const { data: tourData } = useGetVirtualTour(Number(id), { 
    query: { enabled: !!project?.hasCustomVirtualTour } 
  });

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [showVirtualTour, setShowVirtualTour] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const scrollPrev = useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi]);

  const openLightbox = (idx: number) => setLightboxIndex(idx);
  const closeLightbox = () => setLightboxIndex(null);

  const lightboxPrev = useCallback(() => {
    if (lightboxIndex === null || !project?.images) return;
    setLightboxIndex((lightboxIndex - 1 + project.images.length) % project.images.length);
  }, [lightboxIndex, project]);

  const lightboxNext = useCallback(() => {
    if (lightboxIndex === null || !project?.images) return;
    setLightboxIndex((lightboxIndex + 1) % project.images.length);
  }, [lightboxIndex, project]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (lightboxIndex === null) return;
      if (e.key === "ArrowLeft") lightboxPrev();
      if (e.key === "ArrowRight") lightboxNext();
      if (e.key === "Escape") closeLightbox();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxIndex, lightboxPrev, lightboxNext]);

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen pt-32 flex items-center justify-center">
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-primary font-display tracking-widest uppercase">Duke Ngarkuar Pronën</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !project) {
    return (
      <Layout>
        <div className="min-h-screen pt-32 flex items-center justify-center text-center px-4">
          <div>
            <h1 className="font-display text-4xl text-white mb-4">Prona Nuk U Gjet</h1>
            <p className="text-muted-foreground">Prona e kërkuar nuk është e disponueshme ose nuk ekziston.</p>
          </div>
        </div>
      </Layout>
    );
  }

  const formattedPrice = project.price 
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: project.currency || 'USD', maximumFractionDigits: 0 }).format(project.price)
    : "Çmimi sipas kërkesës";

  const hasVirtualTour = !!(project.hasCustomVirtualTour || project.virtualTourUrl || project.virtualTourEmbedCode);

  const statusLabels: Record<string, string> = {
    for_sale: "Në Shitje",
    sold: "Shitur",
    rented: "Dhënë me Qira",
    for_rent: "Me Qira",
  };

  const images = project.images || [];
  const hasContact = !!(project.contactCompany || project.contactPhone || project.contactEmail);

  return (
    <Layout>
      <div className="bg-background pt-24 pb-32 min-h-screen">
        
        {/* Gallery Carousel */}
        <div className="relative w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 mb-12">
          <div className="overflow-hidden rounded-2xl aspect-video md:aspect-[21/9] bg-card border border-white/5 shadow-2xl relative cursor-zoom-in" ref={emblaRef}>
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
                      <ZoomIn size={40} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                    </div>
                    {img.caption && (
                      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
                        <p className="text-white/90 text-sm font-medium">{img.caption}</p>
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

            {/* Carousel Controls */}
            {images.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); scrollPrev(); }}
                  className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/40 hover:bg-primary text-white flex items-center justify-center backdrop-blur-md transition-all border border-white/10 z-10"
                >
                  <ChevronLeft size={24} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); scrollNext(); }}
                  className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/40 hover:bg-primary text-white flex items-center justify-center backdrop-blur-md transition-all border border-white/10 z-10"
                >
                  <ChevronRight size={24} />
                </button>
              </>
            )}

            {/* Virtual Tour Overlay Button */}
            {hasVirtualTour && (
              <button 
                onClick={(e) => { e.stopPropagation(); setShowVirtualTour(true); }}
                className="absolute top-6 right-6 px-6 py-3 rounded-full bg-primary/90 text-primary-foreground font-bold tracking-widest uppercase text-xs flex items-center gap-2 hover:bg-primary hover:scale-105 transition-all shadow-xl backdrop-blur-md z-10"
              >
                <Play size={14} className="fill-current" /> Hap Turin Virtual 360°
              </button>
            )}

            {/* Photo counter */}
            {images.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-black/50 backdrop-blur-md text-white text-xs font-medium z-10 pointer-events-none">
                {images.length} foto
              </div>
            )}
          </div>

          {/* Thumbnail strip */}
          {images.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
              {images.map((img, idx) => (
                <button
                  key={img.id || idx}
                  onClick={() => { openLightbox(idx); emblaApi?.scrollTo(idx); }}
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
            
            {/* Header */}
            <div>
              <div className="flex items-center gap-4 mb-4">
                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest bg-white/5 border border-white/10 text-white/80">
                  {statusLabels[project.status] || project.status.replace('_', ' ')}
                </span>
                {project.propertyType && (
                  <span className="text-primary text-sm font-medium tracking-wide uppercase">
                    {project.propertyType}
                  </span>
                )}
              </div>
              <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">{project.title}</h1>
              <div className="flex items-center gap-2 text-muted-foreground text-lg">
                <MapPin className="text-primary" size={20} />
                <span>{project.address ? `${project.address}, ` : ''}{project.city}, {project.country}</span>
              </div>
            </div>

            {/* Description */}
            {project.description && (
              <div>
                <h3 className="font-display text-2xl text-white mb-6 border-b border-white/10 pb-4">Prona</h3>
                <div className="prose prose-invert max-w-none text-muted-foreground leading-relaxed">
                  {project.description.split('\n').map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Custom Fields (Features) */}
            {project.customFields && Object.keys(project.customFields).length > 0 && (
              <div>
                <h3 className="font-display text-2xl text-white mb-6 border-b border-white/10 pb-4">Karakteristikat dhe Lehtësitë</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(project.customFields).map(([key, value]) => (
                    <div key={key} className="flex items-start gap-3">
                      <CheckCircle2 size={20} className="text-primary shrink-0 mt-0.5" />
                      <div>
                        <span className="block text-white/90 capitalize">{key.replace(/_/g, ' ')}</span>
                        <span className="text-sm text-muted-foreground">{String(value)}</span>
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
                      <span className="block text-white text-lg font-medium">{project.areaM2}</span>
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">Metra Katrorë</span>
                    </div>
                  )}
                  {project.bedrooms && (
                    <div className="bg-background/50 p-4 rounded-xl border border-white/5">
                      <BedDouble size={20} className="text-primary mb-2" />
                      <span className="block text-white text-lg font-medium">{project.bedrooms}</span>
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">Dhoma Gjumi</span>
                    </div>
                  )}
                  {project.bathrooms && (
                    <div className="bg-background/50 p-4 rounded-xl border border-white/5">
                      <Bath size={20} className="text-primary mb-2" />
                      <span className="block text-white text-lg font-medium">{project.bathrooms}</span>
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">Banjo</span>
                    </div>
                  )}
                  {project.livingRooms && (
                    <div className="bg-background/50 p-4 rounded-xl border border-white/5">
                      <LayoutGrid size={20} className="text-primary mb-2" />
                      <span className="block text-white text-lg font-medium">{project.livingRooms}</span>
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">Dh. Ndenjeje</span>
                    </div>
                  )}
                  {project.floors && (
                    <div className="bg-background/50 p-4 rounded-xl border border-white/5">
                      <Layers size={20} className="text-primary mb-2" />
                      <span className="block text-white text-lg font-medium">{project.floors}</span>
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">Kate</span>
                    </div>
                  )}
                  {project.yearBuilt && (
                    <div className="bg-background/50 p-4 rounded-xl border border-white/5">
                      <Calendar size={20} className="text-primary mb-2" />
                      <span className="block text-white text-lg font-medium">{project.yearBuilt}</span>
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">Ndërtuar</span>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <button className="w-full py-4 bg-primary text-primary-foreground font-bold tracking-widest uppercase text-sm rounded-xl hover:bg-white transition-colors">
                    Planifiko një Vizitë
                  </button>
                  <button className="w-full py-4 bg-transparent border border-white/20 text-white font-bold tracking-widest uppercase text-sm rounded-xl hover:border-white transition-colors">
                    Kërko Informacion
                  </button>
                </div>
              </div>

              {/* Contact Card */}
              {hasContact && (
                <div className="glass-panel rounded-2xl p-6 border border-primary/20">
                  <h4 className="font-display text-lg text-primary mb-5 border-b border-white/10 pb-3 flex items-center gap-2">
                    <Building2 size={18} /> Kërko Informacion
                  </h4>
                  <div className="space-y-4">
                    {project.contactCompany && (
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Building2 size={16} className="text-primary" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Kompania</p>
                          <p className="text-white font-medium">{project.contactCompany}</p>
                        </div>
                      </div>
                    )}
                    {project.contactPhone && (
                      <a
                        href={`tel:${project.contactPhone}`}
                        className="flex items-center gap-3 group"
                      >
                        <div className="w-9 h-9 rounded-lg bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center shrink-0 transition-colors">
                          <Phone size={16} className="text-primary" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Telefoni</p>
                          <p className="text-white group-hover:text-primary font-medium transition-colors">{project.contactPhone}</p>
                        </div>
                      </a>
                    )}
                    {project.contactEmail && (
                      <a
                        href={`mailto:${project.contactEmail}`}
                        className="flex items-center gap-3 group"
                      >
                        <div className="w-9 h-9 rounded-lg bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center shrink-0 transition-colors">
                          <Mail size={16} className="text-primary" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Email</p>
                          <p className="text-white group-hover:text-primary font-medium transition-colors">{project.contactEmail}</p>
                        </div>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* ── Lightbox ─────────────────────────────────────────────── */}
      {lightboxIndex !== null && images.length > 0 && (
        <div
          className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center"
          onClick={closeLightbox}
        >
          {/* Close */}
          <button
            onClick={closeLightbox}
            className="absolute top-5 right-5 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-10"
          >
            <X size={22} />
          </button>

          {/* Counter */}
          <div className="absolute top-5 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-white text-sm font-medium z-10">
            {lightboxIndex + 1} / {images.length}
          </div>

          {/* Image */}
          <img
            src={images[lightboxIndex].url}
            alt={images[lightboxIndex].caption || `${project.title} - Foto ${lightboxIndex + 1}`}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Caption */}
          {images[lightboxIndex].caption && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full bg-black/60 backdrop-blur-md text-white text-sm">
              {images[lightboxIndex].caption}
            </div>
          )}

          {/* Arrows */}
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); lightboxPrev(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white/10 hover:bg-primary text-white flex items-center justify-center backdrop-blur-md transition-all border border-white/10"
              >
                <ChevronLeft size={28} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); lightboxNext(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white/10 hover:bg-primary text-white flex items-center justify-center backdrop-blur-md transition-all border border-white/10"
              >
                <ChevronRight size={28} />
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Virtual Tour Fullscreen Modal ─────────────────────────── */}
      {showVirtualTour && (
        <div className="fixed inset-0 z-[100] bg-background flex flex-col">
          <div className="flex items-center justify-between p-4 glass-panel border-b border-white/10 z-10">
            <div className="flex items-center gap-3">
              <span className="font-display font-bold text-white text-xl">Tur Virtual 360°</span>
              <span className="text-muted-foreground">|</span>
              <span className="text-primary truncate max-w-[200px] sm:max-w-none">{project.title}</span>
            </div>
            <button 
              onClick={() => setShowVirtualTour(false)}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 w-full bg-black relative">
            {project.hasCustomVirtualTour && tourData ? (
              <VirtualTour360 scenes={tourData.scenes} defaultSceneId={tourData.defaultSceneId} />
            ) : project.virtualTourEmbedCode ? (
              <div 
                className="w-full h-full [&>iframe]:w-full [&>iframe]:h-full"
                dangerouslySetInnerHTML={{ __html: project.virtualTourEmbedCode }} 
              />
            ) : project.virtualTourUrl ? (
              <iframe 
                src={project.virtualTourUrl} 
                className="w-full h-full border-none"
                allowFullScreen 
              />
            ) : null}
          </div>
        </div>
      )}
    </Layout>
  );
}

import { useState, useEffect, useCallback } from "react";
import { useParams } from "wouter";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, MapPin, Maximize, BedDouble, Bath, LayoutGrid, Calendar, Layers, CheckCircle2, Play, X } from "lucide-react";
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

  const scrollPrev = useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi]);

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

  return (
    <Layout>
      <div className="bg-background pt-24 pb-32 min-h-screen">
        
        {/* Gallery Carousel */}
        <div className="relative w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 mb-12">
          <div className="overflow-hidden rounded-2xl aspect-video md:aspect-[21/9] bg-card border border-white/5 shadow-2xl relative" ref={emblaRef}>
            <div className="flex h-full">
              {project.images && project.images.length > 0 ? (
                project.images.map((img, idx) => (
                  <div className="flex-[0_0_100%] min-w-0 h-full relative" key={img.id || idx}>
                    <img 
                      src={img.url} 
                      alt={img.caption || `${project.title} - Foto ${idx + 1}`} 
                      className="w-full h-full object-cover"
                    />
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
            {project.images && project.images.length > 1 && (
              <>
                <button onClick={scrollPrev} className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/40 hover:bg-primary text-white flex items-center justify-center backdrop-blur-md transition-all border border-white/10">
                  <ChevronLeft size={24} />
                </button>
                <button onClick={scrollNext} className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/40 hover:bg-primary text-white flex items-center justify-center backdrop-blur-md transition-all border border-white/10">
                  <ChevronRight size={24} />
                </button>
              </>
            )}

            {/* Virtual Tour Overlay Button */}
            {hasVirtualTour && (
              <button 
                onClick={() => setShowVirtualTour(true)}
                className="absolute top-6 right-6 px-6 py-3 rounded-full bg-primary/90 text-primary-foreground font-bold tracking-widest uppercase text-xs flex items-center gap-2 hover:bg-primary hover:scale-105 transition-all shadow-xl backdrop-blur-md"
              >
                <Play size={14} className="fill-current" /> Hap Turin Virtual 360°
              </button>
            )}
          </div>
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
            <div className="sticky top-32 glass-panel rounded-2xl p-8">
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
          </div>
        </div>

      </div>

      {/* Virtual Tour Fullscreen Modal */}
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

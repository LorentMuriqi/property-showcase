import { Link } from "wouter";
import { MapPin, Maximize, BedDouble, Bath } from "lucide-react";

export function ProjectCard({ project }: { project: any }) {
  const primaryImage = project.images?.find((i: any) => i.isPrimary) || project.images?.[0];

  const statusColors: Record<string, string> = {
    for_sale: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    sold: "bg-destructive/10 text-destructive border-destructive/20",
    rented: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    for_rent: "bg-primary/10 text-primary border-primary/20",
  };

  const statusLabels: Record<string, string> = {
    for_sale: "Në Shitje",
    //sold: "Shitur",
    //rented: "Dhënë me Qira",
    for_rent: "Me Qira",
  };

  const formattedPrice = project.price
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: project.currency || "USD",
        maximumFractionDigits: 0,
      }).format(project.price)
    : "Çmimi sipas marrëveshjes";

  return (
    <Link href={`/projects/${project.id}`} className="group block h-full">
      <div className="bg-card border border-white/5 rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500 flex flex-col h-full hover:-translate-y-1">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          {primaryImage?.url ? (
            <img
              src={primaryImage.url}
              alt={primaryImage.caption || project.title}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground font-display italic">
              No image available
            </div>
          )}

          <div className="absolute top-4 left-4 flex flex-col gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider backdrop-blur-md border ${
                statusColors[project.status] || "bg-white/10 text-white border-white/20"
              }`}
            >
              {statusLabels[project.status] || project.status || "Pronë"}
            </span>
          </div>

          {project.hasVirtualTour && (
            <div className="absolute top-4 right-4 bg-background/80 backdrop-blur-md border border-white/10 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-bold text-white uppercase tracking-widest">Tur 360°</span>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-500" />
        </div>

        <div className="p-6 flex flex-col flex-grow">
<div className="flex items-start justify-between gap-4 mb-3">
  <h3 className="font-sans text-xl font-semibold text-white tracking-tight line-clamp-1">
    {project.title}
  </h3>
<span className="price-font text-xl text-primary font-semibold">
  {formattedPrice}
</span>
</div>

          <div className="flex items-center gap-1.5 text-muted-foreground text-sm mb-6">
            <MapPin size={14} className="text-primary/70" />
            <span className="truncate">
              {project.city}
              {project.city && project.country ? ", " : ""}
              {project.country}
            </span>
          </div>

          <div className="mt-auto grid grid-cols-3 gap-4 pt-4 border-t border-white/5">
            {(project.areaM2 || project.area_m2) && (
              <div className="flex items-center gap-2 text-white/80">
                <Maximize size={16} className="text-primary" />
                <span className="text-sm font-medium">
                  {project.areaM2 || project.area_m2}{" "}
                  <span className="text-xs text-muted-foreground">m²</span>
                </span>
              </div>
            )}

            {project.bedrooms && (
              <div className="flex items-center gap-2 text-white/80">
                <BedDouble size={16} className="text-primary" />
                <span className="text-sm font-medium">
                  {project.bedrooms} <span className="text-xs text-muted-foreground">Dh. Gjumi</span>
                </span>
              </div>
            )}

            {project.bathrooms && (
              <div className="flex items-center gap-2 text-white/80">
                <Bath size={16} className="text-primary" />
                <span className="text-sm font-medium">
                  {project.bathrooms} <span className="text-xs text-muted-foreground">Banjo</span>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
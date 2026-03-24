import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, MapPin, BedDouble, Bath, Maximize, Building2, Phone, Mail } from "lucide-react";
import { Layout } from "@/components/Layout";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

export default function ProjectDetails() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [project, setProject] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProject = async () => {
      if (!id) return;

      setIsLoading(true);

      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Project details fetch error:", error);
        setProject(null);
      } else {
        setProject(data);
      }

      setIsLoading(false);
    };

    fetchProject();
  }, [id]);

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen pt-32 px-4 text-white">Loading...</div>
      </Layout>
    );
  }

  if (!project) {
    return (
      <Layout>
        <div className="min-h-screen pt-32 px-4">
          <div className="max-w-3xl mx-auto text-center bg-card rounded-2xl border border-white/5 p-12">
            <h1 className="font-display text-3xl text-white mb-4">Prona Nuk U Gjet</h1>
            <p className="text-muted-foreground mb-8">
              Prona e kërkuar nuk është e disponueshme ose nuk ekziston.
            </p>
            <button
              onClick={() => setLocation("/projects")}
              className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold"
            >
              Kthehu te Pronat
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const primaryImage =
    Array.isArray(project.images) && project.images.length > 0
      ? project.images.find((img: any) => img?.isPrimary)?.url || project.images[0]?.url
      : "";

  return (
    <Layout>
      <div className="pt-24 pb-20 bg-background min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => setLocation("/projects")}
            className="mb-8 flex items-center gap-2 text-primary hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
            Kthehu te Pronat
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
            <div className="space-y-4">
              {primaryImage ? (
                <img
                  src={primaryImage}
                  alt={project.title}
                  className="w-full h-[500px] object-cover rounded-2xl border border-white/5"
                />
              ) : (
                <div className="w-full h-[500px] bg-card rounded-2xl border border-white/5 flex items-center justify-center text-muted-foreground">
                  Nuk ka imazh
                </div>
              )}

              {Array.isArray(project.images) && project.images.length > 1 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {project.images.map((img: any, index: number) => (
                    <img
                      key={index}
                      src={img?.url}
                      alt={img?.caption || project.title}
                      className="w-full h-32 object-cover rounded-xl border border-white/5"
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-8">
              <div>
                <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">
                  {project.title}
                </h1>
                <div className="flex items-center gap-2 text-muted-foreground mb-4">
                  <MapPin size={18} />
                  <span>
                    {[project.address, project.city, project.country].filter(Boolean).join(", ")}
                  </span>
                </div>
                <p className="text-3xl font-bold text-primary">
                  {project.price ? `${project.price} ${project.currency || ""}` : "Çmimi sipas kërkesës"}
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-card rounded-2xl p-4 border border-white/5">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <BedDouble size={18} />
                    <span>Dhoma</span>
                  </div>
                  <p className="text-white font-semibold">{project.bedrooms ?? "-"}</p>
                </div>

                <div className="bg-card rounded-2xl p-4 border border-white/5">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <Bath size={18} />
                    <span>Banjo</span>
                  </div>
                  <p className="text-white font-semibold">{project.bathrooms ?? "-"}</p>
                </div>

                <div className="bg-card rounded-2xl p-4 border border-white/5">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <Maximize size={18} />
                    <span>m²</span>
                  </div>
                  <p className="text-white font-semibold">{project.area_m2 ?? "-"}</p>
                </div>

                <div className="bg-card rounded-2xl p-4 border border-white/5">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <Building2 size={18} />
                    <span>Statusi</span>
                  </div>
                  <p className="text-white font-semibold">{project.status || "-"}</p>
                </div>
              </div>

              {project.description && (
                <div className="bg-card rounded-2xl p-6 border border-white/5">
                  <h2 className="font-display text-2xl text-white mb-4">Përshkrimi</h2>
                  <p className="text-muted-foreground leading-relaxed">{project.description}</p>
                </div>
              )}

              {(project.contact_company || project.contact_phone || project.contact_email) && (
                <div className="bg-card rounded-2xl p-6 border border-white/5">
                  <h2 className="font-display text-2xl text-white mb-4">Kërko Informacion</h2>
                  <div className="space-y-3 text-muted-foreground">
                    {project.contact_company && (
                      <div className="flex items-center gap-3">
                        <Building2 size={18} />
                        <span>{project.contact_company}</span>
                      </div>
                    )}
                    {project.contact_phone && (
                      <div className="flex items-center gap-3">
                        <Phone size={18} />
                        <span>{project.contact_phone}</span>
                      </div>
                    )}
                    {project.contact_email && (
                      <div className="flex items-center gap-3">
                        <Mail size={18} />
                        <span>{project.contact_email}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {project.virtual_tour_url && (
                <div className="bg-card rounded-2xl p-6 border border-white/5">
                  <h2 className="font-display text-2xl text-white mb-4">Tur Virtual</h2>
                  <a
                    href={project.virtual_tour_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold"
                  >
                    Hape Turin Virtual
                  </a>
                </div>
              )}

              {project.virtual_tour_embed_code && (
                <div className="bg-card rounded-2xl p-6 border border-white/5">
                  <h2 className="font-display text-2xl text-white mb-4">Tur Virtual 360°</h2>
                  <div
                    className="rounded-xl overflow-hidden"
                    dangerouslySetInnerHTML={{ __html: project.virtual_tour_embed_code }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Search, Building2, Map, ShieldCheck } from "lucide-react";
import { Layout } from "@/components/Layout";
import { ProjectCard } from "@/components/ProjectCard";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [, setLocation] = useLocation();
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [search, setSearch] = useState("");

  const [countries, setCountries] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRecentProjects = async () => {
      setIsLoading(true);

const nowIso = new Date().toISOString();

const { data, error } = await supabase
  .from("properties")
  .select("*")
  .eq("listing_status", "active")
  .eq("is_paused", false)
  .or(`expires_at.is.null,expires_at.gte.${nowIso}`)
  .order("created_at", { ascending: false })
  .limit(6);

      if (error) {
        console.error("Fetch recent properties error:", error);
        setRecentProjects([]);
      } else {
        const properties = data || [];

        if (properties.length === 0) {
          setRecentProjects([]);
        } else {
          const propertyIds = properties.map((item) => item.id);

          const { data: sceneRows, error: sceneError } = await supabase
            .from("virtual_tour_scenes")
            .select("property_id")
            .in("property_id", propertyIds);

          if (sceneError) {
            console.error("Fetch virtual tour scenes error:", sceneError);
          }

          const scenePropertyIds = new Set(
            (sceneRows || []).map((row) => String(row.property_id)),
          );

          const enrichedProjects = properties.map((property) => ({
            ...property,
            hasVirtualTour:
              scenePropertyIds.has(String(property.id)) ||
              !!property.virtualTourUrl ||
              !!property.virtualTourEmbedCode ||
              !!property.virtual_tour_url ||
              !!property.virtual_tour_embed_code,
          }));

          setRecentProjects(enrichedProjects);
        }
      }

      setIsLoading(false);
    };

    fetchRecentProjects();
  }, []);

  useEffect(() => {



const fetchFilters = async () => {
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("properties")
    .select("country, city")
    .eq("listing_status", "active")
    .eq("is_paused", false)
    .or(`expires_at.is.null,expires_at.gte.${nowIso}`);

  if (error) {
    console.error("Error fetching filters:", error);
    return;
  }

  if (data) {
    const countries = [
      ...new Set(data.map((item) => item.country).filter(Boolean)),
    ];

    const cities = [
      ...new Set(data.map((item) => item.city).filter(Boolean)),
    ];

    setCountries(countries);
    setCities(cities);
  }
};



    fetchFilters();
  }, [country]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (country) params.append("country", country);
    if (city) params.append("city", city);
    if (search) params.append("search", search);
    setLocation(`/projects${params.toString() ? `?${params.toString()}` : ""}`);
  };

  return (
    <Layout>
      <section className="relative min-h-[90vh] flex items-center justify-center pt-20">
        <div className="absolute inset-0 z-0">
          <img
            src={`${import.meta.env.BASE_URL}images/hero-bg.png`}
            alt="Luxury Mansion"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-background/70 mix-blend-multiply" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 w-full text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <h1 className="font-display text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              Zbulo <br />
              <span className="text-gold-gradient italic">Pronën Tënde të Ëndrrave</span>
            </h1>
            <p className="text-lg md:text-xl text-white/80 font-light mb-12 max-w-2xl mx-auto">
              Prona ekskluzive, ture virtuale mahnitëse dhe përvoja të pashembullta në fushën e
              pasurive të paluajtshme luksoze.
            </p>

            <form
              onSubmit={handleSearch}
              className="glass-panel rounded-2xl p-2 max-w-4xl mx-auto flex flex-col md:flex-row gap-2"
            >
              <select
                className="w-full md:w-auto flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-primary appearance-none cursor-pointer"
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value);
                  setCity("");
                }}
              >
                <option value="" className="bg-card text-white">
                  Të Gjitha Shtetet
                </option>
                {countries.map((c) => (
                  <option key={c} value={c} className="bg-card text-white">
                    {c}
                  </option>
                ))}
              </select>

              <select
                className="w-full md:w-auto flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-primary appearance-none cursor-pointer disabled:opacity-50"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                disabled={!country}
              >
                <option value="" className="bg-card text-white">
                  Të Gjitha Qytetet
                </option>
                {cities.map((c) => (
                  <option key={c} value={c} className="bg-card text-white">
                    {c}
                  </option>
                ))}
              </select>

              <div className="w-full md:w-auto flex-[1.5] relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={20} />
                <input
                  type="text"
                  placeholder="Fjalë kyçe, emri i pronës..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-4 text-white placeholder:text-white/40 focus:outline-none focus:border-primary"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="w-full md:w-auto px-8 py-4 bg-primary text-primary-foreground font-bold tracking-wider uppercase text-sm rounded-xl hover:bg-primary/90 transition-colors"
              >
                Kërko
              </button>
            </form>
          </motion.div>
        </div>
      </section>

      <section className="py-24 bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="text-center group">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-background border border-white/5 flex items-center justify-center text-primary group-hover:scale-110 group-hover:bg-primary group-hover:text-background transition-all duration-500">
                <Map size={32} strokeWidth={1.5} />
              </div>
              <h3 className="font-display text-2xl text-white mb-3">Ture Virtuale 360°</h3>
              <p className="text-muted-foreground leading-relaxed">
                Eksperienconi pronat sikur të ishit aty. Turet tona virtuale të integruara ofrojnë
                një shëtitje reale të pakrahasueshme.
              </p>
            </div>
            <div className="text-center group">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-background border border-white/5 flex items-center justify-center text-primary group-hover:scale-110 group-hover:bg-primary group-hover:text-background transition-all duration-500">
                <Building2 size={32} strokeWidth={1.5} />
              </div>
              <h3 className="font-display text-2xl text-white mb-3">Portofol i Përzgjedhur</h3>
              <p className="text-muted-foreground leading-relaxed">
                Përftoni akses në një koleksion ekskluziv të pronave rezidenciale dhe komerciale më
                të kërkuara në botë.
              </p>
            </div>
            <div className="text-center group">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-background border border-white/5 flex items-center justify-center text-primary group-hover:scale-110 group-hover:bg-primary group-hover:text-background transition-all duration-500">
                <ShieldCheck size={32} strokeWidth={1.5} />
              </div>
              <h3 className="font-display text-2xl text-white mb-3">Shërbim i Klasit të Parë</h3>
              <p className="text-muted-foreground leading-relaxed">
                Një qasje e dedikuar në fushën e pasurive të paluajtshme që i përshtatet natyrës
                premium të pronave që përfaqësojmë.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-32 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
            <div>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">
                Pronat e Fundit
              </h2>
              <p className="text-muted-foreground text-lg max-w-xl">
                Eksploroni kryeveprat tona të listuara së fundmi, të zgjedhura me kujdes për
                blerësin kërkues.
              </p>
            </div>
            <Link
              href="/projects"
              className="group flex items-center gap-2 text-primary font-medium tracking-widest uppercase text-sm hover:text-white transition-colors"
            >
              Shiko Të Gjitha Pronat
              <span className="w-8 h-[1px] bg-primary group-hover:bg-white transition-colors" />
            </Link>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse bg-card rounded-2xl h-[400px]" />
              ))}
            </div>
          ) : recentProjects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {recentProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-card rounded-2xl border border-white/5">
              <p className="text-muted-foreground text-lg">
                Nuk ka projekte të veçuara aktualisht.
              </p>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}
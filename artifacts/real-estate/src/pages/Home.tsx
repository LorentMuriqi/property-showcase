import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Search, Building2, Map, ShieldCheck } from "lucide-react";
import { Layout } from "@/components/Layout";
import { ProjectCard } from "@/components/ProjectCard";
import { supabase } from "@/lib/supabase";

const clearProjectsRestoreState = () => {
  sessionStorage.removeItem("projects-scroll-y");
  sessionStorage.removeItem("projects-return-url");
  sessionStorage.removeItem("projects-restore-scroll");
  sessionStorage.removeItem("projects-active-card-id");
  sessionStorage.removeItem("projects-active-card-top");
};

const prepareProjectsNavigationFromHome = () => {
  clearProjectsRestoreState();
  sessionStorage.removeItem("skip-global-scroll");
  sessionStorage.setItem("force-scroll-top", "1");
};

export default function Home() {
  const [, setLocation] = useLocation();
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [search, setSearch] = useState("");

  const [countries, setCountries] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [allFilterRows, setAllFilterRows] = useState<
    { country: string | null; city: string | null }[]
  >([]);
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHomeData = async () => {
      setIsLoading(true);

      const nowIso = new Date().toISOString();

      const { data, error } = await supabase
        .from("properties")
        .select(`
          id,
          title,
          description,
          country,
          city,
          address,
          status,
          property_type,
          price,
          currency,
          images,
          created_at,
          listing_status,
          is_paused,
          expires_at
        `)
        .eq("listing_status", "active")
        .eq("is_paused", false)
        .or(`expires_at.is.null,expires_at.gte.${nowIso}`)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Fetch home data error:", error);
        setRecentProjects([]);
        setAllFilterRows([]);
        setCountries([]);
        setCities([]);
        setIsLoading(false);
        return;
      }

      const rows = data || [];
      const propertyIds = rows.map((item) => item.id);

      let scenePropertyIds = new Set<string>();

      if (propertyIds.length > 0) {
        const { data: sceneRows, error: sceneError } = await supabase
          .from("virtual_tour_scenes")
          .select("property_id")
          .in("property_id", propertyIds);

        if (sceneError) {
          console.error("Fetch virtual tour scenes error:", sceneError);
        } else {
          scenePropertyIds = new Set(
            (sceneRows || []).map((scene) => String(scene.property_id))
          );
        }
      }

      const rowsWithVirtualTour = rows.map((item) => {
        const hasVirtualTour =
          !!item.virtual_tour_url ||
          !!item.virtual_tour_embed_code ||
          !!item.has_custom_virtual_tour ||
          scenePropertyIds.has(String(item.id));

        return {
          ...item,
          hasVirtualTour,
        };
      });

      setRecentProjects(rowsWithVirtualTour.slice(0, 6));

      setAllFilterRows(
        rows.map((item) => ({
          country: item.country ?? null,
          city: item.city ?? null,
        }))
      );

      const allCountries = [
        ...new Set(rows.map((item) => item.country).filter(Boolean)),
      ] as string[];

      setCountries(allCountries);
      setIsLoading(false);
    };

    fetchHomeData();
  }, []);

  useEffect(() => {
    if (country) {
      const filteredCities = [
        ...new Set(
          allFilterRows
            .filter((item) => item.country === country)
            .map((item) => item.city)
            .filter(Boolean)
        ),
      ] as string[];

      setCities(filteredCities);
    } else {
      setCities([]);
    }
  }, [country, allFilterRows]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    prepareProjectsNavigationFromHome();

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
                className="w-full md:w-auto flex-1 bg-white/90 border border-border rounded-xl px-4 py-4 text-foreground focus:outline-none focus:border-primary appearance-none cursor-pointer"
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value);
                  setCity("");
                }}
              >
                <option value="" className="bg-white text-foreground">
                  Të Gjitha Shtetet
                </option>
                {countries.map((c) => (
                  <option key={c} value={c} className="bg-white text-foreground">
                    {c}
                  </option>
                ))}
              </select>

              <select
                className="w-full md:w-auto flex-1 bg-white/90 border border-border rounded-xl px-4 py-4 text-foreground focus:outline-none focus:border-primary appearance-none cursor-pointer disabled:opacity-50"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                disabled={!country}
              >
                <option value="" className="bg-white text-foreground">
                  Të Gjitha Qytetet
                </option>
                {cities.map((c) => (
                  <option key={c} value={c} className="bg-white text-foreground">
                    {c}
                  </option>
                ))}
              </select>

              <div className="w-full md:w-auto flex-[1.5] relative">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                  size={20}
                />
                <input
                  type="text"
                  placeholder="Fjalë kyçe, emri i pronës..."
                  className="w-full bg-white/90 border border-border rounded-xl pl-12 pr-4 py-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
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
              <h3 className="font-display text-2xl text-foreground mb-3 font-bold">Ture Virtuale 360°</h3>
              <p className="text-muted-foreground leading-relaxed">
                Eksperienconi pronat sikur të ishit aty. Turet tona virtuale të integruara ofrojnë
                një shëtitje reale të pakrahasueshme.
              </p>
            </div>
            <div className="text-center group">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-background border border-white/5 flex items-center justify-center text-primary group-hover:scale-110 group-hover:bg-primary group-hover:text-background transition-all duration-500">
                <Building2 size={32} strokeWidth={1.5} />
              </div>
              <h3 className="font-display text-2xl text-foreground mb-3 font-bold">Portofol i Përzgjedhur</h3>
              <p className="text-muted-foreground leading-relaxed">
                Përftoni akses në një koleksion ekskluziv të pronave rezidenciale dhe komerciale më
                të kërkuara në botë.
              </p>
            </div>
            <div className="text-center group">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-background border border-white/5 flex items-center justify-center text-primary group-hover:scale-110 group-hover:bg-primary group-hover:text-background transition-all duration-500">
                <ShieldCheck size={32} strokeWidth={1.5} />
              </div>
              <h3 className="font-display text-2xl text-foreground mb-3 font-bold">Shërbim i Klasit të Parë</h3>
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
              <h2 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">
                Pronat e Fundit
              </h2>
              <p className="text-muted-foreground text-lg max-w-xl">
                Eksploroni kryeveprat tona të listuara së fundmi, të zgjedhura me kujdes për
                blerësin kërkues.
              </p>
            </div>
            <Link
              href="/projects"
              onClick={() => {
                prepareProjectsNavigationFromHome();
              }}
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
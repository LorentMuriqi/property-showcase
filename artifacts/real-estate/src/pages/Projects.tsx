import { useState, useEffect } from "react";
import { Filter, X, Search } from "lucide-react";
import { Layout } from "@/components/Layout";
import { ProjectCard } from "@/components/ProjectCard";
import { supabase } from "@/lib/supabase";

export default function Projects() {
  const searchParams = new URLSearchParams(window.location.search);

  const [country, setCountry] = useState(searchParams.get("country") || "");
  const [city, setCity] = useState(searchParams.get("city") || "");
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [showFilters, setShowFilters] = useState(false);

  const [projects, setProjects] = useState<any[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (country) params.append("country", country);
    if (city) params.append("city", city);
    if (search) params.append("search", search);

    const newUrl = `/projects${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState({}, "", newUrl);
  }, [country, city, search]);

  useEffect(() => {
    const fetchProjects = async () => {
      setIsLoading(true);

      const nowIso = new Date().toISOString();

      let query = supabase
        .from("properties")
        .select("*")
        .eq("listing_status", "active")
        .eq("is_paused", false)
        .or(`expires_at.is.null,expires_at.gte.${nowIso}`);

      if (country) {
        query = query.eq("country", country);
      }

      if (city) {
        query = query.eq("city", city);
      }

      if (search.trim()) {
        const safeSearch = search.trim().replace(/,/g, " ");
        query = query.or(
          `title.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%,location.ilike.%${safeSearch}%`
        );
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) {
        console.error("Supabase fetch error:", error);
        setProjects([]);
      } else {
        setProjects(data || []);
      }

      setIsLoading(false);
    };

    fetchProjects();
  }, [country, city, search]);

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
        console.error("Supabase filter fetch error:", error);
        return;
      }

      const allCountries = [...new Set((data || []).map((item) => item.country).filter(Boolean))] as string[];
      setCountries(allCountries);

      if (country) {
        const filteredCities = [
          ...new Set(
            (data || [])
              .filter((item) => item.country === country)
              .map((item) => item.city)
              .filter(Boolean)
          ),
        ] as string[];

        setCities(filteredCities);
      } else {
        setCities([]);
      }
    };

    fetchFilters();
  }, [country]);

  const clearFilters = () => {
    setCountry("");
    setCity("");
    setSearch("");
  };

  return (
    <Layout>
      <div className="pt-32 pb-24 bg-background min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12">
            <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">Prona</h1>
            <p className="text-muted-foreground text-lg">
              Shfletoni koleksionin tonë të plotë të pronave luksoze.
            </p>
          </div>

          <div className="flex flex-col lg:flex-row gap-8 items-start">
            <button
              className="lg:hidden w-full py-4 border border-white/10 rounded-xl flex items-center justify-center gap-2 text-white font-medium bg-card"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter size={20} />
              {showFilters ? "Fshih Filtrat" : "Shfaq Filtrat"}
            </button>

            <div className={`w-full lg:w-80 shrink-0 space-y-8 ${showFilters ? "block" : "hidden lg:block"}`}>
              <div className="glass-panel p-6 rounded-2xl sticky top-24">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-display text-xl text-white">Filtrat</h3>
                  {(country || city || search) && (
                    <button
                      onClick={clearFilters}
                      className="text-sm text-primary hover:text-white flex items-center gap-1"
                    >
                      <X size={14} /> Pastro
                    </button>
                  )}
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2 uppercase tracking-wider">
                      Kërko
                    </label>
                    <input
                      type="text"
                      placeholder="Fjalë kyçe..."
                      className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-primary"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2 uppercase tracking-wider">
                      Shteti
                    </label>
                    <select
                      className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary appearance-none cursor-pointer"
                      value={country}
                      onChange={(e) => {
                        setCountry(e.target.value);
                        setCity("");
                      }}
                    >
                      <option value="">Të Gjitha Shtetet</option>
                      {countries.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={!country ? "opacity-50" : ""}>
                    <label className="block text-sm font-medium text-white/70 mb-2 uppercase tracking-wider">
                      Qyteti
                    </label>
                    <select
                      className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary appearance-none cursor-pointer"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      disabled={!country}
                    >
                      <option value="">Të Gjitha Qytetet</option>
                      {cities.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 w-full">
              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="animate-pulse bg-card rounded-2xl h-[400px]" />
                  ))}
                </div>
              ) : projects.length > 0 ? (
                <>
                  <p className="text-muted-foreground mb-6">{projects.length} prona të gjetura</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {projects.map((project) => (
                      <ProjectCard key={project.id} project={project} />
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-32 bg-card rounded-2xl border border-white/5">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4 text-white/40">
                    <Search size={24} />
                  </div>
                  <h3 className="font-display text-2xl text-white mb-2">Asnjë pronë nuk u gjet</h3>
                  <p className="text-muted-foreground">Provoni të rregulloni kërkimin ose filtrat.</p>
                  <button
                    onClick={clearFilters}
                    className="mt-6 px-6 py-2 border border-primary text-primary hover:bg-primary hover:text-background rounded-full transition-colors"
                  >
                    Pastro Filtrat
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
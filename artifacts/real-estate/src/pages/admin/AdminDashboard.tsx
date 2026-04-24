import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Filter, Search } from "lucide-react";
import {
  Plus,
  Edit,
  Trash2,
  Home,
  ExternalLink,
  Focus,
  EyeOff,
  RefreshCw,
  Ban,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

type AdminListingStatus = "active" | "paused" | "expired";
type VirtualTourStatusFilter = "published" | "draft";
type SortMode = "default" | "expiry_asc" | "expiry_desc";

function getComputedListingStatus(project: any): AdminListingStatus {
  if (project.is_paused) return "paused";
  if (project.listing_status === "expired") return "expired";
  if (project.expires_at && new Date(project.expires_at).getTime() < Date.now()) {
    return "expired";
  }
  return "active";
}

export default function AdminDashboard() {
  const {
    isAdmin,
    isSuperAdmin,
    permissions,
    isLoading: authLoading,
    logout,
  } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionId, setActionId] = useState<string | number | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("default");
  const [statusFilters, setStatusFilters] = useState<AdminListingStatus[]>([]);
  const [virtualTourFilters, setVirtualTourFilters] = useState<VirtualTourStatusFilter[]>([]);
  const [showFilter, setShowFilter] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
const [cityFilter, setCityFilter] = useState("");
const [countryFilter, setCountryFilter] = useState("");

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      setLocation("/admin/login");
    }
  }, [authLoading, isAdmin, setLocation]);

  const fetchProjects = async () => {
    if (authLoading || !isAdmin) return;

    setIsLoading(true);

    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Admin fetch error:", error);
      toast({
        title: "Gabim",
        description: "Nuk u ngarkuan pronat.",
        variant: "destructive",
      });
      setProjects([]);
      setIsLoading(false);
      return;
    }

    const now = Date.now();
    const expiredToUpdate = (data || []).filter(
      (project) =>
        !project.is_paused &&
        project.expires_at &&
        new Date(project.expires_at).getTime() < now &&
        project.listing_status !== "expired",
    );

    if (expiredToUpdate.length > 0) {
      const ids = expiredToUpdate.map((p) => p.id);

      await supabase
        .from("properties")
        .update({ listing_status: "expired" })
        .in("id", ids);

      const { data: refreshed, error: refreshedError } = await supabase
        .from("properties")
        .select("*")
        .order("created_at", { ascending: false });

      if (refreshedError) {
        console.error("Admin refresh error:", refreshedError);
        setProjects(data || []);
      } else {
        setProjects(refreshed || []);
      }
    } else {
      setProjects(data || []);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchProjects();
  }, [authLoading, isAdmin]);
  
  
  useEffect(() => {
  const handleClickOutside = () => {
    setShowFilter(false);
  };

  window.addEventListener("click", handleClickOutside);

  return () => {
    window.removeEventListener("click", handleClickOutside);
  };
}, []);

  const handleDelete = async (id: number | string, title: string) => {
    if (!confirm(`A jeni i sigurt që dëshironi të fshini përgjithmonë "${title}"?`)) {
      return;
    }

    try {
      setIsDeleting(true);

      const { data: scenes, error: scenesError } = await supabase
        .from("virtual_tour_scenes")
        .select("id")
        .eq("property_id", id);

      if (scenesError) throw scenesError;

      const sceneIds = (scenes || []).map((scene) => scene.id);

      if (sceneIds.length > 0) {
        const { error: hotspotsBySceneError } = await supabase
          .from("virtual_tour_hotspots")
          .delete()
          .in("scene_id", sceneIds);

        if (hotspotsBySceneError) throw hotspotsBySceneError;

        const { error: hotspotsByTargetError } = await supabase
          .from("virtual_tour_hotspots")
          .delete()
          .in("to_scene_id", sceneIds);

        if (hotspotsByTargetError) throw hotspotsByTargetError;

        const { error: scenesDeleteError } = await supabase
          .from("virtual_tour_scenes")
          .delete()
          .in("id", sceneIds);

        if (scenesDeleteError) throw scenesDeleteError;
      }

      const { error: propertyDeleteError } = await supabase
        .from("properties")
        .delete()
        .eq("id", id);

      if (propertyDeleteError) throw propertyDeleteError;

      setProjects((prev) => prev.filter((project) => project.id !== id));

      toast({
        title: "Projekti u Fshi",
        description: "Prona dhe të gjitha të dhënat e lidhura u hoqën me sukses.",
      });
    } catch (err) {
      console.error("Delete error:", err);
      toast({
        title: "Gabim",
        description: "Dështoi fshirja e projektit.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePause = async (project: any) => {
    if (!confirm(`A jeni i sigurt që dëshironi ta pezulloni "${project.title}"?`)) {
      return;
    }
    try {
      setActionId(project.id);

      const { error } = await supabase
        .from("properties")
        .update({
          is_paused: true,
          listing_status: "paused",
        })
        .eq("id", project.id);

      if (error) throw error;

      toast({
        title: "Sukses",
        description: "Projekti u pezullua.",
      });

      await fetchProjects();
    } catch (error: any) {
      toast({
        title: "Gabim",
        description: error.message || "Nuk u pezullua projekti.",
        variant: "destructive",
      });
    } finally {
      setActionId(null);
    }
  };

  const handleExpire = async (project: any) => {
    if (!confirm(`A jeni i sigurt që dëshironi ta skadoni "${project.title}"?`)) {
      return;
    }
    try {
      setActionId(project.id);

      const { error } = await supabase
        .from("properties")
        .update({
          is_paused: false,
          listing_status: "expired",
          expires_at: new Date().toISOString(),
        })
        .eq("id", project.id);

      if (error) throw error;

      toast({
        title: "Sukses",
        description: "Projekti u skadua.",
      });

      await fetchProjects();
    } catch (error: any) {
      toast({
        title: "Gabim",
        description: error.message || "Nuk u skadua projekti.",
        variant: "destructive",
      });
    } finally {
      setActionId(null);
    }
  };

  const handleResume = async (project: any) => {
    if (!confirm(`A jeni i sigurt që dëshironi ta riaktivizoni "${project.title}"?`)) {
      return;
    }
    try {
      setActionId(project.id);

      const activeDays = project.active_days || 30;
      const newExpiresAt = new Date(
        Date.now() + activeDays * 24 * 60 * 60 * 1000,
      ).toISOString();

      const { error } = await supabase
        .from("properties")
        .update({
          is_paused: false,
          listing_status: "active",
          published_at: new Date().toISOString(),
          expires_at: newExpiresAt,
        })
        .eq("id", project.id);

      if (error) throw error;

      toast({
        title: "Sukses",
        description: "Projekti u riaktivizua.",
      });

      await fetchProjects();
    } catch (error: any) {
      toast({
        title: "Gabim",
        description: error.message || "Nuk u riaktivizua projekti.",
        variant: "destructive",
      });
    } finally {
      setActionId(null);
    }
  };

  const statusMeta = useMemo(
    () => ({
      active: {
        label: "Publikuar",
        className:
          "px-2 py-1 rounded-full text-xs border border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
      },
      paused: {
        label: "Pezulluar",
        className:
          "px-2 py-1 rounded-full text-xs border border-yellow-500/20 bg-yellow-500/10 text-yellow-400",
      },
      expired: {
        label: "Skaduar",
        className:
          "px-2 py-1 rounded-full text-xs border border-red-500/20 bg-red-500/10 text-red-400",
      },
    }),
    [],
  );


const countries = useMemo(() => {
  return Array.from(
    new Set(projects.map((project) => project.country).filter(Boolean))
  ).sort();
}, [projects]);

const cities = useMemo(() => {
  return Array.from(
    new Set(
      projects
        .filter((project) => !countryFilter || project.country === countryFilter)
        .map((project) => project.city)
        .filter(Boolean)
    )
  ).sort();
}, [projects, countryFilter]);



const getSortedProjects = () => {
const normalizedSearch = searchQuery.trim().toLowerCase();

const filtered = projects.filter((project) => {
  const matchesStatus =
    statusFilters.length === 0 ||
    statusFilters.includes(getComputedListingStatus(project));
	
	const matchesVirtualTour =
  virtualTourFilters.length === 0 ||
  virtualTourFilters.includes(
    project.virtual_tour_status === "published" ? "published" : "draft"
  );

  const matchesSearch =
    !normalizedSearch ||
    String(project.title || "").toLowerCase().includes(normalizedSearch) ||
    String(project.city || "").toLowerCase().includes(normalizedSearch) ||
    String(project.country || "").toLowerCase().includes(normalizedSearch);

  const matchesCity = !cityFilter || project.city === cityFilter;
  const matchesCountry = !countryFilter || project.country === countryFilter;

  return (
  matchesStatus &&
  matchesVirtualTour &&
  matchesSearch &&
  matchesCity &&
  matchesCountry
);
});

  const copy = [...filtered];

  if (sortMode === "default") {
    return copy;
  }

  return copy.sort((a, b) => {
    const aTime = a.expires_at ? new Date(a.expires_at).getTime() : Infinity;
    const bTime = b.expires_at ? new Date(b.expires_at).getTime() : Infinity;

    if (sortMode === "expiry_asc") return aTime - bTime;
    if (sortMode === "expiry_desc") return bTime - aTime;

    return 0;
  });
};

  if (authLoading) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      <aside className="w-full md:w-64 glass-panel border-r border-border flex flex-col hidden md:flex h-screen sticky top-0">
        <div className="p-6 border-b border-border">
          <span className="font-display text-xl font-bold tracking-wider text-foreground">
            AURA
            <span className="font-sans font-light text-muted-foreground ml-2 text-xs tracking-widest uppercase">
              Admin
            </span>
          </span>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <Link
            href="/admin"
            className="flex items-center gap-3 px-4 py-3 bg-primary/10 text-primary rounded-xl font-medium"
          >
            <Home size={18} /> Properties
          </Link>

          {isSuperAdmin && (
            <>
              <Link
                href="/admin/users"
                className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl font-medium transition-colors"
              >
                <ExternalLink size={18} /> Users
              </Link>

              <Link
                href="/admin/rules"
                className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl font-medium transition-colors"
              >
                <ExternalLink size={18} /> Rules
              </Link>
            </>
          )}

          <Link
            href="/"
            className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl font-medium transition-colors"
          >
            <ExternalLink size={18} /> Shiko Faqen
          </Link>
        </nav>

        <div className="p-4 border-t border-border">
          <button
            onClick={logout}
            className="w-full py-3 text-destructive border border-destructive/20 hover:bg-destructive hover:text-white rounded-xl font-medium transition-colors"
          >
            Dalje
          </button>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="md:hidden flex justify-between items-center mb-6 glass-panel p-4 rounded-2xl">
          <span className="font-display text-xl font-bold text-foreground">AURA Admin</span>
          <button onClick={logout} className="text-destructive text-sm font-medium">
            Dalje
          </button>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="font-display text-3xl text-foreground font-bold">
              Portofoli i Pronave
            </h1>
						
			
            <p className="text-muted-foreground mt-1">
              Menaxho listimet dhe turet virtuale.
            </p>
          </div>

          {permissions.canCreateProperty && (
            <Link
              href="/admin/projects/new"
              className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold tracking-widest uppercase text-sm rounded-xl hover:bg-white hover:text-foreground transition-colors"
            >
              <Plus size={18} /> Projekt i Ri
            </Link>
          )}
        </div>
		
		
		
		<div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
  <div className="relative">
    <Search
      size={18}
      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
    />
    <input
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      placeholder="Kërko pronë, qytet ose shtet..."
      className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
    />
  </div>

  <select
    value={countryFilter}
    onChange={(e) => {
      setCountryFilter(e.target.value);
      setCityFilter("");
    }}
    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary"
  >
    <option value="">Të gjitha shtetet</option>
    {countries.map((country) => (
      <option key={country} value={country}>
        {country}
      </option>
    ))}
  </select>

  <select
    value={cityFilter}
    onChange={(e) => setCityFilter(e.target.value)}
    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary disabled:opacity-50"
    disabled={!countryFilter && cities.length === 0}
  >
    <option value="">Të gjitha qytetet</option>
    {cities.map((city) => (
      <option key={city} value={city}>
        {city}
      </option>
    ))}
  </select>
  
  <select
  value={virtualTourFilters[0] || ""}
  onChange={(e) => {
    const value = e.target.value as VirtualTourStatusFilter | "";
    setVirtualTourFilters(value ? [value] : []);
  }}
  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary"
>
  <option value="">Të gjitha turet virtuale</option>
  <option value="published">Virtual Tour Active</option>
  <option value="draft">Virtual Tour Draft</option>
</select>
  
  
</div>
		
		

        {isLoading ? (
          <div className="glass-panel rounded-2xl p-8 text-center animate-pulse text-muted-foreground">
            Duke ngarkuar të dhënat e portofolit...
          </div>
        ) : (
          <div className="glass-panel rounded-2xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="p-4 font-medium">Prona</th>
                    <th className="p-4 font-medium">Çmimi</th>
<th className="p-4 font-medium relative">
  <div
    onClick={(e) => {
  e.stopPropagation();
  setShowFilter((prev) => !prev);
}}
    className="flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground"
  >
    Statusi
    <Filter size={14} />
  </div>

{showFilter && (
  <div
  onClick={(e) => e.stopPropagation()}
  className="absolute z-50 mt-1.5 w-56 bg-background border border-border rounded-xl shadow-lg p-2"
>
    <div className="min-h-[44px] flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 mb-2">
      {statusFilters.length === 0 ? (
        <span className="text-xs text-muted-foreground">Zgjidh statusin</span>
      ) : (
        statusFilters.map((status) => (
          <span
            key={status}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs"
          >
            {status === "active" && "Publikuar"}
            {status === "paused" && "Pezulluar"}
            {status === "expired" && "Skaduar"}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setStatusFilters((prev) => prev.filter((s) => s !== status));
              }}
              className="text-primary/70 hover:text-primary"
            >
              ×
            </button>
          </span>
        ))
      )}
    </div>

    <div className="space-y-1">
      {["active", "paused", "expired"].map((status) => {
        const isSelected = statusFilters.includes(status as AdminListingStatus);

        return (
          <div
            key={status}
            onClick={() => {
              if (isSelected) {
                setStatusFilters((prev) =>
                  prev.filter((s) => s !== status)
                );
              } else {
                setStatusFilters((prev) => [...prev, status as AdminListingStatus]);
              }
            }}
            className={`px-2.5 py-1.5 rounded-md cursor-pointer text-xs font-medium transition-colors ${
              isSelected
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {status === "active" && "Publikuar"}
            {status === "paused" && "Pezulluar"}
            {status === "expired" && "Skaduar"}
          </div>
        );
      })}
    </div>
  </div>
)}
  
  
  
</th>
                    <th className="p-4 font-medium">Data e Skadimit</th>
                    <th className="p-4 font-medium text-right">Veprimet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {getSortedProjects().map((project) => {
                    const listingStatus = getComputedListingStatus(project);
                    const meta = statusMeta[listingStatus];

                    return (
                      <tr key={project.id} className="hover:bg-muted/60 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg bg-card overflow-hidden shrink-0">
                              {project.images?.[0] ? (
                                <img
                                  src={project.images[0].url}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-muted flex items-center justify-center text-[10px] text-muted-foreground">
                                  S'ka Foto
                                </div>
                              )}
                            </div>
                            <div>
                              <span className="font-medium text-foreground max-w-[220px] truncate block">
                                {project.title}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {project.city}, {project.country}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="p-4 text-primary font-medium text-sm">
                          {project.price
                            ? `€${new Intl.NumberFormat("en-US").format(project.price)}`
                            : "-"}
                        </td>

                        <td className="p-4">
                          <div className="flex flex-col gap-1">
                            <span className={meta.className}>{meta.label}</span>
                            {project.expires_at && (
                              <span className="text-[11px] text-muted-foreground">
                                Skadon më{" "}
                                {new Date(project.expires_at).toLocaleDateString("sq-AL", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="p-4 text-muted-foreground text-sm">
                          {project.expires_at
                            ? new Date(project.expires_at).toLocaleDateString("sq-AL", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })
                            : "-"}
                        </td>

                        <td className="p-4 text-right space-x-2">
                          {listingStatus === "active" && permissions.canEditProperty && (
                            <>
                              <button
                                onClick={() => handlePause(project)}
                                disabled={actionId === project.id}
                                className="p-2 text-yellow-400 hover:text-white bg-yellow-500/10 hover:bg-yellow-500/30 rounded-lg transition-colors inline-flex"
                                title="Pezullo projektin"
                              >
                                <EyeOff size={16} />
                              </button>

                              <button
                                onClick={() => handleExpire(project)}
                                disabled={actionId === project.id}
                                className="p-2 text-amber-400 hover:text-white bg-amber-500/10 hover:bg-amber-500/30 rounded-lg transition-colors inline-flex"
                                title="Skado projektin"
                              >
                                <Ban size={16} />
                              </button>
                            </>
                          )}

                          {listingStatus === "paused" && permissions.canEditProperty && (
                            <>
                              <button
                                onClick={() => handleResume(project)}
                                disabled={actionId === project.id}
                                className="p-2 text-primary bg-primary/10 hover:bg-primary/30 rounded-lg transition-colors inline-flex"
                                title="Riaktivizo projektin"
                              >
                                <RefreshCw size={16} />
                              </button>

                              <button
                                onClick={() => handleExpire(project)}
                                disabled={actionId === project.id}
                                className="p-2 text-amber-400 hover:text-white bg-amber-500/10 hover:bg-amber-500/30 rounded-lg transition-colors inline-flex"
                                title="Skado projektin"
                              >
                                <Ban size={16} />
                              </button>
                            </>
                          )}

                          {listingStatus === "expired" && permissions.canEditProperty && (
                            <button
                              onClick={() => handleResume(project)}
                              disabled={actionId === project.id}
                              className="p-2 text-primary bg-primary/10 hover:bg-primary/30 rounded-lg transition-colors inline-flex"
                              title="Riaktivizo projektin"
                            >
                              <RefreshCw size={16} />
                            </button>
                          )}

                          {permissions.canManageVirtualTours && (
                            <Link href={`/admin/projects/${project.id}/virtual-tour`}>
                              <button
                                className="p-2 text-primary bg-primary/10 hover:bg-primary/30 rounded-lg transition-colors inline-flex"
                                title="Menaxho Turin Virtual"
                              >
                                <Focus size={16} />
                              </button>
                            </Link>
                          )}

                          {permissions.canEditProperty && (
                            <Link href={`/admin/projects/${project.id}/edit`}>
                              <button className="p-2 text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors inline-flex">
                                <Edit size={16} />
                              </button>
                            </Link>
                          )}

                          {permissions.canDeleteProperty && (
                            <button
                              onClick={() => handleDelete(project.id, project.title)}
                              disabled={isDeleting}
                              className="p-2 text-destructive hover:text-white bg-destructive/10 hover:bg-destructive rounded-lg transition-colors inline-flex"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {getSortedProjects().length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">
                        Asnjë pronë nuk u gjet. Shto listimin tënd të parë.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
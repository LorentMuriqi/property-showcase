import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
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
  const { isAdmin, isLoading: authLoading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionId, setActionId] = useState<string | number | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("default");

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

const handleDelete = async (id: number | string, title: string) => {
  if (!confirm(`A jeni i sigurt që dëshironi të fshini përgjithmonë "${title}"?`)) {
    return;
  }

  try {
    setIsDeleting(true);

    // 1. Merr të gjitha skenat e lidhura me këtë pronë
    const { data: scenes, error: scenesError } = await supabase
      .from("virtual_tour_scenes")
      .select("id")
      .eq("property_id", id);

    if (scenesError) throw scenesError;

    const sceneIds = (scenes || []).map((scene) => scene.id);

    // 2. Fshi hotspot-et e lidhura me këto skena
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

      // 3. Fshi skenat
      const { error: scenesDeleteError } = await supabase
        .from("virtual_tour_scenes")
        .delete()
        .in("id", sceneIds);

      if (scenesDeleteError) throw scenesDeleteError;
    }

    // 4. Fshi pronën
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

  const getSortedProjects = () => {
    const copy = [...projects];

    if (sortMode === "default") {
      return copy;
    }

    return copy.sort((a, b) => {
      const aTime = a.expires_at ? new Date(a.expires_at).getTime() : Infinity;
      const bTime = b.expires_at ? new Date(b.expires_at).getTime() : Infinity;

      if (sortMode === "expiry_asc") {
        return aTime - bTime;
      }

      if (sortMode === "expiry_desc") {
        return bTime - aTime;
      }

      return 0;
    });
  };

  if (authLoading) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      <aside className="w-full md:w-64 glass-panel border-r border-white/5 flex flex-col hidden md:flex h-screen sticky top-0">
        <div className="p-6 border-b border-white/5">
          <span className="font-display text-xl font-bold tracking-wider text-white">
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
            <Home size={18} /> Paneli Administrativ
          </Link>
          <Link
            href="/"
            className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-white hover:bg-white/5 rounded-xl font-medium transition-colors"
          >
            <ExternalLink size={18} /> Shiko Faqen
          </Link>
        </nav>

        <div className="p-4 border-t border-white/5">
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
          <span className="font-display text-xl font-bold text-white">AURA Admin</span>
          <button onClick={logout} className="text-destructive text-sm font-medium">
            Dalje
          </button>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="font-display text-3xl text-white font-bold">
              Portofoli i Pronave
            </h1>
            <p className="text-muted-foreground mt-1">
              Menaxho listimet dhe turet virtuale.
            </p>
          </div>

          <Link
            href="/admin/projects/new"
            className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold tracking-widest uppercase text-sm rounded-xl hover:bg-white transition-colors"
          >
            <Plus size={18} /> Projekt i Ri
          </Link>
        </div>

        {isLoading ? (
          <div className="glass-panel rounded-2xl p-8 text-center animate-pulse text-muted-foreground">
            Duke ngarkuar të dhënat e portofolit...
          </div>
        ) : (
          <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-black/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="p-4 font-medium">Prona</th>
                    <th className="p-4 font-medium">Çmimi</th>
                    <th
                      className="p-4 font-medium cursor-pointer hover:text-white transition-colors select-none"
                      onClick={() => {
                        setSortMode((prev) => {
                          if (prev === "default") return "expiry_asc";
                          if (prev === "expiry_asc") return "expiry_desc";
                          return "default";
                        });
                      }}
                      title="Kliko për renditje sipas skadimit"
                    >
                      Statusi
                    </th>
                    <th className="p-4 font-medium">Data e Skadimit</th>
                    <th className="p-4 font-medium text-right">Veprimet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {getSortedProjects().map((project) => {
                    const listingStatus = getComputedListingStatus(project);
                    const meta = statusMeta[listingStatus];

                    return (
                      <tr key={project.id} className="hover:bg-white/5 transition-colors">
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
                                <div className="w-full h-full bg-white/5 flex items-center justify-center text-[10px] text-muted-foreground">
                                  S'ka Foto
                                </div>
                              )}
                            </div>
                            <div>
                              <span className="font-medium text-white max-w-[220px] truncate block">
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
                          {listingStatus === "active" && (
                            <>
                              <button
                                onClick={() => handlePause(project)}
                                disabled={actionId === project.id}
                                className="p-2 text-yellow-400 hover:text-white bg-yellow-500/10 hover:bg-yellow-500/20 rounded-lg transition-colors inline-flex"
                                title="Pezullo projektin"
                              >
                                <EyeOff size={16} />
                              </button>

                              <button
                                onClick={() => handleExpire(project)}
                                disabled={actionId === project.id}
                                className="p-2 text-amber-400 hover:text-white bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition-colors inline-flex"
                                title="Skado projektin"
                              >
                                <Ban size={16} />
                              </button>
                            </>
                          )}

                          {listingStatus === "paused" && (
                            <>
                              <button
                                onClick={() => handleResume(project)}
                                disabled={actionId === project.id}
                                className="p-2 text-primary hover:text-white bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors inline-flex"
                                title="Riaktivizo projektin"
                              >
                                <RefreshCw size={16} />
                              </button>

                              <button
                                onClick={() => handleExpire(project)}
                                disabled={actionId === project.id}
                                className="p-2 text-amber-400 hover:text-white bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition-colors inline-flex"
                                title="Skado projektin"
                              >
                                <Ban size={16} />
                              </button>
                            </>
                          )}

                          {listingStatus === "expired" && (
                            <button
                              onClick={() => handleResume(project)}
                              disabled={actionId === project.id}
                              className="p-2 text-primary hover:text-white bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors inline-flex"
                              title="Riaktivizo projektin"
                            >
                              <RefreshCw size={16} />
                            </button>
                          )}

                          <Link href={`/admin/projects/${project.id}/virtual-tour`}>
                            <button
                              className="p-2 text-primary hover:text-white bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors inline-flex"
                              title="Menaxho Turin Virtual"
                            >
                              <Focus size={16} />
                            </button>
                          </Link>

                          <Link href={`/admin/projects/${project.id}/edit`}>
                            <button className="p-2 text-muted-foreground hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors inline-flex">
                              <Edit size={16} />
                            </button>
                          </Link>

                          <button
                            onClick={() => handleDelete(project.id, project.title)}
                            disabled={isDeleting}
                            className="p-2 text-destructive hover:text-white bg-destructive/10 hover:bg-destructive rounded-lg transition-colors inline-flex"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {projects.length === 0 && (
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
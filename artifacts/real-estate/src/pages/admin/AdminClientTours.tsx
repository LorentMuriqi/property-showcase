import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Plus, Pause, Play, RefreshCw, Trash2, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

type ClientTour = {
  id: string;
  title: string;
  client_name: string | null;
  status: "draft" | "active" | "paused" | "expired";
  client_token: string;
  expires_at: string | null;
  created_at: string;
};

function getComputedStatus(tour: ClientTour) {
  if (tour.status === "active" && tour.expires_at) {
    const expiresAt = new Date(tour.expires_at).getTime();
    if (Number.isFinite(expiresAt) && expiresAt < Date.now()) return "expired";
  }

  return tour.status;
}

export default function AdminClientTours() {
  const { isAdmin, permissions, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [tours, setTours] = useState<ClientTour[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!isAdmin) {
      setLocation("/admin/login");
      return;
    }

    if (!permissions.canManageVirtualTours) {
      setLocation("/admin");
    }
  }, [authLoading, isAdmin, permissions, setLocation]);

  const fetchTours = async () => {
    setIsLoading(true);

    const { data, error } = await supabase
      .from("virtual_tours")
      .select("id, title, client_name, status, client_token, expires_at, created_at")
      .eq("visibility", "client_only")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Gabim",
        description: "Nuk u ngarkuan virtual tours.",
        variant: "destructive",
      });
      setTours([]);
    } else {
      setTours((data || []) as ClientTour[]);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    if (!authLoading && isAdmin && permissions.canManageVirtualTours) {
      fetchTours();
    }
  }, [authLoading, isAdmin, permissions.canManageVirtualTours]);

  const createTour = async () => {
    const title = prompt("Emri i virtual tour-it, p.sh. Hotel Dukagjini");
    if (!title?.trim()) return;

    const clientName = prompt("Emri i klientit / kompanisë (opsionale)") || null;

    const { data, error } = await supabase
      .from("virtual_tours")
      .insert({
        title: title.trim(),
        client_name: clientName,
        status: "draft",
        visibility: "client_only",
      })
      .select("id")
      .single();

    if (error || !data) {
      toast({
        title: "Gabim",
        description: error?.message || "Virtual tour nuk u krijua.",
        variant: "destructive",
      });
      return;
    }

    setLocation(`/admin/client-tours/${data.id}/virtual-tour`);
  };

  const updateStatus = async (tour: ClientTour, status: ClientTour["status"]) => {
    const { error } = await supabase
      .from("virtual_tours")
      .update({
        status,
        paused_at: status === "paused" ? new Date().toISOString() : null,
        activated_at: status === "active" ? new Date().toISOString() : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tour.id);

    if (error) {
      toast({
        title: "Gabim",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    fetchTours();
  };

  const deleteTour = async (tour: ClientTour) => {
    if (!confirm(`A dëshironi ta fshini "${tour.title}"?`)) return;

    const { error } = await supabase.from("virtual_tours").delete().eq("id", tour.id);

    if (error) {
      toast({
        title: "Gabim",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    fetchTours();
  };

  const appOrigin = typeof window !== "undefined" ? window.location.origin : "";

  if (authLoading || isLoading) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border p-4 md:p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setLocation("/admin")}
            className="w-10 h-10 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-display text-2xl font-bold leading-none">
              Client Virtual Tours
            </h1>
            <p className="text-muted-foreground text-xs uppercase tracking-widest mt-1">
              Ture private për hotele, biznese dhe klientë
            </p>
          </div>
        </div>

        <button
          onClick={createTour}
          className="px-5 py-3 rounded-xl bg-primary text-black font-bold text-sm inline-flex items-center gap-2"
        >
          <Plus size={16} />
          Virtual Tour i Ri
        </button>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-8">
        <div className="glass-panel rounded-2xl border border-border overflow-hidden">
          <div className="p-6 border-b border-border">
            <h2 className="font-display text-xl">Lista e tureve private</h2>
          </div>

          <div className="divide-y divide-border">
            {tours.map((tour) => {
              const computedStatus = getComputedStatus(tour);
              const publicUrl = `${appOrigin}/client-tour/${tour.client_token}`;

              return (
                <div key={tour.id} className="p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-foreground">{tour.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {tour.client_name || "Pa klient"} ·{" "}
                      {tour.expires_at
                        ? `Skadon më ${new Date(tour.expires_at).toLocaleDateString("sq-AL")}`
                        : "Pa datë skadimi"}
                    </p>

                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className={`px-2 py-1 rounded-full text-xs border ${
                        computedStatus === "active"
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                          : computedStatus === "paused"
                          ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
                          : computedStatus === "expired"
                          ? "bg-red-500/10 text-red-400 border-red-500/30"
                          : "bg-muted text-muted-foreground border-border"
                      }`}>
                        {computedStatus}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link href={`/admin/client-tours/${tour.id}/virtual-tour`}>
                      <button className="px-4 py-2 rounded-xl bg-primary/10 text-primary font-semibold">
                        Edito Turin
                      </button>
                    </Link>

                    <a href={publicUrl} target="_blank" rel="noreferrer">
                      <button className="px-4 py-2 rounded-xl bg-muted text-foreground inline-flex items-center gap-2">
                        <ExternalLink size={14} />
                        Hap Linkun
                      </button>
                    </a>

                    {computedStatus !== "active" && (
                      <button
                        onClick={() => updateStatus(tour, "active")}
                        className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500"
                        title="Aktivizo"
                      >
                        <Play size={16} />
                      </button>
                    )}

                    {computedStatus === "active" && (
                      <button
                        onClick={() => updateStatus(tour, "paused")}
                        className="p-2 rounded-xl bg-yellow-500/10 text-yellow-500"
                        title="Pezullo"
                      >
                        <Pause size={16} />
                      </button>
                    )}

                    {computedStatus !== "draft" && (
                      <button
                        onClick={() => updateStatus(tour, "draft")}
                        className="p-2 rounded-xl bg-muted text-foreground"
                        title="Kthe në Draft"
                      >
                        <RefreshCw size={16} />
                      </button>
                    )}

                    <button
                      onClick={() => deleteTour(tour)}
                      className="p-2 rounded-xl bg-red-500/10 text-red-400"
                      title="Fshi"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}

            {tours.length === 0 && (
              <div className="p-10 text-center text-muted-foreground">
                Nuk ka client virtual tours ende.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  Plus,
  Pause,
  Play,
  RefreshCw,
  Trash2,
  ExternalLink,
  Search,
  X,
  Copy,
  Check,
} from "lucide-react";
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

function getStatusConfirmationMessage(
  tour: ClientTour,
  status: ClientTour["status"]
) {
  if (status === "active") {
    return `A dëshironi ta aktivizoni virtual tour-in "${tour.title}"?\n\nPas aktivizimit, linku publik do të jetë i qasshëm për klientin.`;
  }

  if (status === "paused") {
    return `A dëshironi ta pezulloni virtual tour-in "${tour.title}"?\n\nPas pezullimit, linku publik nuk do të jetë aktiv derisa ta aktivizoni përsëri.`;
  }

  if (status === "draft") {
    return `A dëshironi ta ktheni virtual tour-in "${tour.title}" në Draft?\n\nPas kthimit në Draft, turi nuk do të jetë aktiv për klientin.`;
  }

  return `A dëshironi ta ndryshoni statusin e virtual tour-it "${tour.title}"?`;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  active: {
    label: "Aktiv",
    className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
  },
  paused: {
    label: "Pezulluar",
    className: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
  },
  expired: {
    label: "Skaduar",
    className: "bg-red-500/10 text-red-400 border-red-500/30",
  },
  draft: {
    label: "Draft",
    className: "bg-muted text-muted-foreground border-border",
  },
};

export default function AdminClientTours() {
  const { isAdmin, permissions, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [tours, setTours] = useState<ClientTour[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Create tour modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ title: "", clientName: "" });
  const [isCreating, setIsCreating] = useState(false);

  // Copied state per-tour
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  const fetchTours = async (options?: { silent?: boolean; preserveScroll?: boolean }) => {
    const savedScrollY = options?.preserveScroll ? window.scrollY : null;

    if (!options?.silent) {
      setIsLoading(true);
    }

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

    if (savedScrollY !== null) {
      requestAnimationFrame(() => {
        window.scrollTo({
          top: savedScrollY,
          left: 0,
          behavior: "auto",
        });
      });
    }
  };

  useEffect(() => {
    if (!authLoading && isAdmin && permissions.canManageVirtualTours) {
      fetchTours();
    }
  }, [authLoading, isAdmin, permissions.canManageVirtualTours]);

  const openCreateModal = () => {
    setCreateForm({ title: "", clientName: "" });
    setShowCreateModal(true);
  };

  const handleCreateTour = async () => {
    if (!createForm.title.trim()) {
      toast({
        title: "Gabim",
        description: "Emri i virtual tour-it është i detyrueshëm.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);

    const { data, error } = await supabase
      .from("virtual_tours")
      .insert({
        title: createForm.title.trim(),
        client_name: createForm.clientName.trim() || null,
        status: "draft",
        visibility: "client_only",
      })
      .select("id")
      .single();

    setIsCreating(false);

    if (error || !data) {
      toast({
        title: "Gabim",
        description: error?.message || "Virtual tour nuk u krijua.",
        variant: "destructive",
      });
      return;
    }

    setShowCreateModal(false);
    setLocation(`/admin/client-tours/${data.id}/virtual-tour`);
  };

  const updateStatus = async (tour: ClientTour, status: ClientTour["status"]) => {
    const confirmed = window.confirm(getStatusConfirmationMessage(tour, status));

    if (!confirmed) return;

    const nowIso = new Date().toISOString();

    const payload: Partial<{
      status: ClientTour["status"];
      paused_at: string | null;
      activated_at: string | null;
      updated_at: string;
    }> = {
      status,
      updated_at: nowIso,
    };

    if (status === "paused") {
      payload.paused_at = nowIso;
    }

    if (status === "active") {
      payload.activated_at = nowIso;
      payload.paused_at = null;
    }

    if (status === "draft") {
      payload.paused_at = null;
    }

    const { error } = await supabase
      .from("virtual_tours")
      .update(payload)
      .eq("id", tour.id);

    if (error) {
      toast({
        title: "Gabim",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Sukses",
      description:
        status === "active"
          ? "Virtual tour u aktivizua."
          : status === "paused"
            ? "Virtual tour u pezullua."
            : "Virtual tour u kthye në Draft.",
    });

    fetchTours({ silent: true, preserveScroll: true });
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

    fetchTours({ silent: true, preserveScroll: true });
  };

  const copyLink = async (url: string, tourId: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(tourId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({ title: "Gabim", description: "Kopjimi dështoi.", variant: "destructive" });
    }
  };

  const filteredTours = tours.filter((tour) => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    if (!normalizedSearch) return true;

    const computedStatus = getComputedStatus(tour);

    return (
      String(tour.title || "").toLowerCase().includes(normalizedSearch) ||
      String(tour.client_name || "").toLowerCase().includes(normalizedSearch) ||
      String(computedStatus || "").toLowerCase().includes(normalizedSearch)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredTours.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const paginatedTours = filteredTours.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  const appOrigin = typeof window !== "undefined" ? window.location.origin : "";

  if (authLoading || isLoading) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border p-4 md:p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setLocation("/admin")}
            className="w-10 h-10 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
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
          onClick={openCreateModal}
          className="px-5 py-3 rounded-xl bg-primary text-black font-bold text-sm inline-flex items-center gap-2 hover:bg-white hover:text-foreground transition-colors"
        >
          <Plus size={16} />
          Virtual Tour i Ri
        </button>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-8">
        <div className="glass-panel rounded-2xl border border-border overflow-hidden">
          <div className="p-6 border-b border-border space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="font-display text-xl">Lista e tureve private</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {filteredTours.length}{" "}
                  {filteredTours.length === 1 ? "tur u gjet" : "ture u gjetën"}
                </p>
              </div>

              <div className="relative w-full md:w-80">
                <Search
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Kërko sipas emrit ose klientit..."
                  className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="divide-y divide-border">
            {paginatedTours.map((tour) => {
              const computedStatus = getComputedStatus(tour);
              const statusInfo = STATUS_LABELS[computedStatus] || STATUS_LABELS.draft;
              const publicUrl = `${appOrigin}/client-tour/${tour.client_token}`;

              return (
                <div key={tour.id} className="p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-semibold text-foreground">{tour.title}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs border ${statusInfo.className}`}>
                        {statusInfo.label}
                      </span>
                    </div>

                    <p className="text-sm text-muted-foreground mt-1">
                      {tour.client_name || "Pa klient"}
                      {tour.expires_at && (
                        <span className="ml-2 text-muted-foreground/60">
                          · Skadon {new Date(tour.expires_at).toLocaleDateString("sq-AL")}
                        </span>
                      )}
                    </p>

                    {/* Link preview for active tours */}
                    {computedStatus === "active" && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-muted-foreground/50 font-mono truncate max-w-[240px]">
                          {publicUrl}
                        </span>
                        <button
                          onClick={() => copyLink(publicUrl, tour.id)}
                          className="shrink-0 p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Kopjo linkun"
                        >
                          {copiedId === tour.id ? (
                            <Check size={13} className="text-emerald-500" />
                          ) : (
                            <Copy size={13} />
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Link href={`/admin/client-tours/${tour.id}/virtual-tour`}>
                      <button className="px-4 py-2 rounded-xl bg-primary/10 text-primary font-semibold text-sm hover:bg-primary/20 transition-colors">
                        Edito Turin
                      </button>
                    </Link>

                    <a href={publicUrl} target="_blank" rel="noreferrer">
                      <button className="px-4 py-2 rounded-xl bg-muted text-foreground inline-flex items-center gap-2 text-sm hover:bg-muted/80 transition-colors">
                        <ExternalLink size={14} />
                        Hap
                      </button>
                    </a>

                    {computedStatus !== "active" && (
                      <button
                        onClick={() => updateStatus(tour, "active")}
                        className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors"
                        title="Aktivizo"
                      >
                        <Play size={16} />
                      </button>
                    )}

                    {computedStatus === "active" && (
                      <button
                        onClick={() => updateStatus(tour, "paused")}
                        className="p-2 rounded-xl bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 transition-colors"
                        title="Pezullo"
                      >
                        <Pause size={16} />
                      </button>
                    )}

                    {computedStatus !== "draft" && (
                      <button
                        onClick={() => updateStatus(tour, "draft")}
                        className="p-2 rounded-xl bg-muted text-foreground hover:bg-muted/80 transition-colors"
                        title="Kthe në Draft"
                      >
                        <RefreshCw size={16} />
                      </button>
                    )}

                    <button
                      onClick={() => deleteTour(tour)}
                      className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                      title="Fshi"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredTours.length === 0 && (
              <div className="p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Plus size={28} className="text-muted-foreground" />
                </div>
                <p className="text-foreground font-medium mb-1">
                  {searchQuery.trim()
                    ? "Nuk u gjet asnjë virtual tour"
                    : "Nuk ka virtual tours ende"}
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchQuery.trim()
                    ? "Provo me terma të tjerë kërkimi"
                    : "Krijo virtual tourin e parë dhe dërgoja klientit linkun"}
                </p>
                {!searchQuery.trim() && (
                  <button
                    onClick={openCreateModal}
                    className="px-5 py-2.5 rounded-xl bg-primary text-black font-semibold text-sm"
                  >
                    Krijo Virtual Tour
                  </button>
                )}
              </div>
            )}
          </div>

          {filteredTours.length > pageSize && (
            <div className="p-5 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                Duke shfaqur {(safePage - 1) * pageSize + 1}–
                {Math.min(safePage * pageSize, filteredTours.length)} nga{" "}
                {filteredTours.length}
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={safePage === 1}
                  className="px-4 py-2 rounded-xl border border-border text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:border-primary transition-colors"
                >
                  Mbrapa
                </button>

                <span className="px-4 py-2 rounded-xl bg-muted text-sm text-foreground">
                  {safePage} / {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={safePage === totalPages}
                  className="px-4 py-2 rounded-xl border border-border text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:border-primary transition-colors"
                >
                  Para
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Create Tour Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreateModal(false);
          }}
        >
          <div className="w-full max-w-md bg-background border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div>
                <h2 className="font-display text-xl font-bold">Virtual Tour i Ri</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Krijo tur privat për klient
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-9 h-9 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-2 font-semibold">
                  Emri i Virtual Tour-it <span className="text-red-400">*</span>
                </label>
                <input
                  autoFocus
                  type="text"
                  value={createForm.title}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, title: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isCreating) handleCreateTour();
                  }}
                  placeholder="P.sh. Hotel Dukagjini, Vila Bardha..."
                  className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors text-sm"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-2 font-semibold">
                  Emri i Klientit / Kompanisë
                </label>
                <input
                  type="text"
                  value={createForm.clientName}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, clientName: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isCreating) handleCreateTour();
                  }}
                  placeholder="P.sh. Sokol Berisha, Grupi Dardania... (opsionale)"
                  className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors text-sm"
                />
              </div>

              <div className="rounded-xl bg-primary/5 border border-primary/15 p-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Pas krijimit, do të ridrejtoheni automatikisht te editimi i turit ku mund të shtoni skenat 360° dhe hotspot-et.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-6 pt-0">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-3 rounded-xl bg-muted text-foreground font-semibold text-sm hover:bg-muted/80 transition-colors"
              >
                Anulo
              </button>
              <button
                onClick={handleCreateTour}
                disabled={isCreating || !createForm.title.trim()}
                className="flex-1 py-3 rounded-xl bg-primary text-black font-bold text-sm hover:bg-white hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {isCreating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Duke krijuar...
                  </>
                ) : (
                  "Krijo & Edito"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

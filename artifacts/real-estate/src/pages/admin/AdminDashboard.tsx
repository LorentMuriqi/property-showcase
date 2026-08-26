import { useEffect, useMemo, useRef, useState } from "react";
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
  Menu,
  X,
  Users,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

type AdminListingStatus = "active" | "paused" | "expired";
type VirtualTourStatusFilter = "published" | "draft";
type SortMode = "default" | "expiry_asc" | "expiry_desc";

type PropertyFilterOption = {
  country: string | null;
  city: string | null;
};

const PAGE_SIZE = 20;

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
  const [totalProjects, setTotalProjects] = useState(0);
  const [page, setPage] = useState(1);
  const [filterOptions, setFilterOptions] = useState<PropertyFilterOption[]>([]);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const fetchRequestIdRef = useRef(0);
  
  const [sortMode] = useState<SortMode>("default");
  const [statusFilters, setStatusFilters] = useState<AdminListingStatus[]>([]);
  const [virtualTourFilters, setVirtualTourFilters] = useState<VirtualTourStatusFilter[]>([]);
  const [showFilter, setShowFilter] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
const [cityFilter, setCityFilter] = useState("");
const [countryFilter, setCountryFilter] = useState("");
const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!isAdmin) {
      setLocation("/admin/login");
      return;
    }

    if (!permissions.canViewProperties) {
      setLocation(
        permissions.canViewClientVirtualTours ? "/admin/client-tours" : "/",
      );
    }
  }, [authLoading, isAdmin, permissions, setLocation]);
  
  useEffect(() => {
  if (!mobileMenuOpen) return;

  const previousOverflow = document.body.style.overflow;

  // Mos lejo scroll të faqes prapa drawer-it.
  document.body.style.overflow = "hidden";

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      setMobileMenuOpen(false);
    }
  };

  window.addEventListener("keydown", handleKeyDown);

  return () => {
    document.body.style.overflow = previousOverflow;
    window.removeEventListener("keydown", handleKeyDown);
  };
}, [mobileMenuOpen]);

const fetchPropertyFilterOptions = async () => {
  if (authLoading || !isAdmin || !permissions.canViewProperties) return;

  const { data, error } = await supabase.rpc("admin_property_filter_options");

  if (error) {
    console.error("Admin property filter options error:", error);
    setFilterOptions([]);
    return;
  }

  setFilterOptions((data || []) as PropertyFilterOption[]);
};

const fetchProjects = async (options?: { silent?: boolean; preserveScroll?: boolean }) => {
  if (authLoading || !isAdmin || !permissions.canViewProperties) return;

  const requestId = ++fetchRequestIdRef.current;
  const savedScrollY = options?.preserveScroll ? window.scrollY : null;

  if (!options?.silent) {
    setIsLoading(true);
  }

  const { data, error } = await supabase.rpc("admin_properties_page", {
    p_search: debouncedSearch || null,
    p_country: countryFilter || null,
    p_city: cityFilter || null,
    p_status_filters: statusFilters,
    p_virtual_tour_filters: virtualTourFilters,
    p_sort_mode: sortMode,
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
  });

  if (requestId !== fetchRequestIdRef.current) return;

  if (error) {
    console.error("Admin fetch error:", error);
    toast({
      title: "Gabim",
      description: "Nuk u ngarkuan pronat.",
      variant: "destructive",
    });
    setProjects([]);
    setTotalProjects(0);
    setIsLoading(false);
    return;
  }

  const payload = (data || {}) as {
    items?: any[];
    total_count?: number | string;
  };

  const nextProjects = Array.isArray(payload.items) ? payload.items : [];
  const nextTotal = Math.max(0, Number(payload.total_count || 0));
  const nextTotalPages = Math.max(1, Math.ceil(nextTotal / PAGE_SIZE));

  if (page > nextTotalPages) {
    setPage(nextTotalPages);
    setIsLoading(false);
    return;
  }

  setProjects(nextProjects);
  setTotalProjects(nextTotal);
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
  const timeoutId = window.setTimeout(() => {
    setDebouncedSearch(searchQuery.trim());
  }, 300);

  return () => window.clearTimeout(timeoutId);
}, [searchQuery]);

useEffect(() => {
  setPage(1);
}, [
  debouncedSearch,
  cityFilter,
  countryFilter,
  sortMode,
  statusFilters,
  virtualTourFilters,
]);

useEffect(() => {
  if (!authLoading && isAdmin && permissions.canViewProperties) {
    void fetchPropertyFilterOptions();
  }
}, [authLoading, isAdmin, permissions.canViewProperties]);

useEffect(() => {
  if (!authLoading && isAdmin && permissions.canViewProperties) {
    void fetchProjects({ silent: true });
  }
}, [
  authLoading,
  isAdmin,
  permissions.canViewProperties,
  permissions.canEditProperty,
  page,
  debouncedSearch,
  countryFilter,
  cityFilter,
  sortMode,
  statusFilters,
  virtualTourFilters,
]);

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

      // virtual_tour_scenes and virtual_tour_hotspots are removed by the
      // existing ON DELETE CASCADE foreign keys. This keeps property deletion
      // independent from the separate virtual-tour management permission.
      const { error: propertyDeleteError } = await supabase
        .from("properties")
        .delete()
        .eq("id", id);

      if (propertyDeleteError) throw propertyDeleteError;

      await fetchProjects({ silent: true, preserveScroll: true });
      void fetchPropertyFilterOptions();

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

      await fetchProjects({ silent: true, preserveScroll: true });
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

      await fetchProjects({ silent: true, preserveScroll: true });
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

      await fetchProjects({ silent: true, preserveScroll: true });
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
    new Set(
      filterOptions
        .map((option) => option.country)
        .filter((value): value is string => !!value),
    ),
  ).sort((a, b) => a.localeCompare(b, "sq"));
}, [filterOptions]);

const cities = useMemo(() => {
  return Array.from(
    new Set(
      filterOptions
        .filter((option) => !countryFilter || option.country === countryFilter)
        .map((option) => option.city)
        .filter((value): value is string => !!value),
    ),
  ).sort((a, b) => a.localeCompare(b, "sq"));
}, [filterOptions, countryFilter]);

const totalPages = Math.max(1, Math.ceil(totalProjects / PAGE_SIZE));
const safePage = Math.min(page, totalPages);

  if (authLoading) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!isAdmin || !permissions.canViewProperties) return null;

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
          {permissions.canViewProperties && (
            <Link
              href="/admin"
              className="flex items-center gap-3 px-4 py-3 bg-primary/10 text-primary rounded-xl font-medium"
            >
              <Home size={18} /> Properties
            </Link>
          )}
		  
		  {permissions.canViewClientVirtualTours && (
  <Link
    href="/admin/client-tours"
    className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl font-medium transition-colors"
  >
    <Focus size={18} /> Client Virtual Tours
  </Link>
)}

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

{/* Mobile admin navigation */}
<div
  className={`md:hidden fixed inset-0 z-[100] transition-[visibility] duration-300 ${
    mobileMenuOpen
      ? "visible"
      : "invisible pointer-events-none"
  }`}
  aria-hidden={!mobileMenuOpen}
>
  {/* Backdrop */}
  <button
    type="button"
    aria-label="Mbyll menynë"
    onClick={() => setMobileMenuOpen(false)}
    className={`absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ${
      mobileMenuOpen ? "opacity-100" : "opacity-0"
    }`}
  />

  {/* Drawer */}
  <aside
    id="admin-mobile-navigation"
    role="dialog"
    aria-modal="true"
    aria-label="Menuja e administratorit"
    className={`absolute right-0 top-0 z-10 flex h-[100dvh] w-[min(88vw,360px)] flex-col bg-background border-l border-border shadow-[-24px_0_70px_rgba(15,23,42,0.18)] transform-gpu transition-transform duration-300 ease-out ${
      mobileMenuOpen
        ? "translate-x-0"
        : "translate-x-full"
    }`}
  >
    {/* Drawer header */}
    <div
      className="shrink-0 border-b border-border px-5 pb-5"
      style={{
        paddingTop: "max(1.25rem, env(safe-area-inset-top))",
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-display text-xl font-bold tracking-tight text-foreground">
              AURA
            </span>

            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
              Admin
            </span>
          </div>

          <p className="mt-1 text-xs text-muted-foreground">
            Paneli administrativ
          </p>
        </div>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Mbyll menynë"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40 text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground active:scale-95"
        >
          <X size={20} />
        </button>
      </div>
    </div>

    {/* Navigation */}
    <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5">
      <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">
        Navigimi
      </p>

      <nav className="space-y-1.5">
        {/* Properties */}
        {permissions.canViewProperties && (
          <Link
            href="/admin"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3.5 rounded-xl bg-primary/10 px-3.5 py-3.5 text-primary transition-colors"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Home size={18} />
            </span>

            <div className="min-w-0">
              <span className="block text-sm font-semibold">
                Properties
              </span>
              <span className="block truncate text-[11px] text-primary/70">
                Menaxho portofolin e pronave
              </span>
            </div>
          </Link>
        )}

        {/* Client Virtual Tours */}
        {permissions.canViewClientVirtualTours && (
          <Link
            href="/admin/client-tours"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3.5 rounded-xl px-3.5 py-3.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Focus size={18} />
            </span>

            <div className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">
                Client Virtual Tours
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                Menaxho turet private të klientëve
              </span>
            </div>
          </Link>
        )}

        {/* Super Admin only */}
        {isSuperAdmin && (
          <>
            <Link
              href="/admin/users"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3.5 rounded-xl px-3.5 py-3.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Users size={18} />
              </span>

              <div className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">
                  Users
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  Përdoruesit dhe qasja në panel
                </span>
              </div>
            </Link>

            <Link
              href="/admin/rules"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3.5 rounded-xl px-3.5 py-3.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <ShieldCheck size={18} />
              </span>

              <div className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">
                  Rules
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  Rolet dhe lejet administrative
                </span>
              </div>
            </Link>
          </>
        )}

        <div className="my-3 border-t border-border" />

        {/* Public website */}
        <Link
          href="/"
          onClick={() => setMobileMenuOpen(false)}
          className="flex items-center gap-3.5 rounded-xl px-3.5 py-3.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <ExternalLink size={18} />
          </span>

          <div className="min-w-0">
            <span className="block text-sm font-semibold text-foreground">
              Shiko Faqen
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">
              Kthehu në faqen publike
            </span>
          </div>
        </Link>
      </nav>
    </div>

    {/* Bottom logout */}
    <div
      className="shrink-0 border-t border-border bg-background/95 px-4 pt-4"
      style={{
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
    >
      <button
        type="button"
        onClick={async () => {
          setMobileMenuOpen(false);
          await logout();
        }}
        className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive hover:text-white active:scale-[0.99]"
      >
        <LogOut size={18} />
        Dalje nga paneli
      </button>
    </div>
  </aside>
</div>

      <main className="flex-1 min-w-0 p-4 md:p-8 overflow-y-auto">
<div className="md:hidden sticky top-3 z-40 mb-6">
  <div className="glass-panel border border-border/80 bg-background/95 backdrop-blur-xl rounded-2xl px-4 py-3.5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] flex items-center justify-between">
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <span className="font-display text-xl font-bold tracking-tight text-foreground">
          AURA
        </span>

        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Admin
        </span>
      </div>

      <p className="text-[11px] text-muted-foreground mt-0.5">
        Paneli administrativ
      </p>
    </div>

    <button
      type="button"
      onClick={() => setMobileMenuOpen(true)}
      aria-label="Hap menynë e administratorit"
      aria-expanded={mobileMenuOpen}
      aria-controls="admin-mobile-navigation"
      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-foreground shadow-sm transition-all active:scale-95 hover:border-primary/50 hover:text-primary"
    >
      <Menu size={22} strokeWidth={2} />
    </button>
  </div>
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
      placeholder="Kërko pronë, qytet, shtet ose Project ID..."
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
                  {projects.map((project) => {
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
                            <div className="min-w-0">
                              {project.project_reference && (
                                <span className="mb-1 inline-flex rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-[0.08em] text-primary">
                                  {project.project_reference}
                                </span>
                              )}
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

                          {permissions.canManagePropertyVirtualTours && (
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

            {totalProjects > PAGE_SIZE && (
              <div className="p-5 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  Duke shfaqur {(safePage - 1) * PAGE_SIZE + 1}-{Math.min(safePage * PAGE_SIZE, totalProjects)} nga {totalProjects}
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
        )}
      </main>
    </div>
  );
}
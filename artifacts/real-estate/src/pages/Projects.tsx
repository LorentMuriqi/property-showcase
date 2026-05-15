import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Filter, X, Search, ChevronDown, SlidersHorizontal } from "lucide-react";
import { Layout } from "@/components/Layout";
import { ProjectCard } from "@/components/ProjectCard";
import { supabase } from "@/lib/supabase";

// ─── Session storage keys (të njëjtat si më parë) ───────────────────────────
const PROJECTS_SCROLL_Y_KEY = "projects-scroll-y";
const PROJECTS_RETURN_URL_KEY = "projects-return-url";
const PROJECTS_RESTORE_SCROLL_KEY = "projects-restore-scroll";
const PROJECTS_ACTIVE_CARD_ID_KEY = "projects-active-card-id";
const PROJECTS_ACTIVE_CARD_TOP_KEY = "projects-active-card-top";

const clearProjectsRestoreState = () => {
  sessionStorage.removeItem(PROJECTS_SCROLL_Y_KEY);
  sessionStorage.removeItem(PROJECTS_RETURN_URL_KEY);
  sessionStorage.removeItem(PROJECTS_RESTORE_SCROLL_KEY);
  sessionStorage.removeItem(PROJECTS_ACTIVE_CARD_ID_KEY);
  sessionStorage.removeItem(PROJECTS_ACTIVE_CARD_TOP_KEY);
};

// ─── Llojet e pronave ────────────────────────────────────────────────────────
const PROPERTY_TYPES: { value: string; label: string }[] = [
  { value: "apartment", label: "Apartament" },
  { value: "house", label: "Shtëpi" },
  { value: "villa", label: "Vilë" },
  { value: "land", label: "Tokë" },
  { value: "commercial", label: "Komerciale" },
  { value: "office", label: "Zyrë" },
  { value: "garage", label: "Garazh" },
  { value: "warehouse", label: "Depo" },
];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "for_sale", label: "Në Shitje" },
  { value: "for_rent", label: "Me Qira" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatPrice = (val: number, currency = "EUR") => {
  if (val >= 1_000_000)
    return `${(val / 1_000_000).toFixed(val % 1_000_000 === 0 ? 0 : 1)}M ${currency}`;
  if (val >= 1_000) return `${Math.round(val / 1_000)}K ${currency}`;
  return `${val} ${currency}`;
};

// ─── Range Slider ─────────────────────────────────────────────────────────────
interface RangeSliderProps {
  min: number;
  max: number;
  value: [number, number];
  onChange: (v: [number, number]) => void;
  formatLabel: (v: number) => string;
  step?: number;
}

function RangeSlider({ min, max, value, onChange, formatLabel, step = 1 }: RangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [low, high] = value;

  const pct = (v: number) => ((v - min) / (max - min)) * 100;

  const handleLow = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Math.min(Number(e.target.value), high - step);
    onChange([v, high]);
  };
  const handleHigh = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Math.max(Number(e.target.value), low + step);
    onChange([low, v]);
  };

  return (
    <div className="px-1 pt-2 pb-1">
      {/* Track */}
      <div ref={trackRef} className="relative h-1.5 bg-border rounded-full mb-5">
        <div
          className="absolute h-full bg-primary rounded-full"
          style={{ left: `${pct(low)}%`, right: `${100 - pct(high)}%` }}
        />
        {/* Low thumb */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={low}
          onChange={handleLow}
          className="range-thumb absolute inset-0 w-full opacity-0 cursor-pointer h-full"
          style={{ zIndex: low > max - (max - min) * 0.1 ? 5 : 3 }}
        />
        {/* High thumb */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={high}
          onChange={handleHigh}
          className="range-thumb absolute inset-0 w-full opacity-0 cursor-pointer h-full"
          style={{ zIndex: 4 }}
        />
        {/* Visual thumbs */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-2 border-primary shadow-md pointer-events-none"
          style={{ left: `${pct(low)}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-2 border-primary shadow-md pointer-events-none"
          style={{ left: `${pct(high)}%` }}
        />
      </div>

      {/* Labels */}
      <div className="flex justify-between text-xs font-semibold text-foreground">
        <span>{formatLabel(low)}</span>
        <span>{formatLabel(high)}</span>
      </div>
    </div>
  );
}

// ─── Accordion section helper ──────────────────────────────────────────────
function FilterSection({
  title,
  children,
  defaultOpen = true,
  badge,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border last:border-0 pb-5 last:pb-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between py-1 mb-3 group"
        type="button"
      >
        <span className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">
          {title}
          {!!badge && (
            <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
              {badge}
            </span>
          )}
        </span>
        <ChevronDown
          size={16}
          className={`text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

// ─── Active filter chip ───────────────────────────────────────────────────
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 border border-primary/20 text-primary rounded-full text-xs font-semibold">
      {label}
      <button
        onClick={onRemove}
        className="ml-0.5 hover:text-foreground transition-colors"
        type="button"
      >
        <X size={12} />
      </button>
    </span>
  );
}

// ─── Constants for sliders ────────────────────────────────────────────────
const PRICE_MIN = 0;
const PRICE_MAX = 2_000_000;
const PRICE_STEP = 5_000;
const AREA_MIN = 0;
const AREA_MAX = 1_000;
const AREA_STEP = 5;

// ═══════════════════════════════════════════════════════════════════════════
export default function Projects() {
  const searchParams = new URLSearchParams(window.location.search);

  // ── Server-side filters (Supabase query) ──────────────────────────────
  const [country, setCountry] = useState(searchParams.get("country") || "");
  const [city, setCity] = useState(searchParams.get("city") || "");
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");
  const [propertyType, setPropertyType] = useState(searchParams.get("type") || "");

type SortOption = "newest" | "oldest" | "price_asc" | "price_desc" | "area_asc" | "area_desc";
const [sortBy, setSortBy] = useState<SortOption>("newest");

  // ── Client-side filters (applied after fetch) ─────────────────────────
  const [priceRange, setPriceRange] = useState<[number, number]>([PRICE_MIN, PRICE_MAX]);
  const [areaRange, setAreaRange] = useState<[number, number]>([AREA_MIN, AREA_MAX]);
  const [bedroomsMin, setBedroomsMin] = useState<number | null>(null);
  const [bathroomsMin, setBathroomsMin] = useState<number | null>(null);

  // ── UI state ──────────────────────────────────────────────────────────
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(Math.max(1, Number(searchParams.get("page") || "1") || 1));

  // ── Data state ────────────────────────────────────────────────────────
  const [projects, setProjects] = useState<any[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const pageTopRef = useRef<HTMLDivElement | null>(null);
  const shouldRestoreScrollRef = useRef(false);
  const shouldScrollToTopRef = useRef(false);
  const didInitRef = useRef(false);

  const pageSize = 8;

  // ── Derived: active filter count (for badge on mobile button) ─────────
  const activeServerFilters = [country, city, search, statusFilter, propertyType].filter(Boolean).length;
  const activeClientFilters = [
    priceRange[0] > PRICE_MIN || priceRange[1] < PRICE_MAX,
    areaRange[0] > AREA_MIN || areaRange[1] < AREA_MAX,
    bedroomsMin !== null,
    bathroomsMin !== null,
  ].filter(Boolean).length;
  const totalActiveFilters = activeServerFilters + activeClientFilters;

  // ── URL sync ──────────────────────────────────────────────────────────
  const buildProjectsUrl = useCallback(
    (pg: number, co: string, ci: string, se: string, st: string, ty: string) => {
      const params = new URLSearchParams();
      if (co) params.set("country", co);
      if (ci) params.set("city", ci);
      if (se) params.set("search", se);
      if (st) params.set("status", st);
      if (ty) params.set("type", ty);
      if (pg > 1) params.set("page", String(pg));
      return `/projects${params.toString() ? `?${params.toString()}` : ""}`;
    },
    []
  );

  const currentProjectsUrl = buildProjectsUrl(page, country, city, search, statusFilter, propertyType);

  useEffect(() => {
    window.history.replaceState({}, "", currentProjectsUrl);
  }, [currentProjectsUrl]);

  // ── Scroll helpers (identike me origjinalin) ──────────────────────────
  const scrollToProjectsTop = (behavior: ScrollBehavior = "auto") => {
    const top = pageTopRef.current
      ? pageTopRef.current.getBoundingClientRect().top + window.scrollY
      : 0;
    window.scrollTo({ top, left: 0, behavior });
  };

  const restoreProjectsPosition = () => {
    const savedUrl = sessionStorage.getItem(PROJECTS_RETURN_URL_KEY);
    const savedScrollY = Number(sessionStorage.getItem(PROJECTS_SCROLL_Y_KEY) || "0");
    const savedCardId = sessionStorage.getItem(PROJECTS_ACTIVE_CARD_ID_KEY);
    const savedCardTop = Number(sessionStorage.getItem(PROJECTS_ACTIVE_CARD_TOP_KEY) || "0");

    if (savedUrl !== currentProjectsUrl) {
      shouldRestoreScrollRef.current = false;
      clearProjectsRestoreState();
      return;
    }

    const applyRestore = () => {
      if (savedCardId) {
        const cardEl = document.getElementById(`project-card-${savedCardId}`);
        if (cardEl) {
          const absoluteTop = cardEl.getBoundingClientRect().top + window.scrollY;
          window.scrollTo({ top: Math.max(0, absoluteTop - savedCardTop), left: 0, behavior: "auto" });
          return;
        }
      }
      window.scrollTo({ top: savedScrollY, left: 0, behavior: "auto" });
    };

    requestAnimationFrame(() => {
      applyRestore();
      setTimeout(() => {
        applyRestore();
        shouldRestoreScrollRef.current = false;
        sessionStorage.removeItem(PROJECTS_RESTORE_SCROLL_KEY);
      }, 150);
    });
  };

  const saveProjectsState = (projectId?: string | number) => {
    sessionStorage.setItem(PROJECTS_SCROLL_Y_KEY, String(window.scrollY));
    sessionStorage.setItem(PROJECTS_RETURN_URL_KEY, currentProjectsUrl);
    if (projectId !== undefined && projectId !== null) {
      sessionStorage.setItem(PROJECTS_RESTORE_SCROLL_KEY, "1");
      sessionStorage.setItem(PROJECTS_ACTIVE_CARD_ID_KEY, String(projectId));
      const cardEl = document.getElementById(`project-card-${projectId}`);
      if (cardEl) {
        sessionStorage.setItem(PROJECTS_ACTIVE_CARD_TOP_KEY, String(cardEl.getBoundingClientRect().top));
      }
    }
  };

  const changePage = (nextPage: number) => {
    if (nextPage === page) return;
    shouldScrollToTopRef.current = true;
    setPage(nextPage);
  };

  // ── Init scroll restore ───────────────────────────────────────────────
  useEffect(() => {
    const shouldRestore = sessionStorage.getItem(PROJECTS_RESTORE_SCROLL_KEY) === "1";
    const savedUrl = sessionStorage.getItem(PROJECTS_RETURN_URL_KEY);
    const canRestore = shouldRestore && savedUrl === currentProjectsUrl;
    shouldRestoreScrollRef.current = canRestore;
    shouldScrollToTopRef.current = !canRestore;
    if (!canRestore) clearProjectsRestoreState();
  }, []);

  // ── Reset page on server-filter change ────────────────────────────────
  useEffect(() => {
useEffect(() => {
  if (!didInitRef.current) return;
  shouldScrollToTopRef.current = true;
  setPage(1);
}, [country, city, search, statusFilter, propertyType, sortBy]);

  // ── Save scroll on scroll ─────────────────────────────────────────────
  useEffect(() => {
    const saveScrollState = () => {
      sessionStorage.setItem(PROJECTS_SCROLL_Y_KEY, String(window.scrollY));
      sessionStorage.setItem(PROJECTS_RETURN_URL_KEY, currentProjectsUrl);
    };
    saveScrollState();
    window.addEventListener("scroll", saveScrollState, { passive: true });
    return () => window.removeEventListener("scroll", saveScrollState);
  }, [currentProjectsUrl]);

  // ── Fetch projects from Supabase (server-side filters) ────────────────
  useEffect(() => {
    const fetchProjects = async () => {
      setIsLoading(true);

      const nowIso = new Date().toISOString();
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from("properties")
        .select("*", { count: "exact" })
        .eq("listing_status", "active")
        .eq("is_paused", false)
        .or(`expires_at.is.null,expires_at.gte.${nowIso}`);

      if (country) query = query.eq("country", country);
      if (city) query = query.eq("city", city);
      if (statusFilter) query = query.eq("status", statusFilter);
      if (propertyType) query = query.eq("property_type", propertyType);

      if (search.trim()) {
        const safeSearch = search.trim().replace(/,/g, " ");
        query = query.or(
          `title.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%,location.ilike.%${safeSearch}%`
        );
      }

// Sort server-side vetëm për created_at — çmimi/m² bëhen client-side
const serverOrder =
  sortBy === "oldest"
    ? { column: "created_at", ascending: true }
    : { column: "created_at", ascending: false }; // default: newest

const { data, error, count } = await query
  .order(serverOrder.column, { ascending: serverOrder.ascending })
  .range(from, to);

      if (error) {
        console.error("Supabase fetch error:", error);
        setProjects([]);
        setTotalCount(0);
      } else {
        const rows = data || [];
        const propertyIds = rows.map((item) => item.id);

        let scenePropertyIds = new Set<string>();
        if (propertyIds.length > 0) {
          const { data: sceneRows, error: sceneError } = await supabase
            .from("virtual_tour_scenes")
            .select("property_id")
            .in("property_id", propertyIds);

          if (!sceneError) {
            scenePropertyIds = new Set(
              (sceneRows || []).map((scene) => String(scene.property_id))
            );
          }
        }

        const rowsWithVirtualTour = rows.map((item) => {
          const hasFallbackVirtualTour = !!(
            item.virtual_tour_url ||
            item.virtual_tour_embed_code ||
            item.has_custom_virtual_tour
          );
          const hasPublishedBuiltInVirtualTour =
            item.virtual_tour_status === "published" &&
            scenePropertyIds.has(String(item.id));
          return {
            ...item,
            hasVirtualTour: hasFallbackVirtualTour || hasPublishedBuiltInVirtualTour,
          };
        });

        setProjects(rowsWithVirtualTour);
        setTotalCount(count || 0);
      }

      setIsLoading(false);

      requestAnimationFrame(() => {
        if (shouldRestoreScrollRef.current) {
          restoreProjectsPosition();
        } else if (shouldScrollToTopRef.current) {
          scrollToProjectsTop(didInitRef.current ? "smooth" : "auto");
          shouldScrollToTopRef.current = false;
        }
        didInitRef.current = true;
      });
    };

    fetchProjects();
  }, [country, city, search, statusFilter, propertyType, sortBy, page]);

  // ── Fetch filter options ──────────────────────────────────────────────
  useEffect(() => {
    const fetchFilters = async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("properties")
        .select("country, city")
        .eq("listing_status", "active")
        .eq("is_paused", false)
        .or(`expires_at.is.null,expires_at.gte.${nowIso}`);

      if (error) return;

      const allCountries = [
        ...new Set((data || []).map((item) => item.country).filter(Boolean)),
      ] as string[];
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

const filteredProjects = useMemo(() => {
  const filtered = projects.filter((p) => {
    const price = p.price ?? null;
    const area = p.area_m2 ?? p.areaM2 ?? null;
    const beds = p.bedrooms ?? null;
    const baths = p.bathrooms ?? null;

    if (price !== null) {
      if (price < priceRange[0] || price > priceRange[1]) return false;
    }
    if (area !== null) {
      if (area < areaRange[0] || area > areaRange[1]) return false;
    }
    if (bedroomsMin !== null && (beds === null || beds < bedroomsMin)) return false;
    if (bathroomsMin !== null && (baths === null || baths < bathroomsMin)) return false;

    return true;
  });

  // Sort client-side për çmim dhe m²
  return [...filtered].sort((a, b) => {
    switch (sortBy) {
      case "price_asc":
        return (a.price ?? Infinity) - (b.price ?? Infinity);
      case "price_desc":
        return (b.price ?? -Infinity) - (a.price ?? -Infinity);
      case "area_asc":
        return ((a.area_m2 ?? a.areaM2) ?? Infinity) - ((b.area_m2 ?? b.areaM2) ?? Infinity);
      case "area_desc":
        return ((b.area_m2 ?? b.areaM2) ?? -Infinity) - ((a.area_m2 ?? a.areaM2) ?? -Infinity);
      default:
        return 0; // newest/oldest — tashmë e bën Supabase
    }
  });
}, [projects, priceRange, areaRange, bedroomsMin, bathroomsMin, sortBy]);

  // ── Clear all ─────────────────────────────────────────────────────────
  const clearAllFilters = () => {
    shouldScrollToTopRef.current = true;
    setCountry("");
    setCity("");
    setSearch("");
    setStatusFilter("");
    setPropertyType("");
    setPriceRange([PRICE_MIN, PRICE_MAX]);
    setAreaRange([AREA_MIN, AREA_MAX]);
    setBedroomsMin(null);
    setBathroomsMin(null);
  };

  // ── Pagination ────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const getVisiblePages = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }
    pages.push(1);
    if (page > 3) pages.push("...");
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  };

  // ── Active chips data ─────────────────────────────────────────────────
  const activeChips: { label: string; onRemove: () => void }[] = [
    ...(search ? [{ label: `"${search}"`, onRemove: () => setSearch("") }] : []),
    ...(country ? [{ label: country, onRemove: () => { setCountry(""); setCity(""); } }] : []),
    ...(city ? [{ label: city, onRemove: () => setCity("") }] : []),
    ...(statusFilter
      ? [{ label: STATUS_OPTIONS.find((s) => s.value === statusFilter)?.label || statusFilter, onRemove: () => setStatusFilter("") }]
      : []),
    ...(propertyType
      ? [{ label: PROPERTY_TYPES.find((t) => t.value === propertyType)?.label || propertyType, onRemove: () => setPropertyType("") }]
      : []),
    ...(priceRange[0] > PRICE_MIN || priceRange[1] < PRICE_MAX
      ? [{
          label: `${formatPrice(priceRange[0])} – ${formatPrice(priceRange[1])}`,
          onRemove: () => setPriceRange([PRICE_MIN, PRICE_MAX]),
        }]
      : []),
    ...(areaRange[0] > AREA_MIN || areaRange[1] < AREA_MAX
      ? [{
          label: `${areaRange[0]}–${areaRange[1]} m²`,
          onRemove: () => setAreaRange([AREA_MIN, AREA_MAX]),
        }]
      : []),
    ...(bedroomsMin !== null
      ? [{ label: `${bedroomsMin}+ dhoma gjumi`, onRemove: () => setBedroomsMin(null) }]
      : []),
    ...(bathroomsMin !== null
      ? [{ label: `${bathroomsMin}+ banjo`, onRemove: () => setBathroomsMin(null) }]
      : []),
  ];

  // ── Bedroom / bathroom quick-select buttons ───────────────────────────
  const RoomButtons = ({
    value,
    onChange,
  }: {
    value: number | null;
    onChange: (v: number | null) => void;
  }) => (
    <div className="flex gap-2 flex-wrap">
      {[null, 1, 2, 3, 4, 5].map((n) => (
        <button
          key={n ?? "any"}
          type="button"
          onClick={() => onChange(value === n ? null : n)}
          className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
            value === n
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
          }`}
        >
          {n === null ? "Të gjitha" : n === 5 ? "5+" : String(n)}
        </button>
      ))}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────

  const FilterPanel = (
    <div className="glass-panel p-6 rounded-2xl sticky top-24 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl text-foreground flex items-center gap-2">
          <SlidersHorizontal size={18} className="text-primary" />
          Filtrat
        </h3>
        {totalActiveFilters > 0 && (
          <button
            onClick={clearAllFilters}
            className="text-xs text-primary hover:text-foreground flex items-center gap-1 font-medium transition-colors"
            type="button"
          >
            <X size={13} /> Pastro të gjitha
          </button>
        )}
      </div>

      {/* Search */}
      <FilterSection title="Kërko">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Fjalë kyçe, adresë..."
            className="w-full bg-background border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
            value={search}
            onChange={(e) => {
              shouldScrollToTopRef.current = true;
              setSearch(e.target.value);
            }}
          />
        </div>
      </FilterSection>

      {/* Lloji i transaksionit */}
      <FilterSection title="Lloji i Transaksionit" badge={statusFilter ? 1 : 0}>
        <div className="flex gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                shouldScrollToTopRef.current = true;
                setStatusFilter(statusFilter === opt.value ? "" : opt.value);
              }}
              className={`flex-1 py-2 rounded-xl border text-sm font-semibold transition-all ${
                statusFilter === opt.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Lloji i pronës */}
      <FilterSection title="Lloji i Pronës" badge={propertyType ? 1 : 0}>
        <div className="grid grid-cols-2 gap-2">
          {PROPERTY_TYPES.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                shouldScrollToTopRef.current = true;
                setPropertyType(propertyType === opt.value ? "" : opt.value);
              }}
              className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all text-left ${
                propertyType === opt.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Shteti / Qyteti */}
      <FilterSection title="Vendndodhja" badge={(country ? 1 : 0) + (city ? 1 : 0)}>
        <div className="space-y-3">
          <select
            className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary appearance-none cursor-pointer transition-colors"
            value={country}
            onChange={(e) => {
              shouldScrollToTopRef.current = true;
              setCountry(e.target.value);
              setCity("");
            }}
          >
            <option value="">Të gjitha shtetet</option>
            {countries.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            className={`w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary appearance-none cursor-pointer transition-colors ${
              !country ? "opacity-50" : ""
            }`}
            value={city}
            onChange={(e) => {
              shouldScrollToTopRef.current = true;
              setCity(e.target.value);
            }}
            disabled={!country}
          >
            <option value="">Të gjitha qytetet</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </FilterSection>

      {/* Çmimi */}
      <FilterSection
        title="Çmimi"
        badge={priceRange[0] > PRICE_MIN || priceRange[1] < PRICE_MAX ? 1 : 0}
      >
        <RangeSlider
          min={PRICE_MIN}
          max={PRICE_MAX}
          step={PRICE_STEP}
          value={priceRange}
          onChange={setPriceRange}
          formatLabel={(v) => formatPrice(v, "EUR")}
        />
        {/* Input numerik manual */}
        <div className="flex gap-2 mt-3">
          <div className="flex-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Nga</label>
            <input
              type="number"
              min={PRICE_MIN}
              max={priceRange[1] - PRICE_STEP}
              step={PRICE_STEP}
              value={priceRange[0]}
              onChange={(e) => {
                const v = Math.max(PRICE_MIN, Math.min(Number(e.target.value), priceRange[1] - PRICE_STEP));
                setPriceRange([v, priceRange[1]]);
              }}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <div className="flex-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Deri</label>
            <input
              type="number"
              min={priceRange[0] + PRICE_STEP}
              max={PRICE_MAX}
              step={PRICE_STEP}
              value={priceRange[1]}
              onChange={(e) => {
                const v = Math.min(PRICE_MAX, Math.max(Number(e.target.value), priceRange[0] + PRICE_STEP));
                setPriceRange([priceRange[0], v]);
              }}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
            />
          </div>
        </div>
      </FilterSection>

      {/* Sipërfaqja m² */}
      <FilterSection
        title="Sipërfaqja (m²)"
        badge={areaRange[0] > AREA_MIN || areaRange[1] < AREA_MAX ? 1 : 0}
      >
        <RangeSlider
          min={AREA_MIN}
          max={AREA_MAX}
          step={AREA_STEP}
          value={areaRange}
          onChange={setAreaRange}
          formatLabel={(v) => (v === AREA_MAX ? `${v}+ m²` : `${v} m²`)}
        />
      </FilterSection>

      {/* Dhoma gjumi */}
      <FilterSection title="Dhoma Gjumi" badge={bedroomsMin !== null ? 1 : 0}>
        <RoomButtons value={bedroomsMin} onChange={setBedroomsMin} />
      </FilterSection>

      {/* Banjo */}
      <FilterSection title="Banjo" badge={bathroomsMin !== null ? 1 : 0} defaultOpen={false}>
        <RoomButtons value={bathroomsMin} onChange={setBathroomsMin} />
      </FilterSection>
    </div>
  );

  return (
    <Layout>
      {/* CSS për range slider thumbs */}
      <style>{`
        .range-thumb::-webkit-slider-thumb { width: 16px; height: 16px; }
        .range-thumb::-moz-range-thumb { width: 16px; height: 16px; border: none; background: transparent; }
      `}</style>

      <div ref={pageTopRef} className="pt-32 pb-24 bg-background min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Titulli */}
          <div className="mb-8">
            <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">
              Prona
            </h1>
            <p className="text-muted-foreground text-lg">
              Shfletoni koleksionin tonë të plotë të pronave.
            </p>
          </div>

          {/* Active filter chips */}
          {activeChips.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {activeChips.map((chip, i) => (
                <FilterChip key={i} label={chip.label} onRemove={chip.onRemove} />
              ))}
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-8 items-start">

            {/* Mobile toggle button */}
            <button
              className="lg:hidden w-full py-3.5 border border-border rounded-xl flex items-center justify-center gap-2 text-foreground font-medium bg-card"
              onClick={() => setShowFilters(!showFilters)}
              type="button"
            >
              <SlidersHorizontal size={18} />
              {showFilters ? "Fshih Filtrat" : "Shfaq Filtrat"}
              {totalActiveFilters > 0 && (
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                  {totalActiveFilters}
                </span>
              )}
            </button>

            {/* Sidebar filters */}
            <div className={`w-full lg:w-80 shrink-0 ${showFilters ? "block" : "hidden lg:block"}`}>
              {FilterPanel}
            </div>

            {/* Results */}
            <div className="flex-1 w-full">

              {/* Count + sort info */}
{!isLoading && (
  <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
    <p className="text-muted-foreground text-sm">
      {filteredProjects.length !== projects.length
        ? `${filteredProjects.length} nga ${totalCount} prona`
        : `${totalCount} prona të gjetura`}
    </p>

    {/* Sort dropdown */}
    <div className="flex items-center gap-2 shrink-0">
      <span className="text-xs text-muted-foreground uppercase tracking-wider hidden sm:block">
        Rendit:
      </span>
      <select
        value={sortBy}
        onChange={(e) => setSortBy(e.target.value as SortOption)}
        className="bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary appearance-none cursor-pointer transition-colors pr-8"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" }}
      >
        <option value="newest">Më i Riu</option>
        <option value="oldest">Më i Vjetri</option>
        <option value="price_asc">Çmimi ↑</option>
        <option value="price_desc">Çmimi ↓</option>
        <option value="area_asc">Sipërfaqja ↑</option>
        <option value="area_desc">Sipërfaqja ↓</option>
      </select>
    </div>
  </div>
)}

              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="animate-pulse bg-card rounded-2xl h-[400px]" />
                  ))}
                </div>
              ) : filteredProjects.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {filteredProjects.map((project) => (
                      <div
                        key={project.id}
                        id={`project-card-${project.id}`}
                        onClickCapture={() => saveProjectsState(project.id)}
                      >
                        <ProjectCard project={project} />
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="mt-10 flex items-center justify-center gap-2 flex-wrap">
                      <button
                        onClick={() => changePage(Math.max(1, page - 1))}
                        disabled={page === 1}
                        aria-label="Faqja e mëparshme"
                        className="w-[42px] h-[42px] flex items-center justify-center border border-border rounded-xl text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:border-primary transition-colors"
                      >
                        &#8249;
                      </button>

                      {getVisiblePages().map((item, index) =>
                        item === "..." ? (
                          <span key={`ellipsis-${index}`} className="px-3 py-2 text-foreground/50 select-none">
                            ...
                          </span>
                        ) : (
                          <button
                            key={item}
                            onClick={() => changePage(Number(item))}
                            className={`min-w-[42px] h-[42px] px-3 rounded-xl border transition-colors ${
                              page === item
                                ? "border-primary bg-primary text-primary-foreground font-semibold"
                                : "border-border text-foreground hover:border-primary"
                            }`}
                          >
                            {item}
                          </button>
                        )
                      )}

                      <button
                        onClick={() => changePage(Math.min(totalPages, page + 1))}
                        disabled={page === totalPages}
                        aria-label="Faqja tjetër"
                        className="w-[42px] h-[42px] flex items-center justify-center border border-border rounded-xl text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:border-primary transition-colors"
                      >
                        &#8250;
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-32 bg-card rounded-2xl border border-border">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4 text-foreground/40">
                    <Search size={24} />
                  </div>
                  <h3 className="font-display text-2xl text-foreground mb-2">Asnjë pronë nuk u gjet</h3>
                  <p className="text-muted-foreground">Provoni të rregulloni kërkimin ose filtrat.</p>
                  <button
                    onClick={clearAllFilters}
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

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Search, ChevronDown, SlidersHorizontal } from "lucide-react";
import { Layout } from "@/components/Layout";
import { ProjectCard } from "@/components/ProjectCard";
import { supabase } from "@/lib/supabase";
import { Helmet } from "react-helmet-async";

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




const parseNumberParam = (value: string | null, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseNullableNumberParam = (value: string | null) => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function useDebouncedValue<T>(value: T, delay = 350) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => window.clearTimeout(timeoutId);
  }, [value, delay]);

  return debouncedValue;
}

// ═══════════════════════════════════════════════════════════════════════════
export default function Projects() {
  const searchParams = new URLSearchParams(window.location.search);

  // ── Server-side filters (Supabase query) ──────────────────────────────
  const [country, setCountry] = useState(searchParams.get("country") || "");
  const [city, setCity] = useState(searchParams.get("city") || "");
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");
  const [propertyType, setPropertyType] = useState(searchParams.get("type") || "");

type SortOption = "relevance" | "newest" | "price_asc" | "price_desc";

const [sortBy, setSortBy] = useState<SortOption>(
  (searchParams.get("sort") as SortOption) || "relevance"
);

// Këta filtra tani aplikohen në Supabase, para pagination
const [priceRange, setPriceRange] = useState<[number, number]>([
  parseNumberParam(searchParams.get("priceMin"), PRICE_MIN),
  parseNumberParam(searchParams.get("priceMax"), PRICE_MAX),
]);

const [areaRange, setAreaRange] = useState<[number, number]>([
  parseNumberParam(searchParams.get("areaMin"), AREA_MIN),
  parseNumberParam(searchParams.get("areaMax"), AREA_MAX),
]);

const [bedroomsMin, setBedroomsMin] = useState<number | null>(
  parseNullableNumberParam(searchParams.get("beds"))
);

const [bathroomsMin, setBathroomsMin] = useState<number | null>(
  parseNullableNumberParam(searchParams.get("baths"))
);

const debouncedSearch = useDebouncedValue(search.trim(), 350);
const debouncedPriceRange = useDebouncedValue(priceRange, 350);
const debouncedAreaRange = useDebouncedValue(areaRange, 350);

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
  const activeServerFilters = [
  country,
  city,
  search,
  statusFilter,
  propertyType,
  sortBy !== "relevance" ? sortBy : "",
].filter(Boolean).length;

  const activeClientFilters = [
    priceRange[0] > PRICE_MIN || priceRange[1] < PRICE_MAX,
    areaRange[0] > AREA_MIN || areaRange[1] < AREA_MAX,
    bedroomsMin !== null,
    bathroomsMin !== null,
  ].filter(Boolean).length;
  const totalActiveFilters = activeServerFilters + activeClientFilters;

  // ── URL sync ──────────────────────────────────────────────────────────
const buildProjectsUrl = useCallback(
  (
    pg: number,
    co: string,
    ci: string,
    se: string,
    st: string,
    ty: string,
    price: [number, number],
    area: [number, number],
    beds: number | null,
    baths: number | null,
    sort: SortOption
  ) => {
    const params = new URLSearchParams();

    if (co) params.set("country", co);
    if (ci) params.set("city", ci);
    if (se) params.set("search", se);
    if (st) params.set("status", st);
    if (ty) params.set("type", ty);

    if (price[0] > PRICE_MIN) params.set("priceMin", String(price[0]));
    if (price[1] < PRICE_MAX) params.set("priceMax", String(price[1]));

    if (area[0] > AREA_MIN) params.set("areaMin", String(area[0]));
    if (area[1] < AREA_MAX) params.set("areaMax", String(area[1]));

    if (beds !== null) params.set("beds", String(beds));
    if (baths !== null) params.set("baths", String(baths));

    if (sort !== "relevance") params.set("sort", sort);
    if (pg > 1) params.set("page", String(pg));

    return `/projects${params.toString() ? `?${params.toString()}` : ""}`;
  },
  []
);

const currentProjectsUrl = buildProjectsUrl(
  page,
  country,
  city,
  search,
  statusFilter,
  propertyType,
  priceRange,
  areaRange,
  bedroomsMin,
  bathroomsMin,
  sortBy
);

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
  }, 150);

  setTimeout(() => {
    applyRestore();
    shouldRestoreScrollRef.current = false;
    sessionStorage.removeItem(PROJECTS_RESTORE_SCROLL_KEY);
  }, 450);
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
  if (!didInitRef.current) return;

  shouldScrollToTopRef.current = true;
  setPage(1);
}, [
  country,
  city,
  search,
  statusFilter,
  propertyType,
  priceRange,
  areaRange,
  bedroomsMin,
  bathroomsMin,
  sortBy,
]);

useEffect(() => {
  didInitRef.current = true;
}, []);

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
      .select(
        `
          id,
          title,
          description,
          address,
          country,
          city,
          status,
          property_type,
          price,
          currency,
          area_m2,
          bedrooms,
          bathrooms,
          images,
          created_at,
          listing_status,
          is_paused,
          expires_at,
          virtual_tour_status,
          virtual_tour_url,
          virtual_tour_embed_code
        `,
        { count: "exact" }
      )
      .eq("listing_status", "active")
      .eq("is_paused", false)
      .or(`expires_at.is.null,expires_at.gte.${nowIso}`);

    if (country) query = query.eq("country", country);
if (city) query = query.eq("city", city);
if (statusFilter) query = query.eq("status", statusFilter);
if (propertyType) query = query.eq("property_type", propertyType);

const [priceMin, priceMax] = debouncedPriceRange;
const [areaMin, areaMax] = debouncedAreaRange;

if (priceMin > PRICE_MIN) query = query.gte("price", priceMin);
if (priceMax < PRICE_MAX) query = query.lte("price", priceMax);

if (areaMin > AREA_MIN) query = query.gte("area_m2", areaMin);
if (areaMax < AREA_MAX) query = query.lte("area_m2", areaMax);

if (bedroomsMin !== null) query = query.gte("bedrooms", bedroomsMin);
if (bathroomsMin !== null) query = query.gte("bathrooms", bathroomsMin);

if (debouncedSearch) {
  const safeSearch = debouncedSearch.replace(/[%,]/g, " ").trim();

  if (safeSearch) {
    query = query.or(
      `title.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%,address.ilike.%${safeSearch}%,city.ilike.%${safeSearch}%,country.ilike.%${safeSearch}%`
    );
  }
}

if (sortBy === "price_asc") {
  query = query.order("price", { ascending: true, nullsFirst: false });
} else if (sortBy === "price_desc") {
  query = query.order("price", { ascending: false, nullsFirst: false });
} else {
  query = query.order("created_at", { ascending: false });
}

const { data, error, count } = await query.range(from, to);

    if (error) {
      console.error("Supabase fetch projects error:", error);
      setProjects([]);
      setTotalCount(0);
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
      const hasFallbackVirtualTour = !!(
        item.virtual_tour_url ||
        item.virtual_tour_embed_code
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
    setIsLoading(false);
  };

  fetchProjects();
}, [
  country,
  city,
  debouncedSearch,
  statusFilter,
  propertyType,
  debouncedPriceRange,
  debouncedAreaRange,
  bedroomsMin,
  bathroomsMin,
  sortBy,
  page,
]);
  
  
  useEffect(() => {
  if (isLoading) return;

  if (shouldRestoreScrollRef.current) {
    restoreProjectsPosition();
    return;
  }

  if (shouldScrollToTopRef.current) {
    requestAnimationFrame(() => {
      scrollToProjectsTop("auto");
      shouldScrollToTopRef.current = false;
    });
  }
}, [isLoading, projects.length, currentProjectsUrl]);

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





const visibleProjects = projects;





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
  setSortBy("relevance");
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
    <div className="glass-panel p-5 rounded-2xl sticky top-24 space-y-4">
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
<FilterSection title="Lloji i Pronës" badge={propertyType ? 1 : 0} defaultOpen={false}>
  <select
    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary appearance-none cursor-pointer transition-colors"
    value={propertyType}
    onChange={(e) => {
      shouldScrollToTopRef.current = true;
      setPropertyType(e.target.value);
    }}
  >
    <option value="">Të gjitha llojet</option>
    {PROPERTY_TYPES.map((opt) => (
      <option key={opt.value} value={opt.value}>
        {opt.label}
      </option>
    ))}
  </select>
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
  defaultOpen={false}
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
  defaultOpen={false}
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
      <FilterSection title="Dhoma Gjumi" badge={bedroomsMin !== null ? 1 : 0} defaultOpen={false}>
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
	      <Helmet>
        <title>Të Gjitha Pronat | Aura Estates</title>
        <meta name="description" content="Shfleto koleksionin e plotë të pronave ekskluzive. Filtro sipas çmimit, sipërfaqes dhe llojit të pronës." />
        <meta property="og:title" content="Të Gjitha Pronat | Aura Estates" />
        <meta property="og:url" content="https://auraks.com/projects" />
      </Helmet>
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
           <div className={`w-full lg:w-72 shrink-0 ${showFilters ? "block" : "hidden lg:block"}`}>
              {FilterPanel}
            </div>

            {/* Results */}
            <div className="flex-1 w-full">

              {/* Count + sort info */}
<div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
<p className="text-muted-foreground text-sm">
  Të gjitha pronat
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
<option value="relevance">Sipas Relevancës</option>
<option value="price_asc">Çmimi: ulët në të lartë</option>
<option value="price_desc">Çmimi: të lartë në të ulët</option>
<option value="newest">Më të rejat</option>
      </select>
    </div>
  </div>


              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="animate-pulse bg-card rounded-2xl h-[400px]" />
                  ))}
                </div>
              ) : visibleProjects.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {visibleProjects.map((project) => (
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

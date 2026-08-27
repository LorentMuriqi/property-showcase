import { useState, useEffect, useRef, useCallback } from "react";
import {
  Bath,
  BedDouble,
  Building2,
  Check,
  ChevronDown,
  Euro,
  MapPin,
  Maximize2,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Tag,
  X,
} from "lucide-react";
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

const PROJECTS_LIST_CACHE_KEY = "projects-list-cache-v2";
const PROJECTS_LIST_CACHE_TTL = 5 * 60 * 1000;

type ProjectsListCache = {
  url: string;
  projects: any[];
  totalCount: number;
  savedAt: number;
};

const getCurrentProjectsCacheUrl = () => {
  return `${window.location.pathname}${window.location.search}`;
};

const readProjectsListCache = (url: string): ProjectsListCache | null => {
  try {
    const raw = sessionStorage.getItem(PROJECTS_LIST_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as ProjectsListCache;

    if (!parsed || parsed.url !== url) return null;
    if (!Array.isArray(parsed.projects)) return null;
    if (Date.now() - parsed.savedAt > PROJECTS_LIST_CACHE_TTL) return null;

    return parsed;
  } catch {
    return null;
  }
};

const writeProjectsListCache = (
  url: string,
  projects: any[],
  totalCount: number
) => {
  try {
    const payload: ProjectsListCache = {
      url,
      projects,
      totalCount,
      savedAt: Date.now(),
    };

    sessionStorage.setItem(PROJECTS_LIST_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Nëse browser-i nuk lejon sessionStorage ose është full, thjesht vazhdo normalisht.
  }
};

const getProjectListSignature = (projects: any[]) => {
  return projects
    .map((project) => {
      const primaryImage =
        project.images?.find((img: any) => img.isPrimary) ||
        project.images?.[0];

      const primaryImageUrl =
        primaryImage?.thumbnailUrl ||
        primaryImage?.thumbnail_url ||
        primaryImage?.thumbUrl ||
        primaryImage?.thumb_url ||
        primaryImage?.url ||
        "";

      return [
        project.id,
        project.title,
        project.price,
        project.status,
        project.property_type,
        project.city,
        project.country,
        project.area_m2,
        project.bedrooms,
        project.bathrooms,
        primaryImageUrl,
        project.hasVirtualTour ? "tour" : "no-tour",
      ].join("|");
    })
    .join("||");
};

const areProjectListsVisuallySame = (a: any[], b: any[]) => {
  if (a.length !== b.length) return false;
  return getProjectListSignature(a) === getProjectListSignature(b);
};

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

const ROOM_PLUS_VALUE = 5;

const ROOM_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: "Të gjitha" },
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
  { value: ROOM_PLUS_VALUE, label: `${ROOM_PLUS_VALUE}+` },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatPrice = (val: number, currency = "EUR") => {
  if (val >= 1_000_000)
    return `${(val / 1_000_000).toFixed(val % 1_000_000 === 0 ? 0 : 1)}M ${currency}`;
  if (val >= 1_000) return `${Math.round(val / 1_000)}K ${currency}`;
  return `${val} ${currency}`;
};

const formatResultCount = (count: number) =>
  `${count} ${count === 1 ? "pronë" : "prona"}`;

const formatRoomFilterLabel = (
  value: number,
  singular: string,
  plural: string
) => {
  const amount =
    value >= ROOM_PLUS_VALUE ? `${ROOM_PLUS_VALUE}+` : String(value);

  return `${amount} ${value === 1 ? singular : plural}`;
};

const getSearchTerms = (value: string) =>
  value
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean)
    .slice(0, 8);

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
  icon,
  children,
  defaultOpen = true,
  badge = 0,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isActive = badge > 0;

  return (
    <section
      className={`overflow-hidden rounded-[18px] border transition-colors duration-200 ${
        isActive
          ? "border-primary/[0.35] bg-primary/[0.035]"
          : "border-border/70 bg-background/35"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="group flex w-full items-center gap-3 px-3.5 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/[0.35]"
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors ${
            isActive
              ? "border-primary/30 bg-primary/10 text-primary"
              : "border-border/70 bg-card text-muted-foreground group-hover:text-primary"
          }`}
        >
          {icon}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold tracking-[0.025em] text-foreground">
            {title}
          </span>
          {isActive && (
            <span className="mt-0.5 block text-[10px] font-medium text-primary">
              {badge === 1 ? "1 filtër aktiv" : `${badge} filtra aktivë`}
            </span>
          )}
        </span>

        <ChevronDown
          size={16}
          className={`shrink-0 text-muted-foreground transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="border-t border-border/60 px-4 pb-4 pt-4">
          {children}
        </div>
      )}
    </section>
  );
}

// ─── Active filter chip ───────────────────────────────────────────────────
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/25 bg-primary/[0.075] py-1.5 pl-3 pr-1.5 text-xs font-semibold text-primary shadow-sm">
      <span className="max-w-[230px] truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Hiq filtrin: ${label}`}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-primary/[0.15] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/[0.35]"
      >
        <X size={12} />
      </button>
    </span>
  );
}

function SelectField({
  label,
  value,
  onChange,
  disabled = false,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <span className="relative block">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-label={label}
          className="h-12 w-full appearance-none rounded-xl border border-border/80 bg-background px-3.5 pr-10 text-sm font-medium text-foreground outline-none transition-all hover:border-primary/[0.35] focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          size={15}
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
      </span>
    </label>
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
  if (value === null || value === "") return fallback;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseRoomParam = (value: string | null) => {
  if (!value) return null;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return null;

  return Math.min(parsed, ROOM_PLUS_VALUE);
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
  parseRoomParam(searchParams.get("beds"))
);

const [bathroomsMin, setBathroomsMin] = useState<number | null>(
  parseRoomParam(searchParams.get("baths"))
);

const debouncedSearch = useDebouncedValue(search.trim(), 350);
const debouncedPriceRange = useDebouncedValue(priceRange, 350);
const debouncedAreaRange = useDebouncedValue(areaRange, 350);

  // ── UI state ──────────────────────────────────────────────────────────
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(Math.max(1, Number(searchParams.get("page") || "1") || 1));

// ── Data state ────────────────────────────────────────────────────────
const initialProjectsCacheRef = useRef(
  readProjectsListCache(getCurrentProjectsCacheUrl())
);

const shouldSkipInitialCachedFetchRef = useRef(
  !!initialProjectsCacheRef.current &&
    sessionStorage.getItem(PROJECTS_RESTORE_SCROLL_KEY) === "1"
);

const [projects, setProjects] = useState<any[]>(
  () => initialProjectsCacheRef.current?.projects ?? []
);

const projectsRef = useRef<any[]>(
  initialProjectsCacheRef.current?.projects ?? []
);

useEffect(() => {
  projectsRef.current = projects;
}, [projects]);

const [countries, setCountries] = useState<string[]>([]);
const [cities, setCities] = useState<string[]>([]);

const [isLoading, setIsLoading] = useState(
  () => !initialProjectsCacheRef.current
);

const [totalCount, setTotalCount] = useState(
  () => initialProjectsCacheRef.current?.totalCount ?? 0
);

  const pageTopRef = useRef<HTMLDivElement | null>(null);
  const shouldRestoreScrollRef = useRef(false);
  const shouldScrollToTopRef = useRef(false);
  const didInitRef = useRef(false);

  const pageSize = 8;

  // ── Derived: active filter count (for badge on mobile button) ─────────
  const activeServerFilters = [
    country,
    city,
    search.trim(),
    statusFilter,
    propertyType,
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
  debouncedPriceRange,
  debouncedAreaRange,
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

  // Çdo kërkim/filter i ri është një kontekst i ri rezultatesh.
  // Mos rikthe pozicionin e një karte të vjetër.
  shouldRestoreScrollRef.current = false;
  shouldScrollToTopRef.current = true;
  clearProjectsRestoreState();

  // Rezultatet e reja gjithmonë fillojnë nga faqja 1.
  setPage(1);
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
  if (shouldSkipInitialCachedFetchRef.current) {
    shouldSkipInitialCachedFetchRef.current = false;
    setIsLoading(false);
    return;
  }

const fetchProjects = async () => {
  const cachedList = readProjectsListCache(currentProjectsUrl);
  const hasCachedList = !!cachedList && cachedList.projects.length > 0;

if (!hasCachedList && projectsRef.current.length === 0) {
  setIsLoading(true);
}

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

if (bedroomsMin !== null) {
  query =
    bedroomsMin >= ROOM_PLUS_VALUE
      ? query.gte("bedrooms", ROOM_PLUS_VALUE)
      : query.eq("bedrooms", bedroomsMin);
}

if (bathroomsMin !== null) {
  query =
    bathroomsMin >= ROOM_PLUS_VALUE
      ? query.gte("bathrooms", ROOM_PLUS_VALUE)
      : query.eq("bathrooms", bathroomsMin);
}

for (const term of getSearchTerms(debouncedSearch)) {
  query = query.or(
    [
      `title.ilike.%${term}%`,
      `description.ilike.%${term}%`,
      `address.ilike.%${term}%`,
      `city.ilike.%${term}%`,
      `country.ilike.%${term}%`,
    ].join(",")
  );
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

  const cachedList = readProjectsListCache(currentProjectsUrl);

  if (cachedList) {
    setProjects(cachedList.projects);
    setTotalCount(cachedList.totalCount);
  } else {
    setProjects([]);
    setTotalCount(0);
  }

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

setProjects((currentProjects) => {
  const nextTotalCount = count || 0;

  const shouldKeepCurrentProjects =
    currentProjects.length > 0 &&
    totalCount === nextTotalCount &&
    areProjectListsVisuallySame(currentProjects, rowsWithVirtualTour);

  if (shouldKeepCurrentProjects) {
    return currentProjects;
  }

  return rowsWithVirtualTour;
});

setTotalCount(count || 0);

writeProjectsListCache(
  currentProjectsUrl,
  rowsWithVirtualTour,
  count || 0
);

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
  shouldScrollToTopRef.current = false;
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
    ...(search.trim()
      ? [{ label: `Kërko: “${search.trim()}”`, onRemove: () => setSearch("") }]
      : []),
    ...(country
      ? [
          {
            label: country,
            onRemove: () => {
              setCountry("");
              setCity("");
            },
          },
        ]
      : []),
    ...(city ? [{ label: city, onRemove: () => setCity("") }] : []),
    ...(statusFilter
      ? [
          {
            label:
              STATUS_OPTIONS.find((status) => status.value === statusFilter)
                ?.label || statusFilter,
            onRemove: () => setStatusFilter(""),
          },
        ]
      : []),
    ...(propertyType
      ? [
          {
            label:
              PROPERTY_TYPES.find((type) => type.value === propertyType)?.label ||
              propertyType,
            onRemove: () => setPropertyType(""),
          },
        ]
      : []),
    ...(priceRange[0] > PRICE_MIN || priceRange[1] < PRICE_MAX
      ? [
          {
            label: `${formatPrice(priceRange[0])} – ${
              priceRange[1] === PRICE_MAX
                ? "2M+ EUR"
                : formatPrice(priceRange[1])
            }`,
            onRemove: () => setPriceRange([PRICE_MIN, PRICE_MAX]),
          },
        ]
      : []),
    ...(areaRange[0] > AREA_MIN || areaRange[1] < AREA_MAX
      ? [
          {
            label: `${areaRange[0]}–${
              areaRange[1] === AREA_MAX ? `${AREA_MAX}+` : areaRange[1]
            } m²`,
            onRemove: () => setAreaRange([AREA_MIN, AREA_MAX]),
          },
        ]
      : []),
    ...(bedroomsMin !== null
      ? [
          {
            label: formatRoomFilterLabel(
              bedroomsMin,
              "dhomë gjumi",
              "dhoma gjumi"
            ),
            onRemove: () => setBedroomsMin(null),
          },
        ]
      : []),
    ...(bathroomsMin !== null
      ? [
          {
            label: formatRoomFilterLabel(bathroomsMin, "banjo", "banjo"),
            onRemove: () => setBathroomsMin(null),
          },
        ]
      : []),
  ];

  // ── Bedroom / bathroom exact-select buttons ──────────────────────────
  const RoomButtons = ({
    value,
    onChange,
    label,
  }: {
    value: number | null;
    onChange: (value: number | null) => void;
    label: string;
  }) => (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {ROOM_OPTIONS.map((option) => {
          const isSelected = value === option.value;

          return (
            <button
              key={option.value ?? "all"}
              type="button"
              aria-pressed={isSelected}
              aria-label={`${option.label} ${label}`}
              onClick={() => onChange(option.value)}
              className={`flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/[0.35] ${
                isSelected
                  ? "border-primary bg-primary text-primary-foreground shadow-[0_8px_20px_rgba(212,175,55,0.18)]"
                  : "border-border/80 bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {isSelected && <Check size={13} strokeWidth={2.4} />}
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        1–4 shfaqin vetëm numrin e zgjedhur. 5+ përfshin pesë ose më shumë.
      </p>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────

  const FilterPanel = (
    <aside id="projects-filter-panel" className="lg:sticky lg:top-24">
      <div className="relative overflow-hidden rounded-[26px] border border-border/80 bg-card shadow-[0_24px_70px_rgba(15,23,42,0.09)]">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-primary/80 to-transparent" />

        <div className="border-b border-border/70 px-5 pb-5 pt-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                <SlidersHorizontal size={20} strokeWidth={1.8} />
              </span>

              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                  Kërko pronat
                </p>
                <h3 className="mt-1 font-display text-xl font-bold text-foreground">
                  Filtrat e pronave
                </h3>
                <p
                  aria-live="polite"
                  className="mt-1 text-xs text-muted-foreground"
                >
                  {isLoading
                    ? "Duke përditësuar rezultatet..."
                    : `${formatResultCount(totalCount)} të gjetura`}
                </p>
              </div>
            </div>

            {totalActiveFilters > 0 && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.06] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-primary transition-colors hover:bg-primary/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/[0.35]"
              >
                <RotateCcw size={12} />
                Rivendos
              </button>
            )}
          </div>
        </div>

        <div className="space-y-3 p-3.5">
          <FilterSection
            title="Kërko"
            icon={<Search size={17} strokeWidth={1.9} />}
            badge={search.trim() ? 1 : 0}
          >
            <div className="group relative">
              <Search
                size={17}
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary"
              />
              <input
                type="text"
                value={search}
                maxLength={120}
                autoComplete="off"
                spellCheck={false}
                aria-label="Kërko prona"
                placeholder="Titull, adresë, qytet..."
                onChange={(e) => setSearch(e.target.value)}
                className="h-12 w-full rounded-xl border border-border/80 bg-background pl-10 pr-10 text-sm font-medium text-foreground outline-none transition-all placeholder:font-normal placeholder:text-muted-foreground/80 hover:border-primary/[0.35] focus:border-primary focus:ring-4 focus:ring-primary/10"
              />

              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Pastro kërkimin"
                  className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/[0.35]"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
              Mund të përdorni disa fjalë, p.sh. “vilë Prishtinë”.
            </p>
          </FilterSection>

          <FilterSection
            title="Lloji i transaksionit"
            icon={<Tag size={17} strokeWidth={1.9} />}
            badge={statusFilter ? 1 : 0}
          >
            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border/70 bg-muted/20 p-1.5">
              {[{ value: "", label: "Të gjitha" }, ...STATUS_OPTIONS].map(
                (option) => {
                  const isSelected = statusFilter === option.value;

                  return (
                    <button
                      key={option.value || "all"}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setStatusFilter(option.value)}
                      className={`min-h-[40px] rounded-xl px-2 text-[11px] font-semibold leading-tight transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/[0.35] ${
                        isSelected
                          ? "bg-card text-foreground shadow-sm ring-1 ring-primary/25"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                }
              )}
            </div>
          </FilterSection>

          <FilterSection
            title="Lloji i pronës"
            icon={<Building2 size={17} strokeWidth={1.9} />}
            badge={propertyType ? 1 : 0}
            defaultOpen={false}
          >
            <SelectField
              label="Kategoria"
              value={propertyType}
              onChange={setPropertyType}
            >
              <option value="">Të gjitha llojet</option>
              {PROPERTY_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
          </FilterSection>

          <FilterSection
            title="Vendndodhja"
            icon={<MapPin size={17} strokeWidth={1.9} />}
            badge={(country ? 1 : 0) + (city ? 1 : 0)}
          >
            <div className="space-y-3">
              <SelectField
                label="Shteti"
                value={country}
                onChange={(value) => {
                  setCountry(value);
                  setCity("");
                }}
              >
                <option value="">Të gjitha shtetet</option>
                {countries.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </SelectField>

              <SelectField
                label="Qyteti"
                value={city}
                disabled={!country}
                onChange={setCity}
              >
                <option value="">
                  {country
                    ? "Të gjitha qytetet"
                    : "Zgjidhni fillimisht shtetin"}
                </option>
                {cities.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </SelectField>
            </div>
          </FilterSection>

          <FilterSection
            title="Çmimi"
            icon={<Euro size={17} strokeWidth={1.9} />}
            badge={
              priceRange[0] > PRICE_MIN || priceRange[1] < PRICE_MAX ? 1 : 0
            }
            defaultOpen={false}
          >
            <RangeSlider
              min={PRICE_MIN}
              max={PRICE_MAX}
              step={PRICE_STEP}
              value={priceRange}
              onChange={setPriceRange}
              formatLabel={(value) =>
                value === PRICE_MAX ? "2M+ EUR" : formatPrice(value, "EUR")
              }
            />

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Minimumi
                </span>
                <span className="relative block">
                  <input
                    type="number"
                    min={PRICE_MIN}
                    max={priceRange[1] - PRICE_STEP}
                    step={PRICE_STEP}
                    value={priceRange[0]}
                    onChange={(e) => {
                      const nextValue = Math.max(
                        PRICE_MIN,
                        Math.min(
                          Number(e.target.value),
                          priceRange[1] - PRICE_STEP
                        )
                      );
                      setPriceRange([nextValue, priceRange[1]]);
                    }}
                    className="h-11 w-full rounded-xl border border-border/80 bg-background px-3 pr-8 text-sm font-medium tabular-nums text-foreground outline-none transition-all hover:border-primary/[0.35] focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-muted-foreground">
                    €
                  </span>
                </span>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Maksimumi
                </span>
                <span className="relative block">
                  <input
                    type="number"
                    min={priceRange[0] + PRICE_STEP}
                    max={PRICE_MAX}
                    step={PRICE_STEP}
                    value={priceRange[1]}
                    onChange={(e) => {
                      const nextValue = Math.min(
                        PRICE_MAX,
                        Math.max(
                          Number(e.target.value),
                          priceRange[0] + PRICE_STEP
                        )
                      );
                      setPriceRange([priceRange[0], nextValue]);
                    }}
                    className="h-11 w-full rounded-xl border border-border/80 bg-background px-3 pr-8 text-sm font-medium tabular-nums text-foreground outline-none transition-all hover:border-primary/[0.35] focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-muted-foreground">
                    €
                  </span>
                </span>
              </label>
            </div>

            <p className="mt-2.5 text-[10px] leading-relaxed text-muted-foreground">
              2M+ përfshin edhe pronat mbi 2,000,000 €.
            </p>
          </FilterSection>

          <FilterSection
            title="Sipërfaqja"
            icon={<Maximize2 size={17} strokeWidth={1.9} />}
            badge={
              areaRange[0] > AREA_MIN || areaRange[1] < AREA_MAX ? 1 : 0
            }
            defaultOpen={false}
          >
            <RangeSlider
              min={AREA_MIN}
              max={AREA_MAX}
              step={AREA_STEP}
              value={areaRange}
              onChange={setAreaRange}
              formatLabel={(value) =>
                value === AREA_MAX ? `${AREA_MAX}+ m²` : `${value} m²`
              }
            />
          </FilterSection>

          <FilterSection
            title="Dhoma gjumi"
            icon={<BedDouble size={17} strokeWidth={1.9} />}
            badge={bedroomsMin !== null ? 1 : 0}
            defaultOpen={false}
          >
            <RoomButtons
              value={bedroomsMin}
              onChange={setBedroomsMin}
              label="dhoma gjumi"
            />
          </FilterSection>

          <FilterSection
            title="Banjo"
            icon={<Bath size={17} strokeWidth={1.9} />}
            badge={bathroomsMin !== null ? 1 : 0}
            defaultOpen={false}
          >
            <RoomButtons
              value={bathroomsMin}
              onChange={setBathroomsMin}
              label="banjo"
            />
          </FilterSection>

          <button
            type="button"
            onClick={() => setShowFilters(false)}
            disabled={isLoading}
            className="mt-1 flex h-12 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-[0_12px_28px_rgba(212,175,55,0.2)] transition-all hover:-translate-y-0.5 hover:bg-primary/90 disabled:cursor-wait disabled:opacity-70 lg:hidden"
          >
            {isLoading
              ? "Duke kërkuar..."
              : `Shfaq ${formatResultCount(totalCount)}`}
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <Layout>
	      <Helmet>
        <title>Të Gjitha Pronat | Aura Estates</title>
        <meta name="description" content="Shfleto koleksionin e plotë të pronave ekskluzive. Filtro sipas çmimit, sipërfaqes dhe llojit të pronës." />
        <meta property="og:title" content="Të Gjitha Pronat | Aura Estates" />
        <meta property="og:url" content="https://auraks.com/projects" />
      </Helmet>
      {/* CSS vetëm për slider-at e filtrave */}
      <style>{`
        .range-thumb {
          appearance: none;
          -webkit-appearance: none;
          background: transparent;
          pointer-events: none;
        }

        .range-thumb::-webkit-slider-thumb {
          width: 22px;
          height: 22px;
          border: 0;
          background: transparent;
          pointer-events: auto;
          cursor: grab;
          -webkit-appearance: none;
        }

        .range-thumb::-moz-range-thumb {
          width: 22px;
          height: 22px;
          border: 0;
          background: transparent;
          pointer-events: auto;
          cursor: grab;
        }
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
              type="button"
              onClick={() => setShowFilters((current) => !current)}
              aria-expanded={showFilters}
              aria-controls="projects-filter-panel"
              className={`lg:hidden flex w-full items-center justify-between rounded-2xl border px-4 py-3.5 text-foreground shadow-sm transition-colors ${
                showFilters
                  ? "border-primary/[0.35] bg-primary/[0.05]"
                  : "border-border/80 bg-card"
              }`}
            >
              <span className="flex items-center gap-3 text-left">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <SlidersHorizontal size={18} />
                </span>
                <span>
                  <span className="block text-sm font-semibold">
                    Filtrat e pronave
                  </span>

                </span>
              </span>

              <span className="flex items-center gap-2">
                {totalActiveFilters > 0 && (
                  <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                    {totalActiveFilters}
                  </span>
                )}
                <ChevronDown
                  size={17}
                  className={`text-muted-foreground transition-transform duration-200 ${
                    showFilters ? "rotate-180" : ""
                  }`}
                />
              </span>
            </button>

            {/* Sidebar filters */}
            <div
              className={`w-full shrink-0 lg:w-[320px] ${
                showFilters ? "block" : "hidden lg:block"
              }`}
            >
              {FilterPanel}
            </div>

            {/* Results */}
            <div className="flex-1 w-full">

              {/* Count + sort info */}
<div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
<div aria-live="polite">
  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
    Rezultatet
  </p>
  <p className="mt-1 text-sm font-medium text-foreground">
    {isLoading ? "Duke kërkuar..." : formatResultCount(totalCount)}
  </p>
</div>

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
import { Cache, type AdapterConstructor, type PanoData, type PanoDataProvider, type Viewer } from "@photo-sphere-viewer/core";
import {
  EquirectangularTilesAdapter,
  type EquirectangularMultiTilesPanorama,
  type EquirectangularTilesAdapterConfig,
  type EquirectangularTilesPanorama,
} from "@photo-sphere-viewer/equirectangular-tiles-adapter";
type Group = Parameters<EquirectangularTilesAdapter["setTexture"]>[0];

// Matches aura360_tile_builder_v2.py from AURA360_Tiles_OneClick_Mixed_18MP_72MP.zip.
// No image transformations, Worker, database columns or original-image requests
// are needed when the manifest and preview are available.
type TilesPanorama = EquirectangularTilesPanorama | EquirectangularMultiTilesPanorama;
type TileLevel = { width: number; cols: number; rows: number; directory: string; tileSize: number };
type ResolvedSource = {
  panorama: TilesPanorama;
  tiled: boolean;
  originalUrl: string | null;
  manifestUrl: string | null;
};
type SourceEntry = { value?: ResolvedSource; pending?: Promise<ResolvedSource>; expires: number };
type NativeTextureData = Awaited<ReturnType<EquirectangularTilesAdapter["loadTexture"]>>;
type AuraTextureData = NativeTextureData & { auraSource?: ResolvedSource };

const sources = new Map<string, SourceEntry>();
const MAX_SOURCES = 256;
const MANIFEST_TTL_MS = 30 * 60 * 1000;
const FALLBACK_TTL_MS = 30 * 1000;
const MANIFEST_TIMEOUT_MS = 5000;
const RETRY_DELAY_MS = 180;
const EMPTY_PANORAMA: EquirectangularTilesPanorama = {
  width: 2048, cols: 4, rows: 2, tileUrl: () => null,
};

const sourceKey = (source: string) => {
  const url = new URL(source.trim(), document.baseURI);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    // Blob/data images remain usable without sidecar discovery.
    if (url.protocol !== "blob:" && url.protocol !== "data:") throw new Error("Unsupported panorama URL");
  }
  url.hash = "";
  return url.href;
};

export const getAuraManifestUrl = (source: string): string | null => {
  const url = new URL(sourceKey(source));
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (/\/manifest\.json$/i.test(url.pathname)) return url.href;
  if (!/\.(?:jpe?g|png|webp)$/i.test(url.pathname)) return null;
  url.pathname = url.pathname.replace(/\.(?:jpe?g|png|webp)$/i, "/manifest.json");
  return url.href;
};

const isManifestSource = (source: string) => /\/manifest\.json$/i.test(new URL(sourceKey(source)).pathname);
const isPowerOfTwo = (n: number) => Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const relativeAsset = (path: string, manifest: string): string => {
  // The builder emits relative names. Reject absolute URLs and traversal.
  if (!path || path.startsWith("/") || /[:?#\\]/.test(path) || path.split("/").some((p) => !p || p === "." || p === "..")) {
    throw new Error("Invalid relative tile asset path");
  }
  const base = new URL(manifest);
  const asset = new URL(path.split("/").map(encodeURIComponent).join("/"), base);
  asset.search = base.search; // Preserve a public cache-version query, if supplied.
  return asset.href;
};

const parseManifest = (value: unknown, manifestUrl: string, originalUrl: string | null): ResolvedSource => {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.type !== "aura360-equirectangular-tiled" ||
      value.preview !== "preview.webp" || value.tileUrlPattern !== "level{level}/{col}_{row}.webp" ||
      !Array.isArray(value.levels) || value.levels.length === 0 || value.levels.length > 8) {
    throw new Error("Unsupported AURA360 tile manifest");
  }
  const levels: TileLevel[] = value.levels.map((raw, index) => {
    if (!isRecord(raw)) throw new Error("Invalid tile level");
    const { width, cols, rows, tileSize, directory } = raw;
    if (typeof width !== "number" || !Number.isInteger(width) || width < 4 || width > 65536 || width % 2 ||
        typeof cols !== "number" || !isPowerOfTwo(cols) || cols > 64 ||
        typeof rows !== "number" || !isPowerOfTwo(rows) || rows > 32 || rows !== cols / 2 ||
        typeof tileSize !== "number" || !Number.isInteger(tileSize) || tileSize < 1 || tileSize > 1024 ||
        width / cols !== tileSize || width / 2 / rows !== tileSize || directory !== `level${index}`) {
      throw new Error("Invalid panorama tile grid");
    }
    return { width, cols, rows, tileSize, directory } as TileLevel;
  });
  if (levels.some((level, i) => i > 0 && level.width <= levels[i - 1].width) ||
      value.originalWidth !== levels[levels.length - 1].width || value.originalHeight !== Number(value.originalWidth) / 2) {
    throw new Error("Inconsistent panorama dimensions");
  }
  if (!originalUrl && typeof value.sourceFile === "string" && value.sourceFile && !/[/\\]/.test(value.sourceFile)) {
    const url = new URL(`../${encodeURIComponent(value.sourceFile)}`, manifestUrl);
    url.search = new URL(manifestUrl).search;
    originalUrl = url.href;
  }
  return {
    tiled: true, originalUrl, manifestUrl,
    panorama: {
      baseUrl: relativeAsset("preview.webp", manifestUrl),
      // Preserve exact per-image dimensions. The official adapter chooses a
      // level from the viewport/FOV; there is no fixed 18MP/72MP assumption.
      levels: levels.map(({ width, cols, rows }) => ({ width, cols, rows })),
      tileUrl: (col: number, row: number, level = 0) => {
        const config = levels[level];
        if (!config || !Number.isInteger(col) || !Number.isInteger(row) || col < 0 || row < 0 || col >= config.cols || row >= config.rows) return null;
        return relativeAsset(`${config.directory}/${col}_${row}.webp`, manifestUrl);
      },
    },
  };
};

const originalSource = (url: string): ResolvedSource => ({
  tiled: false, originalUrl: url, manifestUrl: null,
  // Keep the normal full image as the base layer, with no tile requests.
  // Real image/XMP dimensions are restored in loadTexture below.
  panorama: { ...EMPTY_PANORAMA, baseUrl: url },
});

const remember = (key: string, value: ResolvedSource,
  ttlMs = value.tiled ? MANIFEST_TTL_MS : FALLBACK_TTL_MS) => {
  sources.delete(key);
  sources.set(key, { value, expires: Date.now() + ttlMs });
  for (const [oldKey, entry] of sources) {
    if (sources.size <= MAX_SOURCES) break;
    if (!entry.pending) sources.delete(oldKey);
  }
  return value;
};

const isAbort = (error: unknown) => (error as { name?: string })?.name === "AbortError";
const retryDelay = () => new Promise<void>((resolve) => window.setTimeout(resolve, RETRY_DELAY_MS));
const isTransient = (error: unknown): boolean => {
  const value = error as { name?: string; status?: number; response?: { status?: number } };
  const status = value?.response?.status ?? value?.status;
  if (typeof status === "number") return status === 408 || status === 425 || status === 429 || status >= 500;
  return value?.name === "AbortError" || value?.name === "TypeError";
};

/** Retry the base once, clearing only its failed file/decode cache entry. */
const loadBaseWithRetry = async <T>(base: string, load: () => Promise<T>, closed = () => false): Promise<T> => {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (closed()) throw Object.assign(new Error("Tour closed"), { name: "AbortError" });
    try { return await load(); }
    catch (error) {
      // Viewer cancellations are intentional; never restart them in the background.
      if (isAbort(error) || closed()) throw error;
      Cache.remove(base, base);
      const status = (error as { status?: number; response?: { status?: number } })?.response?.status
        ?? (error as { status?: number })?.status;
      if (attempt || (typeof status === "number" && !isTransient(error))) throw error;
      await retryDelay();
    }
  }
  throw new Error("Panorama base did not load");
};

const rememberLoadedOriginal = (source: string, fallback: ResolvedSource, previous: ResolvedSource) => {
  const key = sourceKey(source);
  const entry = sources.get(key);
  // Another viewer may have discovered a valid manifest while this load ran.
  if (!entry?.pending && (!entry?.value || entry.value === previous)) remember(key, fallback);
  return fallback;
};

const forgetFailedOriginal = (source: string, resolved: ResolvedSource) => {
  const key = sourceKey(source);
  if (!resolved.tiled && sources.get(key)?.value === resolved) sources.delete(key);
};

export const resolveAuraPanorama = (source: string): Promise<ResolvedSource> => {
  const key = sourceKey(source);
  const cached = sources.get(key);
  if (cached?.pending) return cached.pending;
  if (cached?.value && cached.expires > Date.now()) {
    sources.delete(key); sources.set(key, cached);
    return Promise.resolve(cached.value);
  }
  const manifestUrl = getAuraManifestUrl(key);
  if (!manifestUrl) return Promise.resolve(remember(key, originalSource(key)));
  const explicit = isManifestSource(key);
  const pending = (async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), explicit ? 8000 : MANIFEST_TIMEOUT_MS);
      try {
        const response = await fetch(manifestUrl, {
          signal: controller.signal, mode: "cors", credentials: "omit",
          cache: attempt ? "reload" : "default",
        });
        if (!response.ok) throw Object.assign(new Error(`Tile manifest HTTP ${response.status}`), { status: response.status });
        const value: unknown = await response.json();
        return remember(key, parseManifest(value, manifestUrl, explicit ? null : key));
      } catch (error) {
        window.clearTimeout(timeout);
        if (!attempt && isTransient(error)) { await retryDelay(); continue; }
        if (explicit) { sources.delete(key); throw error; }
        // Discovery can fall back to a legacy JPG, but do not cache that choice
        // until the JPG actually loads. It may be intentionally absent in R2.
        return remember(key, originalSource(key), 0);
      } finally {
        window.clearTimeout(timeout);
      }
    }
    throw new Error("Tile manifest did not load");
  })();
  sources.set(key, { pending, expires: 0 });
  return pending;
};

/** The existing bounded preload scheduler now downloads only the base image. */
export const preloadAuraPanorama = async (viewer: Viewer, source: string): Promise<void> => {
  const resolved = await resolveAuraPanorama(source);
  try {
    const base = resolved.panorama.baseUrl!;
    await loadBaseWithRetry(base, () => viewer.textureLoader.loadFile(base, undefined, base));
    if (!resolved.tiled) rememberLoadedOriginal(source, resolved, resolved);
  } catch (error) {
    if (isAbort(error)) throw error;
    if (!resolved.tiled || !resolved.originalUrl) { forgetFailedOriginal(source, resolved); throw error; }
    const fallback = originalSource(resolved.originalUrl);
    const base = fallback.panorama.baseUrl!;
    await loadBaseWithRetry(base, () => viewer.textureLoader.loadFile(base, undefined, base));
    // Publish fallback only after that file actually loaded. If the JPG is
    // intentionally absent, retain the valid tile manifest for the next attempt.
    rememberLoadedOriginal(source, fallback, resolved);
  }
};

/** Cache probes must use preview.webp for tiled scenes, never the original JPG. */
export const hasAuraPanoramaCache = (_viewer: Viewer, source: string): boolean => {
  const resolved = sources.get(sourceKey(source))?.value;
  const base = resolved?.panorama.baseUrl;
  return !!base && !!Cache.get(base, base);
};

/** Keep the current walking animation working with a tiled panorama Group. */
export const getAuraSphereRadius = (mesh: any): number | undefined =>
  mesh?.geometry?.parameters?.radius ?? mesh?.children?.[0]?.geometry?.parameters?.radius;

/**
 * String URL bridge for the existing VirtualTourPlugin and admin editor.
 * All external panorama IDs/URLs remain strings, including preload caches.
 * The tiles adapter alone sees the resolved configuration through a viewer
 * facade. Its delayed refreshes read the displayed mesh, so rotating while a
 * different scene loads cannot accidentally request the destination's tiles.
 */
export class AuraTilesAdapter extends EquirectangularTilesAdapter {
  private readonly meshSources: WeakMap<Group, TilesPanorama>;
  private readonly actualViewer: Viewer;
  private readonly transitionBaseOrders = new Map<Group, number>();
  private closed = false;

  private readonly restoreTransitionBaseOrders = () => {
    for (const [group, order] of this.transitionBaseOrders) {
      group.children[0].renderOrder = order;
    }
    this.transitionBaseOrders.clear();
    // Enforce the viewer's existing cache limit on arrival, rather than waiting
    // for the library's one-minute sweep while visiting many scenes on a phone.
    Cache.purge();
  };

  static override withConfig(config: EquirectangularTilesAdapterConfig): [AdapterConstructor, any] {
    return [AuraTilesAdapter, config];
  }

  constructor(viewer: Viewer, config: EquirectangularTilesAdapterConfig = {}) {
    const meshSources = new WeakMap<Group, TilesPanorama>();
    const configView = new Proxy(viewer.config, {
      get: (_target, property) => {
        if (property !== "panorama") return Reflect.get(viewer.config, property, viewer.config);
        const mesh = (viewer.renderer as unknown as { mesh?: Group })?.mesh;
        return (mesh && meshSources.get(mesh)) ?? EMPTY_PANORAMA;
      },
      set: (_target, property, value) => Reflect.set(viewer.config, property, value, viewer.config),
    });
    const facade = new Proxy(viewer, {
      get: (target, property) => {
        if (property === "config") return configView;
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    // 64 segments cover every grid emitted by the builder. A denser sphere
    // multiplies tiled draw calls without adding photographic detail.
    super(facade, { ...config, resolution: 64, baseBlur: false, showErrorTile: false });
    this.meshSources = meshSources;
    this.actualViewer = viewer;
  }

  override init(): void {
    super.init();
    this.actualViewer.addEventListener("transition-done", this.restoreTransitionBaseOrders);
  }

  override supportsTransition(panorama: any): boolean {
    return typeof panorama === "string" || super.supportsTransition(panorama);
  }

  override supportsPreload(panorama: any): boolean {
    return typeof panorama === "string" || super.supportsPreload(panorama);
  }

  override async loadTexture(source: any, loader = true, panoData?: PanoData | PanoDataProvider): Promise<any> {
    if (typeof source !== "string") return super.loadTexture(source, loader);
    let resolved = await resolveAuraPanorama(source);
    this.requireOpen();
    const load = (config: ResolvedSource) => super.loadTexture({
      ...config.panorama,
      ...(!config.tiled && panoData ? { basePanoData: panoData } : {}),
    }, loader);
    let data: NativeTextureData;
    try {
      data = await loadBaseWithRetry(resolved.panorama.baseUrl!, () => load(resolved), () => this.closed);
      if (!resolved.tiled) rememberLoadedOriginal(source, resolved, resolved);
    } catch (error) {
      if (isAbort(error)) throw error;
      if (this.closed || !resolved.tiled || !resolved.originalUrl) { forgetFailedOriginal(source, resolved); throw error; }
      const fallback = originalSource(resolved.originalUrl);
      data = await loadBaseWithRetry(fallback.panorama.baseUrl!, () => load(fallback), () => this.closed);
      resolved = rememberLoadedOriginal(source, fallback, resolved);
    }
    if (this.closed) { super.disposeTexture(data); this.requireOpen(); }
    const baseData = data.panoData?.baseData;
    if (!resolved.tiled && baseData) {
      // A legacy full panorama keeps its actual dimensions and XMP pose.
      data.panoData = { ...baseData, baseData };
    }
    // Core uses strict panorama identity to reject stale asynchronous loads.
    // Preserve the exact requested string, not its normalized/manifest URL.
    return { ...data, panorama: source, auraSource: resolved };
  }

  override setTexture(group: Group, data: AuraTextureData, transition: boolean): void {
    const panorama = data.auraSource?.panorama ?? data.panorama;
    this.meshSources.set(group, panorama);
    if (data.auraSource && !data.auraSource.tiled && group.children[1]) {
      group.children[1].visible = false;
    }
    const outgoing = (this.actualViewer.renderer as unknown as { mesh?: Group }).mesh;
    const outgoingTiles = outgoing?.children[1];
    if (transition && outgoingTiles?.visible) {
      const base = group.children[0];
      this.transitionBaseOrders.set(group, base.renderOrder);
      // The walking fade reaches opacity 1 before the native swap. Three.js
      // then moves this preview into its opaque render pass. Keep it above
      // the outgoing tiles, or those tiles flash back over the new view.
      base.renderOrder = Math.max(base.renderOrder, outgoingTiles.renderOrder + 1);
    }
    super.setTexture(group, { ...data, panorama }, transition);
    if (!transition) Cache.purge();
  }

  override disposeMesh(group: Group): void {
    const order = this.transitionBaseOrders.get(group);
    if (order !== undefined) group.children[0].renderOrder = order;
    this.transitionBaseOrders.delete(group);
    super.disposeMesh(group);
  }

  override destroy(): void {
    this.closed = true;
    this.actualViewer.removeEventListener("transition-done", this.restoreTransitionBaseOrders);
    this.restoreTransitionBaseOrders();
    super.destroy();
  }

  private requireOpen(): void {
    if (this.closed || !this.actualViewer) {
      throw Object.assign(new Error("Tour closed"), { name: "AbortError" });
    }
  }
}

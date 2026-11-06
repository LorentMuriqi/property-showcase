import { Cache, type AdapterConstructor, type PanoData, type PanoDataProvider, type Viewer } from "@photo-sphere-viewer/core";
import {
  EquirectangularTilesAdapter,
  type EquirectangularMultiTilesPanorama,
  type EquirectangularTilesAdapterConfig,
  type EquirectangularTilesPanorama,
} from "@photo-sphere-viewer/equirectangular-tiles-adapter";
import type { VirtualTourPlugin, VirtualTourNode, VirtualTourLink } from "@photo-sphere-viewer/virtual-tour-plugin";
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
// One switch for an A/B check or rollback of entry-tile speculation only.
const ENTRY_TILE_PREFETCH_ENABLED = true;
const entryPreloaders = new WeakMap<Viewer, AuraEntryTilePreloader>();
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

/** Preserve the base queue; entry tiles use a separate, optional idle task. */
export const preloadAuraPanorama = async (viewer: Viewer, source: string): Promise<void> => {
  const finish = entryPreloaders.get(viewer)?.beginBaseLoad();
  try {
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
  } finally {
    finish?.();
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

type EntryTile = { url: string; key: string };
type SpeculativeFile = EntryTile & { blob: Blob; source: string };
type TourPosition = { yaw: number; pitch: number };
type EntryCamera = Parameters<Viewer["state"]["direction"]["unproject"]>[0] & {
  fov: number; aspect: number; updateProjectionMatrix(): void;
};
type ConnectionHint = { saveData?: boolean; effectiveType?: string; downlink?: number; rtt?: number };
const finite = (value: unknown): number | null =>
  value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
const shortArc = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
const linkAngles = (link: VirtualTourLink) => {
  const position = link.position as Partial<TourPosition> | undefined;
  return { yaw: finite(link.data?.rawYaw ?? position?.yaw), pitch: finite(link.data?.rawPitch ?? position?.pitch) };
};

/**
 * Network-only preparation. No second viewer, image decode or GPU texture is
 * created. A scene gets a fixed request/byte allowance, even if it has 100 links
 * or the visitor repeatedly turns around. Visible loads always stop speculation.
 */
class AuraEntryTilePreloader {
  private readonly files = new Map<string, SpeculativeFile>();
  private activeLoads = 0;
  private baseLoads = 0;
  private gesture = false;
  private closed = false;
  private epoch = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private idle: number | null = null;
  private request: AbortController | null = null;
  private scene = "";
  private spentBytes = 0;
  private attempts = 0;
  private budgetExhausted = false;
  private slowUntil = 0;
  private readonly attempted = new Set<string>();

  constructor(private readonly viewer: Viewer) {
    viewer.addEventListener("panorama-load", this.pause);
    viewer.addEventListener("panorama-loaded", this.pause);
    viewer.addEventListener("transition-done", this.pause);
    viewer.addEventListener("position-updated", this.pause);
    viewer.addEventListener("zoom-updated", this.pause);
    viewer.addEventListener("size-updated", this.pause);
    viewer.container.addEventListener("pointerdown", this.onPointerDown, { capture: true, passive: true });
    window.addEventListener("pointerup", this.onPointerUp, true);
    window.addEventListener("pointercancel", this.onPointerUp, true);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  private limits() {
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: ConnectionHint };
    const connection = nav.connection;
    const mobile = window.matchMedia("(pointer: coarse)").matches || this.viewer.state.size.width < 768;
    const disabled = !ENTRY_TILE_PREFETCH_ENABLED || !Cache.enabled || !!this.viewer.config.requestHeaders ||
      (nav.deviceMemory ?? 4) <= 2 || (nav.hardwareConcurrency || 4) <= 2 ||
      connection?.saveData || /(^|-)2g|3g/.test(connection?.effectiveType ?? "") ||
      (connection?.downlink != null && connection.downlink > 0 && connection.downlink < 1.5) ||
      (connection?.rtt ?? 0) >= 300 || performance.now() < this.slowUntil;
    return { destinations: disabled ? 0 : mobile ? 1 : 2,
      requests: mobile ? 4 : 8, bytes: (mobile ? 1 : 2) * 1024 * 1024 };
  }

  private cancel() {
    this.epoch++;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    if (this.idle !== null) window.cancelIdleCallback(this.idle);
    this.idle = null;
    this.request?.abort();
    this.request = null;
  }

  private readonly pause = () => {
    this.cancel();
    this.schedule();
  };
  private readonly onPointerDown = () => { this.gesture = true; this.pause(); };
  private readonly onPointerUp = () => {
    if (!this.gesture) return;
    this.gesture = false;
    this.pause();
  };
  private readonly onBlur = () => { this.gesture = false; this.pause(); };
  private readonly onVisibility = () => this.pause();

  private schedule() {
    if (this.closed || this.timer !== null || this.idle !== null || this.gesture ||
        document.hidden || this.activeLoads || this.baseLoads || !this.limits().destinations) return;
    // A full quiet interval follows the final visible tile/base load or gesture.
    this.timer = setTimeout(() => {
      this.timer = null;
      const run = () => { this.idle = null; void this.run().catch(() => {}); };
      if ("requestIdleCallback" in window) this.idle = window.requestIdleCallback(run);
      else run();
    }, 1200);
  }

  beginBaseLoad(): () => void {
    this.baseLoads++;
    this.pause();
    return () => { this.baseLoads = Math.max(0, this.baseLoads - 1); this.schedule(); };
  }

  beginVisibleLoad(uncached: boolean): () => void {
    const started = performance.now();
    this.activeLoads++;
    this.pause();
    return () => {
      if (uncached && performance.now() - started > 1200) this.slowUntil = performance.now() + 30000;
      this.activeLoads = Math.max(0, this.activeLoads - 1);
      this.schedule();
    };
  }

  /** Hand an already downloaded blob to the official adapter's normal decoder. */
  claim(url: string, key: string): Blob | null {
    const file = this.files.get(url);
    if (!file || file.key !== key) return null;
    this.files.delete(url);
    return Cache.get(url, key) === file.blob ? file.blob : null;
  }

  private remove(file: SpeculativeFile) {
    if (Cache.get(file.url, file.key) === file.blob) Cache.remove(file.url, file.key);
    this.files.delete(file.url);
  }

  private entry(node: VirtualTourNode, from: VirtualTourNode, link: VirtualTourLink): TourPosition | null {
    const yaw = finite(link.data?.targetYaw);
    const initialYaw = finite(node.data?.initialYaw), initialPitch = finite(node.data?.initialPitch);
    if (yaw !== null) return { yaw, pitch: finite(link.data?.targetPitch) ?? initialPitch ?? 0 };
    const back = node.links?.filter((item) => item.nodeId === from.id) ?? [];
    const reverseYaw = back.length === 1 ? linkAngles(back[0]).yaw : null;
    const departureYaw = linkAngles(link).yaw;
    if (reverseYaw !== null && departureYaw !== null) {
      const position = this.viewer.getPosition();
      return { yaw: reverseYaw + Math.PI + shortArc(position.yaw - departureYaw), pitch: position.pitch };
    }
    return initialYaw !== null && initialPitch !== null ? { yaw: initialYaw, pitch: initialPitch } : null;
  }

  private tiles(resolved: ResolvedSource, position: TourPosition): EntryTile[] {
    const panorama = resolved.panorama;
    if (!resolved.tiled || !panorama.baseUrl || !("levels" in panorama)) return [];
    const { hFov, vFov, size } = this.viewer.state;
    // Same level criterion as the installed official tiles adapter.
    let level = panorama.levels.findIndex((item) =>
      item.width / 360 * hFov >= size.width && item.width / 360 * vFov >= size.height);
    if (level < 0) level = panorama.levels.length - 1;
    const grid = panorama.levels[level];
    const camera = (this.viewer.renderer as unknown as { camera?: EntryCamera }).camera?.clone();
    if (!camera) return [];
    camera.position.set(0, 0, 0);
    camera.fov = vFov;
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();
    camera.lookAt(this.viewer.dataHelper.sphericalCoordsToVector3(position));
    camera.updateMatrixWorld();
    const ray = this.viewer.dataHelper.sphericalCoordsToVector3({ yaw: 0, pitch: 0 });
    const result = new Map<string, EntryTile>();
    // Centre first, then nearby viewport samples. We never prepare the whole sphere.
    for (const [x, y] of [[0,0],[-.45,0],[.45,0],[0,.45],[0,-.45],[-.75,.6],[.75,.6],[-.75,-.6],[.75,-.6]]) {
      ray.set(x, y, .5).unproject(camera).normalize();
      const point = this.viewer.dataHelper.vector3ToSphericalCoords(ray);
      const u = ((point.yaw / (2 * Math.PI) + .5) % 1 + 1) % 1;
      const col = Math.min(grid.cols - 1, Math.floor(u * grid.cols));
      const row = Math.max(0, Math.min(grid.rows - 1, Math.floor((.5 - point.pitch / Math.PI) * grid.rows)));
      const url = panorama.tileUrl(col, row, level);
      if (url) result.set(url, { url, key: panorama.baseUrl });
    }
    return Array.from(result.values());
  }

  private plan(limit: number): { source: string; tiles: EntryTile[] }[] {
    const plugin = this.viewer.getPlugin("virtual-tour") as VirtualTourPlugin | undefined;
    if (!plugin || plugin.config.dataMode !== "client") return [];
    const from = plugin.getCurrentNode();
    if (!from) return [];
    // VirtualTourPlugin removes config.nodes after its own init; the viewer's
    // original client configuration remains the source of our read-only plan.
    const configured = this.viewer.config.plugins?.find(([ctor]) =>
      (ctor as unknown as { id?: string }).id === "virtual-tour")?.[1] as
      { nodes?: VirtualTourNode[] } | undefined;
    const nodes = new Map((plugin.config.nodes ?? configured?.nodes ?? []).map((node) => [node.id, node]));
    const position = this.viewer.getPosition();
    const intentElement = this.viewer.container.querySelector(
      ".aura360-navigation-hotspot__visual[data-aura-feedback], .aura360-navigation-hotspot__visual:focus-visible",
    )?.closest(".psv-virtual-tour-link") as (HTMLElement & { tourLink?: VirtualTourLink }) | null;
    const intent = intentElement?.tourLink;
    const links = (from.links ?? []).map((link) => {
      const { yaw, pitch } = linkAngles(link);
      return { link, score: yaw === null || pitch === null ? Infinity :
        Math.hypot(shortArc(yaw - position.yaw), pitch - position.pitch) };
    }).filter(({ score }) => score < Math.PI / 2).sort((a, b) =>
      Number(b.link === intent) - Number(a.link === intent) || a.score - b.score);
    const plans: { source: string; tiles: EntryTile[] }[] = [];
    const seen = new Set<string>();
    for (const { link } of links) {
      if (plans.length >= limit) break;
      const node = nodes.get(link.nodeId);
      if (!node || typeof node.panorama !== "string" || seen.has(node.panorama) || node.sphereCorrection || node.panoData) continue;
      seen.add(node.panorama);
      const resolved = sources.get(sourceKey(node.panorama))?.value;
      // Reuse only a manifest and preview already prepared by the existing queue.
      // No speculative manifest, original JPG or preview requests are added here.
      if (!resolved?.tiled || !resolved.panorama.baseUrl || !Cache.get(resolved.panorama.baseUrl, resolved.panorama.baseUrl)) continue;
      const entry = this.entry(node, from, link);
      if (entry) plans.push({ source: node.panorama, tiles: this.tiles(resolved, entry) });
    }
    return plans;
  }

  private async run() {
    const limits = this.limits();
    if (this.closed || this.request || !limits.destinations || document.hidden || this.gesture ||
        this.activeLoads || this.baseLoads || !this.viewer.state.ready || this.viewer.state.loadingPromise != null) return;
    const current = typeof this.viewer.config.panorama === "string" ? this.viewer.config.panorama : "";
    const resolvedCurrent = current && sources.get(sourceKey(current))?.value;
    if (!resolvedCurrent || !resolvedCurrent.tiled) return;
    if (this.scene !== current) {
      this.scene = current;
      this.spentBytes = 0; this.attempts = 0; this.budgetExhausted = false; this.attempted.clear();
    }
    if (this.budgetExhausted) return;
    const plans = this.plan(limits.destinations);
    const wanted = new Set(plans.map((plan) => plan.source));
    for (const file of Array.from(this.files.values())) if (!wanted.has(file.source)) this.remove(file);
    const epoch = this.epoch;
    // Round-robin gives each desktop destination its centre before edge tiles.
    for (let index = 0; index < 9; index++) {
      for (const plan of plans) {
        const tile = plan.tiles[index];
        if (!tile || Cache.get(tile.url, tile.key) || this.attempted.has(tile.url)) continue;
        if (this.closed || epoch !== this.epoch || this.activeLoads || this.baseLoads ||
            this.attempts >= limits.requests || this.spentBytes >= limits.bytes) return;
        this.attempts++; this.attempted.add(tile.url);
        const controller = new AbortController();
        this.request = controller;
        const timeout = setTimeout(() => controller.abort(), 1200);
        try {
          const response = await fetch(tile.url, { signal: controller.signal, mode: "cors", credentials: "omit",
            cache: "default", priority: "low" } as RequestInit);
          const remaining = limits.bytes - this.spentBytes;
          const length = Number(response.headers.get("Content-Length"));
          if (!response.ok || !response.body || length > remaining) {
            await response.body?.cancel();
            if (length > remaining) this.budgetExhausted = true;
            else this.slowUntil = performance.now() + 30000;
            return;
          }
          const reader = response.body.getReader();
          const chunks: Uint8Array<ArrayBuffer>[] = [];
          let bytes = 0;
          while (true) {
            const part = await reader.read();
            if (part.done) break;
            this.spentBytes += part.value.byteLength;
            bytes += part.value.byteLength;
            if (bytes > remaining || epoch !== this.epoch) {
              if (bytes > remaining) this.budgetExhausted = true;
              await reader.cancel(); break;
            }
            chunks.push(part.value);
          }
          if (bytes > remaining) return;
          if (controller.signal.aborted || epoch !== this.epoch || bytes < 12) continue;
          const blob = new Blob(chunks, { type: "image/webp" });
          const header = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
          if (String.fromCharCode(...header.slice(0,4)) !== "RIFF" ||
              String.fromCharCode(...header.slice(8,12)) !== "WEBP" || epoch !== this.epoch) continue;
          Cache.add(tile.url, tile.key, blob);
          this.files.set(tile.url, { ...tile, blob, source: plan.source });
          Cache.purge();
        } catch {
          // A slow or failed speculation is optional. The real load can retry normally.
          if (epoch === this.epoch) { this.slowUntil = performance.now() + 30000; return; }
        } finally {
          clearTimeout(timeout);
          if (this.request === controller) this.request = null;
        }
      }
    }
  }

  destroy() {
    this.closed = true;
    this.cancel();
    this.viewer.removeEventListener("panorama-load", this.pause);
    this.viewer.removeEventListener("panorama-loaded", this.pause);
    this.viewer.removeEventListener("transition-done", this.pause);
    this.viewer.removeEventListener("position-updated", this.pause);
    this.viewer.removeEventListener("zoom-updated", this.pause);
    this.viewer.removeEventListener("size-updated", this.pause);
    this.viewer.container.removeEventListener("pointerdown", this.onPointerDown, true);
    window.removeEventListener("pointerup", this.onPointerUp, true);
    window.removeEventListener("pointercancel", this.onPointerUp, true);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onVisibility);
    for (const file of Array.from(this.files.values())) this.remove(file);
  }
}

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
  private readonly entryPreloader: AuraEntryTilePreloader;
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
    let entryPreloader: AuraEntryTilePreloader | undefined;
    let loaderFacade: Viewer["textureLoader"] | undefined;
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
        if (property === "textureLoader" && target.textureLoader) {
          loaderFacade ??= new Proxy(target.textureLoader, {
            get: (loader, method) => {
              if (method === "loadImage") return (url: string, progress: any, key: string) => {
                const cached = Cache.get(url, key);
                const prepared = entryPreloader?.claim(url, key);
                const finish = entryPreloader?.beginVisibleLoad(!cached);
                return loader.loadImage(url, progress, key).catch((error) => {
                  if (!prepared || isAbort(error)) throw error;
                  // A malformed prefetched blob must never poison later scene loads.
                  if (Cache.get(url, key) === prepared) Cache.remove(url, key);
                  return loader.loadImage(url, progress, key);
                }).then((image) => {
                  // Once visible, retain the same decoded-image cache as a
                  // normal tile load, so revisits do not repeatedly decode it.
                  if (prepared && Cache.get(url, key) === prepared) Cache.add(url, key, image);
                  return image;
                }).finally(() => finish?.());
              };
              const value = Reflect.get(loader, method, loader);
              return typeof value === "function" ? value.bind(loader) : value;
            },
          });
          return loaderFacade;
        }
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    // 64 segments cover every grid emitted by the builder. A denser sphere
    // multiplies tiled draw calls without adding photographic detail.
    super(facade, { ...config, resolution: 64, baseBlur: false, showErrorTile: false });
    this.meshSources = meshSources;
    this.actualViewer = viewer;
    this.entryPreloader = entryPreloader = new AuraEntryTilePreloader(viewer);
    entryPreloaders.set(viewer, entryPreloader);
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
    this.entryPreloader.destroy();
    entryPreloaders.delete(this.actualViewer);
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

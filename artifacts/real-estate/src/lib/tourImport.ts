/** Versioned tour catalog produced by aura360_tile_builder_v2.py. */
export type TourImportScene = {
  key: string;
  title: string;
  imageUrl: string;
  thumbnailUrl: string;
  manifestUrl: string;
  sortOrder: number;
  isDefault: boolean;
  width: number;
  height: number;
  sourceSha256: string;
};
export type ExistingImportScene = {
  image_url: string;
  sort_order: number;
  is_default: boolean;
};
export type CheckedImportScene = TourImportScene & {
  status: "ready" | "existing" | "error";
  error?: string;
};
export type TourImportResult = { imported: number; skipped: number };
export type SceneInsertRow = {
  property_id?: string;
  virtual_tour_id?: string;
  title: string;
  image_url: string;
  thumbnail_url: string;
  is_default: boolean;
  sort_order: number;
};

const MAX_SCENES = 1000;
const CATALOG_LIMIT = 2 * 1024 * 1024;
const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const abortError = () => new DOMException("Importimi u anulua.", "AbortError");

export function tourImageKey(value: string): string {
  try {
    const url = new URL(value.trim());
    url.search = "";
    url.hash = "";
    return url.href;
  } catch { return value.trim(); }
}

export function tourCatalogUrl(input: string): string {
  const text = input.trim();
  if (!text) throw new Error("Vendos URL-në e folderit të turit në R2.");
  let url: URL;
  try { url = new URL(text); }
  catch { throw new Error("Vendos URL-në e plotë, duke filluar me https://."); }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) {
    throw new Error("Përdor një URL https:// për folderin e turit.");
  }
  if (url.username || url.password) throw new Error("Përdor URL-në publike të R2, pa kredenciale.");
  url.hash = "";
  if (/\/tour\.json$/i.test(url.pathname)) return url.href;
  if (/\.[a-z0-9]+$/i.test(url.pathname)) throw new Error("Vendos linkun e folderit të turit ose të skedarit tour.json.");
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/tour.json`;
  return url.href;
}

function relativeAsset(value: unknown, catalogUrl: string): string {
  if (typeof value !== "string" || !value || value.startsWith("/") || /[:?#\\]/.test(value)) {
    throw new Error("Katalogu përmban një shteg të pavlefshëm të fotos.");
  }
  for (const part of value.split("/")) {
    let decoded: string;
    try { decoded = decodeURIComponent(part); } catch { throw new Error("Shteg i pavlefshëm në katalog."); }
    if (!decoded || decoded === "." || decoded === ".." || /[\u0000-\u001f/\\]/.test(decoded)) {
      throw new Error("Shtegu i fotos duhet të qëndrojë brenda folderit të turit.");
    }
  }
  const base = new URL(".", catalogUrl);
  const url = new URL(value, base);
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) throw new Error("Shteg jashtë folderit të turit.");
  url.search = new URL(catalogUrl).search;
  return url.href;
}

export function parseTourCatalog(value: unknown, catalogUrl: string): TourImportScene[] {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.type !== "aura360-tour" || !Array.isArray(value.scenes)) {
    throw new Error("Ky nuk është tour.json i AURA360. Gjeneroje me programin Python të përditësuar.");
  }
  if (!value.scenes.length || value.scenes.length > MAX_SCENES) throw new Error(`Katalogu duhet të përmbajë 1–${MAX_SCENES} skena.`);
  const keys = new Set<string>();
  const images = new Set<string>();
  let defaults = 0;
  const scenes = value.scenes.map((item, index): TourImportScene => {
    if (!isRecord(item) || typeof item.id !== "string" || !item.id.trim() || item.id.length > 300 ||
        typeof item.title !== "string" || !item.title.trim() || item.title.length > 200 ||
        typeof item.sortOrder !== "number" || !Number.isInteger(item.sortOrder) || item.sortOrder < 0 ||
        typeof item.isDefault !== "boolean" || typeof item.width !== "number" || !Number.isInteger(item.width) ||
        item.width < 2048 || item.width > 65536 || item.height !== item.width / 2 ||
        typeof item.sourceSha256 !== "string" || !/^[a-f\d]{64}$/i.test(item.sourceSha256)) {
      throw new Error(`Të dhëna të pavlefshme për skenën ${index + 1}.`);
    }
    const imageUrl = relativeAsset(item.imageUrl, catalogUrl);
    if (!/\.(jpe?g|png|webp)$/i.test(new URL(imageUrl).pathname)) throw new Error("Formati i fotos nuk mbështetet.");
    const thumbnailUrl = relativeAsset(item.thumbnailUrl, catalogUrl);
    const manifestUrl = relativeAsset(item.manifestUrl, catalogUrl);
    const expectedManifest = new URL(imageUrl);
    expectedManifest.pathname = expectedManifest.pathname.replace(/\.(jpe?g|png|webp)$/i, "/manifest.json");
    if (manifestUrl !== expectedManifest.href || !/\/(?:thumbnail|preview)\.webp$/i.test(new URL(thumbnailUrl).pathname)) {
      throw new Error(`Shtegu i tiles ose thumbnail-it nuk përputhet për ${item.title}.`);
    }
    if (keys.has(item.id) || images.has(tourImageKey(imageUrl))) throw new Error("Katalogu përmban skena të përsëritura.");
    keys.add(item.id); images.add(tourImageKey(imageUrl));
    if (item.isDefault) defaults++;
    return { key: item.id, title: item.title.trim(), imageUrl, thumbnailUrl, manifestUrl,
      sortOrder: item.sortOrder, isDefault: item.isDefault, width: item.width,
      height: item.height as number, sourceSha256: item.sourceSha256.toLowerCase() };
  });
  if (defaults > 1) throw new Error("Katalogu përmban më shumë se një skenë fillestare.");
  return scenes.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, undefined, { numeric: true }));
}

async function readJson(url: string, parent: AbortSignal, limit: number): Promise<unknown> {
  if (parent.aborted) throw abortError();
  const controller = new AbortController();
  const cancel = () => controller.abort();
  parent.addEventListener("abort", cancel, { once: true });
  let timedOut = false;
  const timer = globalThis.setTimeout(() => { timedOut = true; controller.abort(); }, 15000);
  try {
    const response = await fetch(url, { signal: controller.signal, credentials: "omit", mode: "cors", cache: "no-store" });
    if (!response.ok) throw new Error(response.status === 404
      ? "Skedari nuk u gjet në R2. Ngarko tour.json dhe folderët e plotë që krijon Python."
      : `Leximi nga R2 dështoi (HTTP ${response.status}).`);
    if (Number(response.headers.get("content-length")) > limit) throw new Error("Skedari i katalogut është tepër i madh.");
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > limit) throw new Error("Skedari i katalogut është tepër i madh.");
    try { return JSON.parse(text); } catch { throw new Error("Skedari i lexuar nuk është JSON i vlefshëm."); }
  } catch (error) {
    if (parent.aborted) throw abortError();
    if (timedOut) throw new Error("Leximi zgjati tepër. Kontrollo lidhjen dhe provo përsëri.");
    if (error instanceof TypeError) throw new Error("R2 nuk mund të lexohet. Kontrollo URL-në publike dhe CORS për domenin e platformës.");
    throw error;
  } finally { globalThis.clearTimeout(timer); parent.removeEventListener("abort", cancel); }
}

function validateManifest(value: unknown, scene: TourImportScene): void {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.type !== "aura360-equirectangular-tiled" ||
      value.sourceFile !== decodeURIComponent(new URL(scene.imageUrl).pathname.split("/").pop()!) ||
      value.sourceSha256 !== scene.sourceSha256 || value.originalWidth !== scene.width || value.originalHeight !== scene.height ||
      value.preview !== "preview.webp" || value.tileUrlPattern !== "level{level}/{col}_{row}.webp" ||
      !Array.isArray(value.levels) || !value.levels.length || value.levels.length > 8) {
    throw new Error("Manifesti mungon ose nuk përputhet me katalogun. Ngarko rezultatet nga i njëjti ekzekutim i Python.");
  }
  const power = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0 && (v & (v - 1)) === 0;
  let last = 0;
  for (const [index, level] of value.levels.entries()) {
    if (!isRecord(level) || typeof level.width !== "number" || !Number.isInteger(level.width) || level.width <= last ||
        level.width > 65536 || !power(level.cols) || level.cols > 64 || !power(level.rows) || level.rows !== level.cols / 2 ||
        level.rows > 32 || level.directory !== `level${index}` || level.tileSize !== level.width / level.cols ||
        !Number.isInteger(level.tileSize) || Number(level.tileSize) > 1024 || level.width % 2) {
      throw new Error("Konfigurimi i niveleve të tiles nuk është i vlefshëm.");
    }
    last = level.width;
  }
  if (last !== scene.width) throw new Error("Rezolucioni i tiles nuk përputhet me skenën.");
}

/** Check that base/thumbnail really exist without downloading a full panorama. */
async function checkWebp(url: string, signal: AbortSignal, label: string): Promise<void> {
  if (signal.aborted) throw abortError();
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener("abort", cancel, { once: true });
  const timer = globalThis.setTimeout(cancel, 15000);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await fetch(url, { signal: controller.signal, credentials: "omit", mode: "cors", cache: "no-store" });
    if (!response.ok) { await response.body?.cancel(); throw new Error(`${label} nuk u hap (HTTP ${response.status}). Ngarko skedarin në R2 me emrin e tij origjinal.`); }
    const header = new Uint8Array(12);
    let size = 0;
    if (response.body) {
      reader = response.body.getReader();
      while (size < 12) {
        const chunk = await reader.read();
        if (chunk.done) break;
        const count = Math.min(12 - size, chunk.value.length);
        header.set(chunk.value.subarray(0, count), size); size += count;
      }
    } else {
      const bytes = new Uint8Array(await response.arrayBuffer());
      size = Math.min(bytes.length, 12); header.set(bytes.subarray(0, size));
    }
    if (size < 12 || String.fromCharCode(...header.slice(0, 4)) !== "RIFF" || String.fromCharCode(...header.slice(8, 12)) !== "WEBP") {
      throw new Error(`${label} nuk është foto WebP e vlefshme. Përdor skedarin që krijon Python, pa ia ndërruar prapashtesën.`);
    }
  } catch (error) {
    if (signal.aborted) throw abortError();
    if (error instanceof TypeError) throw new Error(`${label} nuk lexohet. Kontrollo URL-në dhe CORS në R2.`);
    if ((error as Error)?.name === "AbortError") throw new Error(`${label} nuk u ngarkua në kohë.`);
    throw error;
  } finally {
    try { await reader?.cancel(); } catch { /* A closed/aborted stream is already released. */ }
    globalThis.clearTimeout(timer); signal.removeEventListener("abort", cancel);
  }
}

export async function loadTourImport(input: string, options: {
  signal: AbortSignal;
  existingImageUrls?: string[];
  onProgress?: (done: number, total: number) => void;
}): Promise<{ catalogUrl: string; scenes: CheckedImportScene[] }> {
  const catalogUrl = tourCatalogUrl(input);
  const scenes = parseTourCatalog(await readJson(catalogUrl, options.signal, CATALOG_LIMIT), catalogUrl);
  const existing = new Set((options.existingImageUrls || []).map(tourImageKey));
  const results: CheckedImportScene[] = scenes.map((scene) => ({ ...scene, status: existing.has(tourImageKey(scene.imageUrl)) ? "existing" : "ready" }));
  const todo = results.map((scene, i) => scene.status === "existing" ? -1 : i).filter((i) => i >= 0);
  let cursor = 0, done = 0;
  options.onProgress?.(0, todo.length);
  await Promise.all(Array.from({ length: Math.min(4, todo.length) }, async () => {
    while (cursor < todo.length) {
      if (options.signal.aborted) throw abortError();
      const index = todo[cursor++];
      try {
        const scene = results[index];
        validateManifest(await readJson(scene.manifestUrl, options.signal, 128 * 1024), scene);
        const preview = new URL("preview.webp", scene.manifestUrl);
        preview.search = new URL(scene.manifestUrl).search;
        await checkWebp(preview.href, options.signal, "preview.webp");
        await checkWebp(scene.thumbnailUrl, options.signal, "Thumbnail-i");
      }
      catch (error) {
        if (options.signal.aborted) throw abortError();
        results[index] = { ...results[index], status: "error", error: error instanceof Error ? error.message : "Manifesti nuk u lexua." };
      }
      options.onProgress?.(++done, todo.length);
    }
  }));
  return { catalogUrl, scenes: results };
}

/** Prepare one INSERT; append scenes without updating existing scenes/hotspots. */
export function buildTourImportRows(scenes: TourImportScene[], existing: ExistingImportScene[], owner: {
  column: "property_id" | "virtual_tour_id";
  id: string;
}, preferredDefault: string | null): { rows: SceneInsertRow[]; skipped: number } {
  if (!owner.id.trim() || !["property_id", "virtual_tour_id"].includes(owner.column)) throw new Error("Turi nuk është i vlefshëm.");
  if (scenes.length > MAX_SCENES) throw new Error("U zgjodhën tepër skena.");
  const seen = new Set(existing.map((scene) => tourImageKey(scene.image_url)));
  const unique: TourImportScene[] = [];
  let skipped = 0;
  for (const scene of scenes) {
    const key = tourImageKey(scene.imageUrl);
    if (seen.has(key)) { skipped++; continue; }
    if (!scene.title.trim() || scene.title.trim().length > 200) throw new Error("Çdo skenë duhet të ketë një titull deri në 200 karaktere.");
    seen.add(key); unique.push(scene);
  }
  const start = existing.length ? Math.max(...existing.map((scene) => Number.isFinite(scene.sort_order) ? scene.sort_order : 0)) + 1 : 0;
  const defaultKey = unique.find((scene) => scene.key === preferredDefault)?.key || unique[0]?.key;
  return { skipped, rows: unique.map((scene, index) => ({
    [owner.column]: owner.id,
    title: scene.title.trim(), image_url: scene.imageUrl, thumbnail_url: scene.thumbnailUrl,
    sort_order: start + index, is_default: existing.length === 0 && scene.key === defaultKey,
  })) };
}

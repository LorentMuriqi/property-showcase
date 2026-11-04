import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, FolderOpen, Loader2 } from "lucide-react";
import { Description as DialogDescription } from "@radix-ui/react-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  loadTourImport, tourImageKey,
  type CheckedImportScene, type ExistingImportScene, type TourImportResult, type TourImportScene,
} from "@/lib/tourImport";

type Row = CheckedImportScene & { selected: boolean };
type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingScenes: readonly ExistingImportScene[];
  onImport: (scenes: TourImportScene[], defaultKey: string | null) => Promise<TourImportResult>;
};
const errorMessage = (error: unknown, fallback: string) => {
  const message = error && typeof error === "object" && "message" in error ? error.message : null;
  return typeof message === "string" && message ? message : fallback;
};



export function BulkSceneImportDialog({ open, onOpenChange, existingScenes, onImport }: Props) {
  const inputId = useId();
  const radioName = useId();
  const [folderUrl, setFolderUrl] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [preferredDefault, setPreferredDefault] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const controller = useRef<AbortController | null>(null);
  const request = useRef(0);
  const saveLock = useRef(false);
  const mounted = useRef(true);
  const existingKeys = useMemo(() => new Set(existingScenes.map((scene) => tourImageKey(scene.image_url))), [existingScenes]);
  const canSelect = (row: Row) => row.status === "ready" && !existingKeys.has(tourImageKey(row.imageUrl));
  const selected = rows.filter((row) => row.selected && canSelect(row));
  const eligible = rows.filter(canSelect);
  const skipped = rows.filter((row) => row.status === "existing" || existingKeys.has(tourImageKey(row.imageUrl))).length;
  const failed = rows.filter((row) => row.status === "error" && !existingKeys.has(tourImageKey(row.imageUrl))).length;
  const defaultKey = selected.find((row) => row.key === preferredDefault)?.key ?? selected[0]?.key ?? null;
  const invalidTitle = selected.some((row) => !row.title.trim());

  useEffect(() => {
    if (!open) {
      controller.current?.abort(); request.current++;
      setLoading(false); setProgress(null); setError("");
    }
  }, [open]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; controller.current?.abort(); request.current++; };
  }, []);

  const close = () => { if (!saveLock.current) onOpenChange(false); };
  const changeUrl = (value: string) => {
    controller.current?.abort(); request.current++;
    setLoading(false); setProgress(null); setRows([]); setError(""); setFolderUrl(value);
  };
  const readScenes = async () => {
    controller.current?.abort();
    const current = ++request.current;
    const abort = new AbortController(); controller.current = abort;
    setLoading(true); setRows([]); setError(""); setProgress(null);
    try {
      const result = await loadTourImport(folderUrl, {
        signal: abort.signal,
        existingImageUrls: existingScenes.map((scene) => scene.image_url),
        onProgress: (done, total) => { if (request.current === current) setProgress({ done, total }); },
      });
      if (request.current !== current || !mounted.current) return;
      const next = result.scenes.map((scene) => ({ ...scene, selected: scene.status === "ready" }));
      setRows(next);
      setPreferredDefault(next.find((row) => row.selected && row.isDefault)?.key ?? next.find((row) => row.selected)?.key ?? null);
    } catch (err) {
      if (request.current === current && !abort.signal.aborted && mounted.current) {
        setError(errorMessage(err, "Leximi i skenave dështoi."));
      }
    } finally { if (request.current === current && mounted.current) setLoading(false); }
  };
  const move = (index: number, offset: number) => setRows((current) => {
    const next = [...current];
    if (index + offset < 0 || index + offset >= next.length) return current;
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    return next;
  });
  const importScenes = async () => {
    if (saveLock.current || !selected.length || invalidTitle) return;
    saveLock.current = true; setSaving(true); setError("");
    try {
      await onImport(selected.map(({ status: _status, error: _error, selected: _selected, ...scene }) => scene), defaultKey);
      if (mounted.current) { setRows([]); onOpenChange(false); }
    } catch (err) {
      if (mounted.current) setError(errorMessage(err, "Importimi dështoi. Provo përsëri."));
    } finally {
      saveLock.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saveLock.current) onOpenChange(next); }}>
      <DialogContent
        onEscapeKeyDown={(event) => { if (saveLock.current) event.preventDefault(); }}
        onInteractOutside={(event) => { if (saveLock.current) event.preventDefault(); }}
        className="flex w-[calc(100vw-2rem)] max-w-5xl max-h-[90dvh] flex-col gap-0 overflow-hidden border-border bg-card p-0 text-foreground"
      >
        <DialogHeader className="shrink-0 border-b border-border px-5 py-5 sm:px-7">
          <div className="mb-2 flex items-center gap-2 text-primary">
            <FolderOpen size={18} /><span className="text-[11px] font-bold uppercase tracking-[0.16em]">Import në grup</span>
          </div>
          <DialogTitle className="font-display text-xl sm:text-2xl">Shto skenat e turit njëherësh</DialogTitle>
          <DialogDescription className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Vendos linkun e folderit në R2. Titujt, fotot dhe miniaturat lexohen automatikisht;
            ti zgjedh renditjen dhe skenën fillestare.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
          <label htmlFor={inputId} className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Linku i folderit në R2</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id={inputId} type="url" inputMode="url" autoComplete="off" spellCheck={false}
              placeholder="https://media.auraks.com/Clients/CT-000001/"
              value={folderUrl} disabled={saving}
              onChange={(event) => changeUrl(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter" && !loading && !saving && folderUrl.trim()) { event.preventDefault(); void readScenes(); } }}
              className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:opacity-50"
            />
            <button type="button" onClick={() => void readScenes()} disabled={loading || saving || !folderUrl.trim()}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <FolderOpen size={16} />}
              {loading ? "Duke lexuar…" : "Lexo skenat"}
            </button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Ngarko në këtë folder edhe skedarin <span className="font-medium text-foreground">tour.json</span> që krijon programi Python.</p>

          {error && <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/5 p-3 text-sm text-red-600 dark:text-red-300"><AlertTriangle size={17} className="mt-0.5 shrink-0" /><span>{error}</span></div>}
          {loading && <div role="status" aria-live="polite" className="mt-5 flex items-center justify-center gap-3 rounded-2xl border border-border bg-muted/30 px-5 py-10 text-sm text-muted-foreground"><Loader2 size={20} className="animate-spin text-primary" />{progress ? `Po kontrollohen skenat… ${progress.done}/${progress.total}` : "Po lexohet lista e skenave…"}</div>}

          {!loading && rows.length > 0 && <>
            <div className="mb-3 mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-primary/10 px-3 py-1.5 font-semibold text-primary">{selected.length} të zgjedhura</span>
                {skipped > 0 && <span className="rounded-full bg-muted px-3 py-1.5 text-muted-foreground">{skipped} ekzistuese</span>}
                {failed > 0 && <span className="rounded-full bg-red-500/10 px-3 py-1.5 text-red-600 dark:text-red-300">{failed} për kontroll</span>}
              </div>
              <button type="button" disabled={saving || !eligible.length}
                onClick={() => { const choose = selected.length !== eligible.length; setRows((current) => current.map((row) => ({ ...row, selected: canSelect(row) && choose }))); }}
                className="text-xs font-semibold text-primary hover:underline disabled:opacity-50">
                {selected.length === eligible.length ? "Hiq përzgjedhjen" : "Zgjidh të gjitha"}
              </button>
            </div>
            <div className="space-y-2">
              {rows.map((row, index) => {
                const exists = row.status === "existing" || existingKeys.has(tourImageKey(row.imageUrl));
                const enabled = canSelect(row);
                return <div key={row.key} data-scene-key={row.key} className={`grid grid-cols-[20px_64px_minmax(0,1fr)] items-center gap-3 rounded-xl border p-3 sm:grid-cols-[20px_96px_minmax(0,1fr)_auto] ${enabled && row.selected ? "border-primary/35 bg-primary/[0.03]" : "border-border bg-background/50"}`}>
                  <input type="checkbox" aria-label={`Zgjidh skenën ${row.title}`} checked={row.selected && enabled} disabled={saving || !enabled}
                    onChange={(event) => setRows((current) => current.map((item) => item.key === row.key ? { ...item, selected: event.target.checked } : item))}
                    className="h-4 w-4 cursor-pointer accent-primary disabled:cursor-default" />
                  <div className="relative overflow-hidden rounded-lg border border-border bg-muted">
                    <img src={row.thumbnailUrl} alt={`Miniatura ${row.title}`} loading="lazy" decoding="async" className="aspect-[2/1] w-full object-cover"
                      onError={(event) => { const img = event.currentTarget; if (!img.dataset.fallback) { img.dataset.fallback = "1"; img.src = "/tour-thumbnail-placeholder.svg"; } else img.style.visibility = "hidden"; }} />
                  </div>
                  <div className="min-w-0">
                    <input aria-label={`Titulli i skenës ${index + 1}`} value={row.title} maxLength={200} disabled={saving || !enabled}
                      onChange={(event) => setRows((current) => current.map((item) => item.key === row.key ? { ...item, title: event.target.value } : item))}
                      className="w-full min-w-0 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-semibold text-foreground outline-none hover:border-border focus:border-primary focus:bg-background disabled:opacity-65" />
                    <p className="mt-0.5 truncate px-2 text-[11px] text-muted-foreground">{decodeURIComponent(new URL(row.imageUrl).pathname.split("/").pop()!)} · {row.width} × {row.height}</p>
                    {exists ? <p className="mt-1 px-2 text-xs text-muted-foreground">Ekziston në këtë tur; ruhet siç është.</p>
                      : row.status === "error" ? <p className="mt-1 px-2 text-xs leading-relaxed text-red-600 dark:text-red-300">{row.error}</p>
                      : <p className="mt-1 flex items-center gap-1 px-2 text-[11px] text-emerald-600 dark:text-emerald-400"><CheckCircle2 size={12} /> Gati për importim</p>}
                  </div>
                  <div className="col-start-3 flex items-center gap-3 sm:col-start-auto">
                    {existingScenes.length === 0 && <label className={`flex items-center gap-1.5 text-xs ${enabled && row.selected ? "cursor-pointer text-muted-foreground" : "text-muted-foreground/50"}`}>
                      <input type="radio" name={radioName} aria-label={`Skenë fillestare: ${row.title}`} checked={enabled && row.selected && row.key === defaultKey}
                        disabled={saving || !enabled || !row.selected} onChange={() => setPreferredDefault(row.key)} className="h-3.5 w-3.5 accent-primary" /> Fillestare
                    </label>}
                    <div className="flex overflow-hidden rounded-lg border border-border">
                      <button type="button" aria-label={`Zhvendos lart skenën ${row.title}`} disabled={saving || !enabled || index === 0} onClick={() => move(index, -1)} className="p-1.5 hover:bg-muted disabled:opacity-25"><ArrowUp size={14} /></button>
                      <button type="button" aria-label={`Zhvendos poshtë skenën ${row.title}`} disabled={saving || !enabled || index === rows.length - 1} onClick={() => move(index, 1)} className="border-l border-border p-1.5 hover:bg-muted disabled:opacity-25"><ArrowDown size={14} /></button>
                    </div>
                  </div>
                </div>;
              })}
            </div>
            {existingScenes.length > 0 && <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Skenat e reja shtohen pas atyre ekzistuese. Skena fillestare dhe lidhjet aktuale ruhen.</p>}
            {invalidTitle && <p className="mt-3 text-sm text-red-600 dark:text-red-300">Plotëso titullin për çdo skenë të zgjedhur.</p>}
          </>}

          {!loading && !rows.length && !error && <div className="mt-5 rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-9 text-center">
            <FolderOpen size={27} className="mx-auto mb-3 text-primary/70" />
            <p className="text-sm font-medium text-foreground">Një folder. Të gjitha skenat.</p>
            <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">Fotot kryesore dhe thumbnail-et plotësohen vetë. Pas importimit, vendos këndet dhe hotspot-et në editor.</p>
          </div>}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/20 px-5 py-4 sm:px-7">
          <p className="text-xs text-muted-foreground">{rows.length ? `${selected.length} skena do të shtohen në këtë tur.` : "Skenat nuk ruhen derisa të konfirmosh importin."}</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={close} disabled={saving} className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-50">Anulo</button>
            <button type="button" onClick={() => void importScenes()} disabled={saving || loading || !selected.length || invalidTitle}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45">
              {saving && <Loader2 size={15} className="animate-spin" />}{saving ? "Duke importuar…" : `Importo ${selected.length} skena`}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

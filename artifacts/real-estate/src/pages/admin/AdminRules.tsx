import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  Save,
  X,
  Home,
  Focus,
  Eye,
  Check,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

type AdminRole = {
  id: number;
  name: string;
  description: string | null;
  can_view_properties: boolean;
  can_create_property: boolean;
  can_edit_property: boolean;
  can_delete_property: boolean;
  can_manage_property_virtual_tours: boolean;
  can_view_client_virtual_tours: boolean;
  can_manage_client_virtual_tours: boolean;
};

type RoleForm = Omit<AdminRole, "id"> & {
  description: string;
};

const emptyForm: RoleForm = {
  name: "",
  description: "",
  can_view_properties: false,
  can_create_property: false,
  can_edit_property: false,
  can_delete_property: false,
  can_manage_property_virtual_tours: false,
  can_view_client_virtual_tours: false,
  can_manage_client_virtual_tours: false,
};

const permissionChipClass =
  "inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary";

function PermissionToggle({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-xl border border-border bg-background/60 p-3.5 cursor-pointer transition-colors hover:border-primary/30">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className="mt-1 text-xs leading-5 text-muted-foreground">{description}</div>
      </div>

      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span className="h-6 w-11 rounded-full border border-border bg-muted transition-colors peer-checked:border-primary/50 peer-checked:bg-primary/90" />
        <span className="pointer-events-none absolute left-1 top-1 h-4 w-4 rounded-full bg-background shadow-sm transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export default function AdminRules() {
  const { isAdmin, isSuperAdmin, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<RoleForm>(emptyForm);

  useEffect(() => {
    if (authLoading) return;

    if (!isAdmin) {
      setLocation("/admin/login");
      return;
    }

    if (!isSuperAdmin) {
      setLocation("/admin");
    }
  }, [authLoading, isAdmin, isSuperAdmin, setLocation]);

  const fetchRoles = async () => {
    setIsLoading(true);

    const { data, error } = await supabase
      .from("admin_roles")
      .select(
        "id, name, description, can_view_properties, can_create_property, can_edit_property, can_delete_property, can_manage_property_virtual_tours, can_view_client_virtual_tours, can_manage_client_virtual_tours",
      )
      .order("id", { ascending: true });

    if (error) {
      toast({
        title: "Gabim",
        description: "Nuk u ngarkuan rules.",
        variant: "destructive",
      });
      setRoles([]);
    } else {
      setRoles((data || []) as AdminRole[]);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    if (!authLoading && isAdmin && isSuperAdmin) {
      void fetchRoles();
    }
  }, [authLoading, isAdmin, isSuperAdmin]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const setPropertyModuleAccess = (enabled: boolean) => {
    setForm((prev) => ({
      ...prev,
      can_view_properties: enabled,
      ...(!enabled
        ? {
            can_create_property: false,
            can_edit_property: false,
            can_delete_property: false,
            can_manage_property_virtual_tours: false,
          }
        : {}),
    }));
  };

  const setPropertyPermission = (
    field:
      | "can_create_property"
      | "can_edit_property"
      | "can_delete_property"
      | "can_manage_property_virtual_tours",
    enabled: boolean,
  ) => {
    setForm((prev) => ({
      ...prev,
      can_view_properties: enabled ? true : prev.can_view_properties,
      [field]: enabled,
    }));
  };

  const setClientModuleAccess = (enabled: boolean) => {
    setForm((prev) => ({
      ...prev,
      can_view_client_virtual_tours: enabled,
      can_manage_client_virtual_tours: enabled
        ? prev.can_manage_client_virtual_tours
        : false,
    }));
  };

  const setClientManagePermission = (enabled: boolean) => {
    setForm((prev) => ({
      ...prev,
      can_view_client_virtual_tours: enabled
        ? true
        : prev.can_view_client_virtual_tours,
      can_manage_client_virtual_tours: enabled,
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({
        title: "Gabim",
        description: "Emri i rule është i detyrueshëm.",
        variant: "destructive",
      });
      return;
    }

    const normalizedForm = {
      ...form,
      can_view_properties:
        form.can_view_properties ||
        form.can_create_property ||
        form.can_edit_property ||
        form.can_delete_property ||
        form.can_manage_property_virtual_tours,
      can_view_client_virtual_tours:
        form.can_view_client_virtual_tours || form.can_manage_client_virtual_tours,
    };

    try {
      setIsSaving(true);

      const payload = {
        name: normalizedForm.name.trim(),
        description: normalizedForm.description.trim() || null,
        can_view_properties: normalizedForm.can_view_properties,
        can_create_property: normalizedForm.can_create_property,
        can_edit_property: normalizedForm.can_edit_property,
        can_delete_property: normalizedForm.can_delete_property,
        can_manage_property_virtual_tours:
          normalizedForm.can_manage_property_virtual_tours,
        can_view_client_virtual_tours:
          normalizedForm.can_view_client_virtual_tours,
        can_manage_client_virtual_tours:
          normalizedForm.can_manage_client_virtual_tours,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase
          .from("admin_roles")
          .update(payload)
          .eq("id", editingId);

        if (error) throw error;

        toast({
          title: "Sukses",
          description: "Rule u përditësua.",
        });
      } else {
        const { error } = await supabase.from("admin_roles").insert([payload]);

        if (error) throw error;

        toast({
          title: "Sukses",
          description: "Rule u krijua.",
        });
      }

      resetForm();
      await fetchRoles();
    } catch (error: any) {
      toast({
        title: "Gabim",
        description: error.message || "Ruajtja dështoi.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (role: AdminRole) => {
    setEditingId(role.id);
    setForm({
      name: role.name,
      description: role.description || "",
      can_view_properties: !!role.can_view_properties,
      can_create_property: !!role.can_create_property,
      can_edit_property: !!role.can_edit_property,
      can_delete_property: !!role.can_delete_property,
      can_manage_property_virtual_tours:
        !!role.can_manage_property_virtual_tours,
      can_view_client_virtual_tours: !!role.can_view_client_virtual_tours,
      can_manage_client_virtual_tours:
        !!role.can_manage_client_virtual_tours,
    });
  };

  const handleDelete = async (role: AdminRole) => {
    if (!confirm(`A dëshironi ta fshini rule "${role.name}"?`)) return;

    try {
      const { error } = await supabase.from("admin_roles").delete().eq("id", role.id);

      if (error) throw error;

      toast({
        title: "Sukses",
        description: "Rule u fshi.",
      });

      await fetchRoles();
    } catch (error: any) {
      toast({
        title: "Gabim",
        description: error.message || "Fshirja dështoi.",
        variant: "destructive",
      });
    }
  };

  if (authLoading || isLoading) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border p-4 md:p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setLocation("/admin")}
            className="w-10 h-10 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center text-foreground transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground leading-none">
              Rules
            </h1>
            <p className="text-muted-foreground text-xs uppercase tracking-widest mt-1">
              Qasje e ndarë sipas moduleve dhe veprimeve
            </p>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-8 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-8 items-start">
        <div className="glass-panel rounded-2xl overflow-hidden border border-border">
          <div className="p-6 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl text-foreground">Lista e Rule-ve</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Çdo user merr lejet e rule-it që i caktohet te Users.
              </p>
            </div>
          </div>

          <div className="divide-y divide-border">
            {roles.map((role) => {
              const hasPropertyAccess = role.can_view_properties;
              const hasClientAccess = role.can_view_client_virtual_tours;

              return (
                <div
                  key={role.id}
                  className="p-6 flex flex-col md:flex-row md:items-start md:justify-between gap-5"
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="text-foreground font-semibold text-base">{role.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {role.description || "Pa përshkrim"}
                    </p>

                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      <div className="rounded-xl border border-border bg-background/50 p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <Home size={16} className="text-primary" />
                          Properties
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {hasPropertyAccess ? (
                            <>
                              <span className={permissionChipClass}><Eye size={12} /> View</span>
                              {role.can_create_property && <span className={permissionChipClass}>Create</span>}
                              {role.can_edit_property && <span className={permissionChipClass}>Edit</span>}
                              {role.can_delete_property && <span className={permissionChipClass}>Delete</span>}
                              {role.can_manage_property_virtual_tours && <span className={permissionChipClass}>360°</span>}
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">Pa qasje</span>
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border border-border bg-background/50 p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <Focus size={16} className="text-primary" />
                          Client Virtual Tours
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {hasClientAccess ? (
                            <>
                              <span className={permissionChipClass}><Eye size={12} /> View</span>
                              {role.can_manage_client_virtual_tours && (
                                <span className={permissionChipClass}>Manage</span>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">Pa qasje</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleEdit(role)}
                      className="p-2.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground"
                      title="Edito rule"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(role)}
                      className="p-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400"
                      title="Fshi rule"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}

            {roles.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                Nuk ka rules ende.
              </div>
            )}
          </div>
        </div>

        <div className="glass-panel rounded-2xl border border-border p-6 space-y-6 xl:sticky xl:top-28">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl text-foreground">
                {editingId ? "Edito Rule" : "Rule i Ri"}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Aktivizo vetëm qasjet që i duhen këtij roli.
              </p>
            </div>

            {editingId ? (
              <button
                onClick={resetForm}
                className="text-muted-foreground hover:text-foreground"
                title="Anulo editimin"
              >
                <X size={18} />
              </button>
            ) : (
              <Plus size={18} className="text-primary" />
            )}
          </div>

          <div className="space-y-4">
            <input
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, name: event.target.value }))
              }
              placeholder="Emri i rule"
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary"
            />

            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, description: event.target.value }))
              }
              placeholder="Përshkrimi"
              rows={3}
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground resize-none focus:outline-none focus:border-primary"
            />

            <section className="rounded-2xl border border-border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center gap-3 pb-1">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Home size={17} />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Properties</h3>
                  <p className="text-xs text-muted-foreground">Qasje dhe veprime mbi pronat.</p>
                </div>
              </div>

              <PermissionToggle
                checked={form.can_view_properties}
                onChange={setPropertyModuleAccess}
                title="Qasje në Properties"
                description="Mund ta hapë modulin dhe t'i shohë pronat në admin."
              />
              <PermissionToggle
                checked={form.can_create_property}
                onChange={(enabled) => setPropertyPermission("can_create_property", enabled)}
                title="Krijo prona"
                description="Mund të krijojë dhe publikojë prona të reja."
              />
              <PermissionToggle
                checked={form.can_edit_property}
                onChange={(enabled) => setPropertyPermission("can_edit_property", enabled)}
                title="Edito prona"
                description="Mund të ndryshojë të dhënat, statusin dhe skadimin e pronave."
              />
              <PermissionToggle
                checked={form.can_delete_property}
                onChange={(enabled) => setPropertyPermission("can_delete_property", enabled)}
                title="Fshi prona"
                description="Mund të fshijë përgjithmonë një pronë dhe të dhënat e lidhura."
              />
              <PermissionToggle
                checked={form.can_manage_property_virtual_tours}
                onChange={(enabled) =>
                  setPropertyPermission("can_manage_property_virtual_tours", enabled)
                }
                title="Menaxho Tur 360° të pronave"
                description="Mund të menaxhojë skena, hotspot-e dhe publikimin e turit 360° të pronës."
              />
            </section>

            <section className="rounded-2xl border border-border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center gap-3 pb-1">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Focus size={17} />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Client Virtual Tours</h3>
                  <p className="text-xs text-muted-foreground">Turet private të klientëve.</p>
                </div>
              </div>

              <PermissionToggle
                checked={form.can_view_client_virtual_tours}
                onChange={setClientModuleAccess}
                title="Qasje në Client Virtual Tours"
                description="Mund ta hapë modulin, të shohë listën dhe linkun publik të tureve."
              />
              <PermissionToggle
                checked={form.can_manage_client_virtual_tours}
                onChange={setClientManagePermission}
                title="Menaxho Client Virtual Tours"
                description="Mund të krijojë, editojë, aktivizojë, pezullojë dhe fshijë ture private."
              />
            </section>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-5 text-muted-foreground">
              <div className="flex items-start gap-2">
                <Check size={14} className="mt-0.5 shrink-0 text-primary" />
                <span>
                  Lejet e veprimeve aktivizojnë automatikisht qasjen bazë në modulin përkatës.
                  Çaktivizimi i qasjes bazë çaktivizon edhe veprimet e atij moduli.
                </span>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-white hover:text-foreground transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Save size={16} />
              {isSaving ? "Duke ruajtur..." : editingId ? "Ruaj Ndryshimet" : "Krijo Rule"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

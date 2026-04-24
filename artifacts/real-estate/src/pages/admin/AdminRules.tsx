import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Plus, Pencil, Trash2, ArrowLeft, Save, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

type AdminRole = {
  id: number;
  name: string;
  description: string | null;
  can_create_property: boolean;
  can_edit_property: boolean;
  can_delete_property: boolean;
  can_manage_virtual_tours: boolean;
};

const emptyForm = {
  name: "",
  description: "",
  can_create_property: false,
  can_edit_property: false,
  can_delete_property: false,
  can_manage_virtual_tours: false,
};

export default function AdminRules() {
  const { isAdmin, isSuperAdmin, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

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
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      toast({
        title: "Gabim",
        description: "Nuk u ngarkuan rules.",
        variant: "destructive",
      });
      setRoles([]);
    } else {
      setRoles(data || []);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    if (!authLoading && isAdmin && isSuperAdmin) {
      fetchRoles();
    }
  }, [authLoading, isAdmin, isSuperAdmin]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
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

    try {
      setIsSaving(true);

      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        can_create_property: form.can_create_property,
        can_edit_property: form.can_edit_property,
        can_delete_property: form.can_delete_property,
        can_manage_virtual_tours: form.can_manage_virtual_tours,
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
      fetchRoles();
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
      can_create_property: role.can_create_property,
      can_edit_property: role.can_edit_property,
      can_delete_property: role.can_delete_property,
      can_manage_virtual_tours: role.can_manage_virtual_tours,
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

      fetchRoles();
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
              Menaxho akseset e userave
            </p>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-panel rounded-2xl overflow-hidden border border-border">
          <div className="p-6 border-b border-border flex items-center justify-between">
            <h2 className="font-display text-xl text-foreground">Lista e Rule-ve</h2>
          </div>

          <div className="divide-y divide-border">
            {roles.map((role) => (
              <div key={role.id} className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h3 className="text-foreground font-semibold">{role.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {role.description || "Pa përshkrim"}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {role.can_create_property && <span className="px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">Create</span>}
                    {role.can_edit_property && <span className="px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">Edit</span>}
                    {role.can_delete_property && <span className="px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">Delete</span>}
                    {role.can_manage_virtual_tours && <span className="px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">Virtual Tours</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(role)}
                    className="p-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(role)}
                    className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}

            {roles.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                Nuk ka rules ende.
              </div>
            )}
          </div>
        </div>

        <div className="glass-panel rounded-2xl border border-border p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl text-foreground">
              {editingId ? "Edito Rule" : "Rule i Ri"}
            </h2>

            {editingId ? (
              <button onClick={resetForm} className="text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>
            ) : (
              <Plus size={18} className="text-primary" />
            )}
          </div>

          <div className="space-y-4">
            <input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Emri i rule"
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground"
            />

            <textarea
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Përshkrimi"
              rows={3}
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground resize-none"
            />

            <label className="flex items-center gap-3 text-foreground">
              <input
                type="checkbox"
                checked={form.can_create_property}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, can_create_property: e.target.checked }))
                }
              />
              Mund të shtojë prona
            </label>

            <label className="flex items-center gap-3 text-foreground">
              <input
                type="checkbox"
                checked={form.can_edit_property}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, can_edit_property: e.target.checked }))
                }
              />
              Mund të editojë prona
            </label>

            <label className="flex items-center gap-3 text-foreground">
              <input
                type="checkbox"
                checked={form.can_delete_property}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, can_delete_property: e.target.checked }))
                }
              />
              Mund të fshijë prona
            </label>

            <label className="flex items-center gap-3 text-foreground">
              <input
                type="checkbox"
                checked={form.can_manage_virtual_tours}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, can_manage_virtual_tours: e.target.checked }))
                }
              />
              Mund të menaxhojë virtual tours
            </label>

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
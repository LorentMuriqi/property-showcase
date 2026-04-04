import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Save, UserCog } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

type AdminUser = {
  user_id: string;
  username: string;
  full_name: string | null;
  is_super_admin: boolean;
  is_active: boolean;
  role_id: number | null;
};

type AdminRole = {
  id: number;
  name: string;
};

export default function AdminUsers() {
  const { isAdmin, isSuperAdmin, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

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

  const fetchData = async () => {
    setIsLoading(true);

    const [{ data: usersData, error: usersError }, { data: rolesData, error: rolesError }] =
      await Promise.all([
        supabase
          .from("admin_users")
          .select("user_id, username, full_name, is_super_admin, is_active, role_id")
          .order("created_at", { ascending: false }),
        supabase.from("admin_roles").select("id, name").order("id", { ascending: true }),
      ]);

    if (usersError || rolesError) {
      toast({
        title: "Gabim",
        description: "Nuk u ngarkuan users ose rules.",
        variant: "destructive",
      });
      setUsers([]);
      setRoles([]);
    } else {
      setUsers(usersData || []);
      setRoles(rolesData || []);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    if (!authLoading && isAdmin && isSuperAdmin) {
      fetchData();
    }
  }, [authLoading, isAdmin, isSuperAdmin]);

  const handleUpdateUser = async (user: AdminUser) => {
    try {
      setSavingId(user.user_id);

      const { error } = await supabase
        .from("admin_users")
        .update({
          role_id: user.role_id,
          is_active: user.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.user_id);

      if (error) throw error;

      toast({
        title: "Sukses",
        description: "User u përditësua.",
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: "Gabim",
        description: error.message || "Përditësimi dështoi.",
        variant: "destructive",
      });
    } finally {
      setSavingId(null);
    }
  };

  if (authLoading || isLoading) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-white/5 p-4 md:p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setLocation("/admin")}
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-display text-2xl font-bold text-white leading-none">
              Users
            </h1>
            <p className="text-muted-foreground text-xs uppercase tracking-widest mt-1">
              Menaxho përdoruesit e panelit
            </p>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-8">
        <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
          <div className="p-6 border-b border-white/5 flex items-center gap-3">
            <UserCog size={20} className="text-primary" />
            <h2 className="font-display text-xl text-white">Lista e Userave</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="p-4 font-medium">Username</th>
                  <th className="p-4 font-medium">Emri</th>
                  <th className="p-4 font-medium">Lloji</th>
                  <th className="p-4 font-medium">Rule</th>
                  <th className="p-4 font-medium">Aktiv</th>
                  <th className="p-4 font-medium text-right">Ruaj</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map((user) => (
                  <tr key={user.user_id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4 text-white font-medium">{user.username}</td>
                    <td className="p-4 text-muted-foreground">{user.full_name || "-"}</td>
                    <td className="p-4">
                      {user.is_super_admin ? (
                        <span className="px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">
                          Super Admin
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs bg-white/10 text-white/80">
                          User
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      {user.is_super_admin ? (
                        <span className="text-muted-foreground text-sm">Full Access</span>
                      ) : (
                        <select
                          value={user.role_id ?? ""}
                          onChange={(e) => {
                            const value = e.target.value ? Number(e.target.value) : null;
                            setUsers((prev) =>
                              prev.map((u) =>
                                u.user_id === user.user_id ? { ...u, role_id: value } : u,
                              ),
                            );
                          }}
                          className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white"
                        >
                          <option value="">Pa Rule</option>
                          {roles.map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="p-4">
                      {user.is_super_admin ? (
                        <span className="text-primary text-sm">Po</span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={user.is_active}
                          onChange={(e) => {
                            setUsers((prev) =>
                              prev.map((u) =>
                                u.user_id === user.user_id
                                  ? { ...u, is_active: e.target.checked }
                                  : u,
                              ),
                            );
                          }}
                        />
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {!user.is_super_admin && (
                        <button
                          onClick={() => handleUpdateUser(user)}
                          disabled={savingId === user.user_id}
                          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-white transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                        >
                          <Save size={14} />
                          {savingId === user.user_id ? "Duke ruajtur..." : "Ruaj"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}

                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      Nuk ka users ende.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
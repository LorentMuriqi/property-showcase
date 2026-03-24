import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Plus, Edit, Trash2, Home, ExternalLink, Focus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

export default function AdminDashboard() {
  const { isAdmin, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!isAdmin) setLocation("/admin/login");
  }, [isAdmin, setLocation]);

  useEffect(() => {
    const fetchProjects = async () => {
      if (!isAdmin) return;

      setIsLoading(true);

      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Admin fetch error:", error);
        toast({
          title: "Gabim",
          description: "Nuk u ngarkuan pronat.",
          variant: "destructive",
        });
        setProjects([]);
      } else {
        setProjects(data || []);
      }

      setIsLoading(false);
    };

    fetchProjects();
  }, [isAdmin, toast]);

  const handleDelete = async (id: number | string, title: string) => {
    if (confirm(`A jeni i sigurt që dëshironi të fshini përgjithmonë "${title}"?`)) {
      try {
        setIsDeleting(true);

        const { error } = await supabase
          .from("properties")
          .delete()
          .eq("id", id);

        if (error) throw error;

        setProjects((prev) => prev.filter((project) => project.id !== id));

        toast({
          title: "Projekti u Fshi",
          description: "Prona është hequr.",
        });
      } catch (err) {
        console.error("Delete error:", err);
        toast({
          title: "Gabim",
          description: "Dështoi fshirja e projektit.",
          variant: "destructive",
        });
      } finally {
        setIsDeleting(false);
      }
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 glass-panel border-r border-white/5 flex flex-col hidden md:flex h-screen sticky top-0">
        <div className="p-6 border-b border-white/5">
          <span className="font-display text-xl font-bold tracking-wider text-white">
            AURA<span className="font-sans font-light text-muted-foreground ml-2 text-xs tracking-widest uppercase">Admin</span>
          </span>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Link href="/admin" className="flex items-center gap-3 px-4 py-3 bg-primary/10 text-primary rounded-xl font-medium">
            <Home size={18} /> Paneli Administrativ
          </Link>
          <Link href="/" className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-white hover:bg-white/5 rounded-xl font-medium transition-colors">
            <ExternalLink size={18} /> Shiko Faqen
          </Link>
        </nav>
        <div className="p-4 border-t border-white/5">
          <button onClick={logout} className="w-full py-3 text-destructive border border-destructive/20 hover:bg-destructive hover:text-white rounded-xl font-medium transition-colors">
            Dalje
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        
        {/* Mobile Header */}
        <div className="md:hidden flex justify-between items-center mb-6 glass-panel p-4 rounded-2xl">
          <span className="font-display text-xl font-bold text-white">AURA Admin</span>
          <button onClick={logout} className="text-destructive text-sm font-medium">Dalje</button>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="font-display text-3xl text-white font-bold">Portofoli i Pronave</h1>
            <p className="text-muted-foreground mt-1">Menaxho listimet dhe turet virtuale.</p>
          </div>
          <Link 
            href="/admin/projects/new"
            className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold tracking-widest uppercase text-sm rounded-xl hover:bg-white transition-colors"
          >
            <Plus size={18} /> Projekt i Ri
          </Link>
        </div>

        {isLoading ? (
          <div className="glass-panel rounded-2xl p-8 text-center animate-pulse text-muted-foreground">
            Duke ngarkuar të dhënat e portofolit...
          </div>
        ) : (
          <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-black/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="p-4 font-medium">Prona</th>
                    <th className="p-4 font-medium">Vendndodhja</th>
                    <th className="p-4 font-medium">Statusi</th>
                    <th className="p-4 font-medium">Çmimi</th>
                    <th className="p-4 font-medium text-right">Veprimet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {projects.map((project) => {
                    const statusLabels: Record<string, string> = {
                      for_sale: "Në Shitje",
                      sold: "Shitur",
                      rented: "Dhënë me Qira",
                      for_rent: "Me Qira",
                    };

                    return (
                    <tr key={project.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg bg-card overflow-hidden shrink-0">
                            {project.images?.[0] ? (
                              <img src={project.images[0].url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-white/5 flex items-center justify-center text-[10px] text-muted-foreground">S'ka Foto</div>
                            )}
                          </div>
                          <span className="font-medium text-white max-w-[200px] truncate">{project.title}</span>
                        </div>
                      </td>
                      <td className="p-4 text-muted-foreground text-sm">
                        {project.city}, {project.country}
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-1 rounded text-xs border border-white/10 text-white/70 uppercase tracking-wider">
                          {statusLabels[project.status]}
                        </span>
                      </td>
                      <td className="p-4 text-primary font-medium text-sm">
                        {project.price ? new Intl.NumberFormat("en-US", { notation: "compact", compactDisplay: "short" }).format(project.price) : "-"}
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <Link href={`/admin/projects/${project.id}/virtual-tour`}>
                          <button className="p-2 text-primary hover:text-white bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors inline-flex" title="Menaxho Turin Virtual">
                            <Focus size={16} />
                          </button>
                        </Link>
                        <Link href={`/admin/projects/${project.id}/edit`}>
                          <button className="p-2 text-muted-foreground hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors inline-flex">
                            <Edit size={16} />
                          </button>
                        </Link>
                        <button 
                          onClick={() => handleDelete(project.id, project.title)}
                          disabled={isDeleting}
                          className="p-2 text-destructive hover:text-white bg-destructive/10 hover:bg-destructive rounded-lg transition-colors inline-flex"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  )})}
                  {projects.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">
                        Asnjë pronë nuk u gjet. Shto listimin tënd të parë.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
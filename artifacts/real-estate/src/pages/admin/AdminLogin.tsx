import { useState } from "react";
import { useLocation } from "wouter";
import { Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function usernameToEmail(username: string) {
  return `${normalizeUsername(username)}@admin.local`;
}

export default function AdminLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalized = normalizeUsername(username);

    if (!normalized || !password) {
      toast({
        title: "Gabim",
        description: "Shkruaj username dhe password.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      const { error } = await supabase.auth.signInWithPassword({
        email: usernameToEmail(normalized),
        password,
      });

      if (error) {
        toast({
          title: "Hyrja u Refuzua",
          description: "Username ose password i pasaktë.",
          variant: "destructive",
        });
        return;
      }

      setLocation("/admin");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md glass-panel p-10 rounded-3xl border border-border relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />

        <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-8 text-primary shadow-[0_0_30px_rgba(212,175,55,0.2)]">
          <Shield size={32} />
        </div>

        <h1 className="font-display text-3xl font-bold text-foreground text-center mb-2">
          Hyrja e Sigurt
        </h1>
        <p className="text-muted-foreground text-center mb-8">
          Vetëm për personelin e autorizuar.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-4 py-4 text-foreground focus:outline-none focus:border-primary transition-colors text-center text-lg"
              placeholder="admin"
              autoFocus
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-4 py-4 text-foreground focus:outline-none focus:border-primary transition-colors text-center text-xl tracking-widest font-mono"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 bg-primary text-primary-foreground font-bold tracking-widest uppercase text-sm rounded-xl hover:bg-white hover:text-foreground transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "Duke hyrë..." : "Hyr"}
          </button>
        </form>

        <button
          onClick={() => setLocation("/")}
          className="w-full mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Kthehu në faqen publike
        </button>
      </div>
    </div>
  );
}
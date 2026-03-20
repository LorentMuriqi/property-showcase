import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(password)) {
      setLocation("/admin");
    } else {
      toast({
        title: "Access Denied",
        description: "Incorrect password provided.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md glass-panel p-10 rounded-3xl border border-white/10 relative overflow-hidden">
        
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />
        
        <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-8 text-primary shadow-[0_0_30px_rgba(212,175,55,0.2)]">
          <Shield size={32} />
        </div>

        <h1 className="font-display text-3xl font-bold text-white text-center mb-2">Secure Gateway</h1>
        <p className="text-muted-foreground text-center mb-8">Authorized personnel only.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-white/70 uppercase tracking-wider mb-2">Access Key</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-primary transition-colors text-center text-xl tracking-widest font-mono"
              placeholder="••••••••"
              autoFocus
            />
          </div>
          <button 
            type="submit" 
            className="w-full py-4 bg-primary text-primary-foreground font-bold tracking-widest uppercase text-sm rounded-xl hover:bg-white transition-colors"
          >
            Authenticate
          </button>
        </form>
        
        <button 
          onClick={() => setLocation("/")}
          className="w-full mt-6 text-sm text-muted-foreground hover:text-white transition-colors"
        >
          Return to public site
        </button>
      </div>
    </div>
  );
}

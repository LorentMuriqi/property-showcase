import { Layout } from "@/components/Layout";
import { Mail, MapPin, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Contact() {
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Kërkesa u Pranua",
      description: "Një nga specialistët tanë të pronave të luksit do t'ju kontaktojë së shpejti.",
    });
    (e.target as HTMLFormElement).reset();
  };

  return (
    <Layout>
      <div className="bg-background min-h-screen pt-32 pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="mb-16 text-center max-w-3xl mx-auto">
            <h1 className="font-display text-5xl font-bold text-white mb-6"><span className="text-primary italic">Konsultim</span> Privat</h1>
            <p className="text-muted-foreground text-lg">
              Lidhuni me këshilltarët tanë të dedikuar për një diskutim konfidencial në lidhje me portofolin tuaj të pasurive të paluajtshme.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            {/* Contact Info */}
            <div className="space-y-12">
              <div className="glass-panel p-10 rounded-2xl">
                <h3 className="price-font text-2xl text-white mb-8">Selia Globale</h3>
                <div className="space-y-8">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <MapPin size={24} />
                    </div>
                    <div>
                      <h4 className="price-font text-white font-medium mb-1">Zyra</h4>
                      <p className="price-font text-muted-foreground">100 Luxury Way, Suite 500<br/>Beverly Hills, CA 90210<br/>Shtetet e Bashkuara</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Phone size={24} />
                    </div>
                    <div>
                      <h4 className="price-font text-white font-medium mb-1">Linja Direkte</h4>
                      <p className="price-font text-muted-foreground">+1 (310) 555-0198</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Mail size={24} />
                    </div>
                    <div>
                      <h4 className="price-font text-white font-medium mb-1">Email-i</h4>
                      <p className="price-font text-muted-foreground">discover@auraestates.com</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="glass-panel p-10 rounded-2xl">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/70 uppercase tracking-wider">Emri</label>
                    <input required type="text" className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/70 uppercase tracking-wider">Mbiemri</label>
                    <input required type="text" className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/70 uppercase tracking-wider">Adresa e Email-it</label>
                  <input required type="email" className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors" />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/70 uppercase tracking-wider">Natyra e Kërkesës</label>
                  <select className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary appearance-none">
                    <option>Blerje e një prone</option>
                    <option>Shitje e një prone</option>
                    <option>Shërbime të Turit Virtual</option>
                    <option>Kërkesë e Përgjithshme</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/70 uppercase tracking-wider">Mesazhi</label>
                  <textarea required rows={4} className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors resize-none"></textarea>
                </div>

                <button type="submit" className="w-full py-4 bg-primary text-primary-foreground font-bold tracking-widest uppercase text-sm rounded-xl hover:bg-white transition-colors mt-4">
                  Dërgo Kërkesën
                </button>
              </form>
            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
}

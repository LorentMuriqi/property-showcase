import { Layout } from "@/components/Layout";
import { motion } from "framer-motion";

export default function About() {
  return (
    <Layout>
      <div className="bg-background min-h-screen">
        {/* Header */}
        <section className="relative h-[60vh] flex items-center justify-center">
          <div className="absolute inset-0 z-0">
            <img 
              src={`${import.meta.env.BASE_URL}images/about-bg.png`} 
              alt="Abstract background" 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/35" />
          </div>
          <div className="relative z-10 text-center px-4">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-display text-5xl md:text-7xl font-bold text-white mb-6 leading-[1.2] overflow-visible"
            >
The Art of{" "}
<span className="italic text-[#D4AF37]">
  Living
</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-xl text-white/70 max-w-2xl mx-auto font-light"
            >
              Elevating the standard of luxury real estate through innovation, exclusivity, and profound expertise.
            </motion.p>
          </div>
        </section>

        {/* Content */}
        <section className="py-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-16">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="font-display text-3xl text-primary mb-6">Qasja Jonë</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Në Aura Estates, një pronë është më shumë se një hapësirë, është një përjetim.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Ne specializohemi në prezantimin e pronave premium përmes teknologjisë moderne, duke përfshirë ture virtuale 360°, që u mundësojnë klientëve të eksplorojnë çdo detaj nga kudo në botë.
                </p>
              </div>
              <div className="aspect-square bg-card rounded-2xl border border-border p-8 flex flex-col justify-center text-center">
                <span className="font-display text-6xl text-primary block mb-4">15+</span>
                <span className="text-foreground tracking-widest uppercase text-sm">Vite Ekselencë</span>
              </div>
            </div>

<div className="border-t border-border pt-16">
  <h2 className="font-display text-3xl text-foreground mb-8 text-center">Eksperienca Virtuale</h2>
              <p className="text-muted-foreground leading-relaxed text-center max-w-3xl mx-auto">
                Ne jemi pionierë në përdorimin e teknologjisë së avancuar të tureve virtuale 360°, duke i lejuar klientëve kërkues të eksplorojnë prona madhështore nga kudo në botë me një realizëm të paprecedentë. Kjo qasje digjitale siguron që blerësit globalë të përjetojnë thelbin e vërtetë të një prone përpara se të shkelin fizikisht në të.
              </p>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}

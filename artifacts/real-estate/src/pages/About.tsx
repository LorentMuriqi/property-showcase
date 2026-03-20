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
            <div className="absolute inset-0 bg-background/80" />
          </div>
          <div className="relative z-10 text-center px-4">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-display text-5xl md:text-7xl font-bold text-white mb-6"
            >
              The Art of <span className="text-gold-gradient italic">Living</span>
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
                <h2 className="font-display text-3xl text-primary mb-6">Our Philosophy</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  At Aura Estates, we believe that a home is more than a physical space—it is the ultimate expression of personal achievement and aesthetic sensibility. 
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Founded on the principles of absolute discretion and uncompromising quality, we represent only the most exceptional properties across the globe.
                </p>
              </div>
              <div className="aspect-square bg-card rounded-2xl border border-white/5 p-8 flex flex-col justify-center text-center">
                <span className="font-display text-6xl text-primary block mb-4">15+</span>
                <span className="text-white tracking-widest uppercase text-sm">Years of Excellence</span>
              </div>
            </div>

            <div className="border-t border-white/10 pt-16">
              <h2 className="font-display text-3xl text-white mb-8 text-center">The Virtual Experience</h2>
              <p className="text-muted-foreground leading-relaxed text-center max-w-3xl mx-auto">
                We pioneer the use of advanced 360° virtual tour technology, allowing discerning clients to explore magnificent properties from anywhere in the world with unprecedented realism. This digital-first approach ensures that global buyers can experience the true essence of a property before stepping foot on the grounds.
              </p>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}

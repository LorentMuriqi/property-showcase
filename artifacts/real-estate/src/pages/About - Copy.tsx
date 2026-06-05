import { Layout } from "@/components/Layout";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";


function VirtualTourOrbCard() {
  const hotspots = [
    { top: "24%", left: "28%", delay: 0 },
    { top: "34%", right: "23%", delay: 0.35 },
    { bottom: "30%", left: "24%", delay: 0.7 },
    { bottom: "23%", right: "30%", delay: 1.05 },
  ];

  return (
    <div className="relative aspect-square bg-card rounded-2xl border border-border overflow-hidden flex items-center justify-center transform-gpu">
      {/* Soft premium glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.18),transparent_42%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(212,175,55,0.06)_50%,transparent_100%)]" />

      {/* Minimal room/grid perspective */}
      <div className="absolute inset-10 rounded-2xl border border-primary/10" />
      <div className="absolute left-10 right-10 top-1/2 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      <div className="absolute top-10 bottom-10 left-1/2 w-px bg-gradient-to-b from-transparent via-primary/20 to-transparent" />

<motion.div
  className="absolute w-[78%] h-[78%] rounded-full border border-primary/15 will-change-transform"
  style={{ transform: "translateZ(0)" }}
  animate={{ rotate: 360 }}
  transition={{ duration: 48, repeat: Infinity, ease: "linear" }}
/>

<motion.div
  className="absolute w-[58%] h-[58%] rounded-full border border-primary/20 border-dashed will-change-transform"
  style={{ transform: "translateZ(0)" }}
  animate={{ rotate: -360 }}
  transition={{ duration: 42, repeat: Infinity, ease: "linear" }}
/>

      <motion.div
        className="absolute w-[38%] h-[38%] rounded-full border border-primary/30"
        animate={{ scale: [1, 1.05, 1], opacity: [0.45, 0.85, 0.45] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Radar scan */}
<motion.div
  className="absolute w-px h-[32%] bg-gradient-to-b from-primary/60 via-primary/20 to-transparent origin-bottom will-change-transform"
  style={{
    bottom: "50%",
    transform: "translateZ(0)",
  }}
  animate={{ rotate: 360 }}
  transition={{
    duration: 14,
    repeat: Infinity,
    ease: "linear",
  }}
/>

      {/* Hotspots */}
{hotspots.map((hotspot, index) => (
  <motion.div
    key={index}
    className="absolute will-change-transform"
    style={hotspot}
    animate={{ scale: [1, 1.08, 1], opacity: [0.72, 1, 0.72] }}
    transition={{
      duration: 3.8,
      repeat: Infinity,
      ease: "easeInOut",
      delay: hotspot.delay,
    }}
  >
    <motion.span
      className="absolute -inset-2 rounded-full bg-primary/20"
      animate={{ scale: [0.7, 1.45, 0.7], opacity: [0, 0.42, 0] }}
      transition={{
        duration: 3.8,
        repeat: Infinity,
        ease: "easeInOut",
        delay: hotspot.delay,
      }}
    />
    <div className="relative w-3 h-3 rounded-full bg-primary shadow-[0_0_18px_rgba(212,175,55,0.65)]" />
  </motion.div>
))}

      {/* Main orb */}
<motion.div
  className="relative z-10 w-36 h-36 rounded-full border border-primary/40 bg-background/70 backdrop-blur-xl shadow-[0_24px_80px_rgba(212,175,55,0.18)] flex flex-col items-center justify-center will-change-transform"
  style={{ transform: "translateZ(0)" }}
  animate={{ y: [0, -5, 0] }}
  transition={{ duration: 7.5, repeat: Infinity, ease: "easeInOut" }}
>
        <motion.div
          className="absolute inset-3 rounded-full border border-primary/15"
          animate={{ rotate: 360 }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
        />

<span className="text-primary text-4xl md:text-5xl font-bold tracking-tight leading-none">
  360°
</span>
        <span className="mt-3 text-[10px] uppercase tracking-[0.34em] text-foreground">
          Virtual Tour
        </span>
      </motion.div>

      {/* Bottom label */}
<div className="absolute bottom-7 left-1/2 -translate-x-1/2 text-center">
  <p className="text-[9px] uppercase tracking-[0.34em] text-muted-foreground/80 whitespace-nowrap">
    Immersive Preview
  </p>
</div>
    </div>
  );
}

export default function About() {
  return (
    <Layout>
	<Helmet>
  <title>Rreth Nesh | Aura Estates</title>
  <meta name="description" content="Mëso më shumë rreth Aura Estates — agjencia juaj e besuar për prona ekskluzive me ture virtuale 360° në Kosovë." />
  <meta property="og:title" content="Rreth Nesh | Aura Estates" />
  <meta property="og:url" content="https://auraks.com/about" />
</Helmet>
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
			  
<VirtualTourOrbCard />
            </div>

<div className="border-t border-border pt-16">
  <h2 className="font-display text-3xl text-foreground mb-8 text-center">Eksperienca Virtuale</h2>
              <p className="text-muted-foreground leading-relaxed text-center max-w-3xl mx-auto">
Përmes teknologjisë së avancuar të tureve virtuale 360°, ne prezantojmë pronat me një qartësi dhe standard të lartë profesional.
Kjo u jep mundësi klientëve të eksplorojnë çdo hapësirë nga kudo në botë, duke krijuar një përjetim të plotë përpara një vizite fizike.       
				</p>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}

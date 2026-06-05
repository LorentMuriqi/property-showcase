import { Layout } from "@/components/Layout";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";

function VirtualTourOrbCard() {
  const floatingPoints = [
    { top: "28%", left: "25%", delay: 0 },
    { top: "42%", right: "23%", delay: 0.45 },
    { bottom: "29%", left: "30%", delay: 0.9 },
  ];

  return (
    <div className="relative aspect-square bg-card rounded-2xl border border-border overflow-hidden flex items-center justify-center transform-gpu">
      {/* Premium ambient background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(212,175,55,0.16),transparent_46%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(212,175,55,0.07)_48%,transparent_100%)]" />

      {/* Soft architectural frame */}
      <div className="absolute inset-8 rounded-[1.75rem] border border-primary/10" />
      <div className="absolute left-10 right-10 top-1/2 h-px bg-gradient-to-r from-transparent via-primary/14 to-transparent" />
      <div className="absolute top-10 bottom-10 left-1/2 w-px bg-gradient-to-b from-transparent via-primary/14 to-transparent" />

      {/* Panoramic virtual window */}
      <motion.div
        className="relative z-10 w-[72%] h-[52%] rounded-[2rem] border border-primary/25 bg-background/65 backdrop-blur-xl overflow-hidden shadow-[0_28px_90px_rgba(212,175,55,0.18)] will-change-transform"
        style={{ transform: "translateZ(0)" }}
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Moving panorama glow */}
        <motion.div
          className="absolute inset-0 bg-[linear-gradient(110deg,transparent_0%,rgba(212,175,55,0.06)_28%,rgba(212,175,55,0.18)_50%,rgba(212,175,55,0.06)_72%,transparent_100%)]"
          animate={{ x: ["-45%", "45%", "-45%"] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Abstract interior layers */}
        <div className="absolute inset-5 rounded-[1.4rem] border border-primary/12" />

        <motion.div
          className="absolute left-6 right-6 top-[34%] h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
          animate={{ opacity: [0.28, 0.72, 0.28] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />

        <motion.div
          className="absolute left-8 right-8 bottom-[30%] h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent"
          animate={{ opacity: [0.18, 0.52, 0.18] }}
          transition={{ duration: 5.8, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
        />

        {/* Depth panels */}
        <motion.div
          className="absolute left-[16%] top-[28%] h-[42%] w-[24%] rounded-xl border border-primary/18 bg-background/35"
          animate={{ opacity: [0.45, 0.8, 0.45] }}
          transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
        />

        <motion.div
          className="absolute right-[15%] top-[22%] h-[52%] w-[28%] rounded-xl border border-primary/16 bg-background/25"
          animate={{ opacity: [0.35, 0.72, 0.35] }}
          transition={{ duration: 5.6, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        />

        {/* Subtle navigation path */}
        <motion.div
          className="absolute left-[22%] right-[22%] bottom-[22%] h-px bg-gradient-to-r from-primary/0 via-primary/50 to-primary/0"
          animate={{ scaleX: [0.55, 1, 0.55], opacity: [0.25, 0.8, 0.25] }}
          transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Center focus point */}
        <motion.div
          className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_26px_rgba(212,175,55,0.75)]"
          animate={{ scale: [1, 1.18, 1], opacity: [0.75, 1, 0.75] }}
          transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
        />

        <motion.div
          className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/18"
          animate={{ scale: [0.82, 1.12, 0.82], opacity: [0.12, 0.45, 0.12] }}
          transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Micro label */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-center">
          <p className="text-[8px] uppercase tracking-[0.3em] text-foreground/75 whitespace-nowrap">
            Virtual Preview
          </p>
        </div>
      </motion.div>

      {/* Outer elegant orbit accents */}
      <motion.div
        className="absolute w-[82%] h-[82%] rounded-full border border-primary/10 will-change-transform"
        style={{ transform: "translateZ(0)" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 68, repeat: Infinity, ease: "linear" }}
      />

      <motion.div
        className="absolute w-[62%] h-[62%] rounded-full border border-primary/12 border-dashed will-change-transform"
        style={{ transform: "translateZ(0)" }}
        animate={{ rotate: -360 }}
        transition={{ duration: 56, repeat: Infinity, ease: "linear" }}
      />

      {/* Floating tour points */}
      {floatingPoints.map((point, index) => (
        <motion.div
          key={index}
          className="absolute will-change-transform"
          style={point}
          animate={{ scale: [1, 1.08, 1], opacity: [0.62, 1, 0.62] }}
          transition={{
            duration: 4.2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: point.delay,
          }}
        >
          <motion.span
            className="absolute -inset-2 rounded-full bg-primary/16"
            animate={{ scale: [0.7, 1.4, 0.7], opacity: [0, 0.36, 0] }}
            transition={{
              duration: 4.2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: point.delay,
            }}
          />
          <div className="relative h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_18px_rgba(212,175,55,0.62)]" />
        </motion.div>
      ))}

      {/* Top micro interface */}
      <div className="absolute left-8 top-8 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />
        <span className="text-[8px] uppercase tracking-[0.28em] text-muted-foreground/70">
          Live Walkthrough
        </span>
      </div>

      <div className="absolute right-8 top-8 text-[8px] uppercase tracking-[0.28em] text-muted-foreground/70">
        Scene 01
      </div>

      {/* Bottom label */}
      <div className="absolute bottom-7 left-1/2 -translate-x-1/2 text-center">
        <p className="text-[9px] uppercase tracking-[0.34em] text-muted-foreground/80 whitespace-nowrap">
          Step Inside The Space
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
        <meta
          name="description"
          content="Mëso më shumë rreth Aura Estates — agjencia juaj e besuar për prona ekskluzive me ture virtuale 360° në Kosovë."
        />
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
              <span className="italic text-[#D4AF37]">Living</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-xl text-white/70 max-w-2xl mx-auto font-light"
            >
              Elevating the standard of luxury real estate through innovation,
              exclusivity, and profound expertise.
            </motion.p>
          </div>
        </section>

        {/* Content */}
        <section className="py-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-16">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="font-display text-3xl text-primary mb-6">
                  Qasja Jonë
                </h2>

                <p className="text-muted-foreground leading-relaxed mb-4">
                  Në Aura Estates, një pronë është më shumë se një hapësirë,
                  është një përjetim.
                </p>

                <p className="text-muted-foreground leading-relaxed">
                  Ne specializohemi në prezantimin e pronave premium përmes
                  teknologjisë moderne, duke përfshirë ture virtuale 360°, që u
                  mundësojnë klientëve të eksplorojnë çdo detaj nga kudo në botë.
                </p>
              </div>

              <VirtualTourOrbCard />
            </div>

            <div className="border-t border-border pt-16">
              <h2 className="font-display text-3xl text-foreground mb-8 text-center">
                Eksperienca Virtuale
              </h2>

              <p className="text-muted-foreground leading-relaxed text-center max-w-3xl mx-auto">
                Përmes teknologjisë së avancuar të tureve virtuale 360°, ne
                prezantojmë pronat me një qartësi dhe standard të lartë
                profesional. Kjo u jep mundësi klientëve të eksplorojnë çdo
                hapësirë nga kudo në botë, duke krijuar një përjetim të plotë
                përpara një vizite fizike.
              </p>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
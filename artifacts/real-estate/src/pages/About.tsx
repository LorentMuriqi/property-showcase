import { Layout } from "@/components/Layout";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";

function VirtualTourHouseCard() {
  const hotspots = [
    { top: "42%", left: "36%", delay: 0 },
    { top: "42%", right: "36%", delay: 0.45 },
    { bottom: "30%", left: "50%", delay: 0.9 },
  ];

  return (
    <div className="relative aspect-square bg-card rounded-2xl border border-border overflow-hidden flex items-center justify-center transform-gpu">
      {/* Ambient premium background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(212,175,55,0.16),transparent_46%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(212,175,55,0.05)_50%,transparent_100%)]" />

      {/* Soft frame */}
      <div className="absolute inset-8 rounded-[1.75rem] border border-primary/10" />
      <div className="absolute left-10 right-10 top-1/2 h-px bg-gradient-to-r from-transparent via-primary/12 to-transparent" />
      <div className="absolute top-10 bottom-10 left-1/2 w-px bg-gradient-to-b from-transparent via-primary/12 to-transparent" />

      {/* Outer radar rings */}
      <motion.div
        className="absolute w-[78%] h-[78%] rounded-full border border-primary/10 will-change-transform"
        style={{ transform: "translateZ(0)" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 70, repeat: Infinity, ease: "linear" }}
      />

      <motion.div
        className="absolute w-[58%] h-[58%] rounded-full border border-primary/12 border-dashed will-change-transform"
        style={{ transform: "translateZ(0)" }}
        animate={{ rotate: -360 }}
        transition={{ duration: 56, repeat: Infinity, ease: "linear" }}
      />

      {/* Radar scan line */}
      <motion.div
        className="absolute w-px h-[30%] bg-gradient-to-b from-primary/70 via-primary/18 to-transparent origin-bottom will-change-transform"
        style={{
          bottom: "50%",
          transform: "translateZ(0)",
        }}
        animate={{ rotate: 360 }}
        transition={{
          duration: 16,
          repeat: Infinity,
          ease: "linear",
        }}
      />

      {/* Main floating house */}
      <motion.div
        className="relative z-10 w-[60%] h-[60%] will-change-transform"
        style={{ transform: "translateZ(0)" }}
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* House glow */}
        <motion.div
          className="absolute inset-[18%] bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.12),transparent_70%)]"
          animate={{ opacity: [0.35, 0.75, 0.35] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Roof */}
        <div className="absolute left-1/2 top-[16%] h-[22%] w-[54%] -translate-x-1/2">
          <div className="absolute left-1/2 top-[2px] h-px w-[58%] -translate-x-[92%] origin-right rotate-[32deg] bg-primary/40" />
          <div className="absolute right-1/2 top-[2px] h-px w-[58%] translate-x-[92%] origin-left -rotate-[32deg] bg-primary/40" />
          <div className="absolute left-1/2 top-[34%] -translate-x-1/2 h-[2px] w-[12%] rounded-full bg-primary/35" />
        </div>

        {/* House body */}
        <div className="absolute left-1/2 top-[34%] -translate-x-1/2 w-[54%] h-[38%] rounded-[1.6rem] border border-primary/28 bg-background/55 backdrop-blur-md shadow-[0_18px_70px_rgba(212,175,55,0.12)]" />

        {/* Inner body frame */}
        <div className="absolute left-1/2 top-[38%] -translate-x-1/2 w-[44%] h-[28%] rounded-[1rem] border border-primary/12" />

        {/* Windows */}
        <motion.div
          className="absolute left-[31%] top-[43%] w-[10%] h-[10%] rounded-lg border border-primary/25 bg-background/40"
          animate={{ opacity: [0.45, 0.85, 0.45] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute right-[31%] top-[43%] w-[10%] h-[10%] rounded-lg border border-primary/25 bg-background/40"
          animate={{ opacity: [0.45, 0.85, 0.45] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.35 }}
        />

        {/* Door */}
        <motion.div
          className="absolute left-1/2 top-[53%] -translate-x-1/2 w-[12%] h-[20%] rounded-t-full border border-primary/35 bg-background/45 shadow-[0_0_25px_rgba(212,175,55,0.12)]"
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Floor line */}
        <motion.div
          className="absolute left-[24%] right-[24%] bottom-[20%] h-px bg-gradient-to-r from-primary/0 via-primary/40 to-primary/0"
          animate={{ scaleX: [0.75, 1, 0.75], opacity: [0.22, 0.72, 0.22] }}
          transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* House center focus */}
        <motion.div
          className="absolute left-1/2 top-[55%] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_24px_rgba(212,175,55,0.75)]"
          animate={{ scale: [1, 1.15, 1], opacity: [0.75, 1, 0.75] }}
          transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Subtle orbit around house center */}
        <motion.div
          className="absolute left-1/2 top-[55%] h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/14"
          animate={{ scale: [0.85, 1.08, 0.85], opacity: [0.15, 0.42, 0.15] }}
          transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Hotspots */}
        {hotspots.map((hotspot, index) => (
          <motion.div
            key={index}
            className="absolute will-change-transform"
            style={hotspot}
            animate={{ scale: [1, 1.08, 1], opacity: [0.62, 1, 0.62] }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
              delay: hotspot.delay,
            }}
          >
            <motion.span
              className="absolute -inset-2 rounded-full bg-primary/18"
              animate={{ scale: [0.7, 1.35, 0.7], opacity: [0, 0.34, 0] }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
                delay: hotspot.delay,
              }}
            />
            <div className="relative h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_18px_rgba(212,175,55,0.62)]" />
          </motion.div>
        ))}

        {/* Small top accent */}
        <motion.div
          className="absolute left-1/2 top-[25%] -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-primary/80"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>

      {/* Micro interface labels */}
      <div className="absolute left-8 top-8 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />
        <span className="text-[8px] uppercase tracking-[0.28em] text-muted-foreground/70">
          Live Tour
        </span>
      </div>

      <div className="absolute right-8 top-8 text-[8px] uppercase tracking-[0.28em] text-muted-foreground/70">
        Home View
      </div>

      {/* Bottom label */}
      <div className="absolute bottom-7 left-1/2 -translate-x-1/2 text-center">
        <p className="text-[9px] uppercase tracking-[0.34em] text-muted-foreground/80 whitespace-nowrap">
          Explore The Home
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

              <VirtualTourHouseCard />
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
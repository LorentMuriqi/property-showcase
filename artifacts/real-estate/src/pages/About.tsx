import { Layout } from "@/components/Layout";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";

function VirtualTourVisionCard() {
  const hotspots = [
    { top: "42%", left: "27%", delay: 0 },
    { top: "42%", right: "27%", delay: 0.45 },
    { bottom: "28%", left: "50%", delay: 0.9 },
  ];

  return (
    <div className="relative aspect-square bg-card rounded-2xl border border-border overflow-hidden flex items-center justify-center transform-gpu">
      {/* Ambient background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(212,175,55,0.14),transparent_48%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(212,175,55,0.04)_50%,transparent_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_78%,rgba(212,175,55,0.08),transparent_30%)]" />

      {/* Inner frame */}
      <div className="absolute inset-8 rounded-[1.75rem] border border-primary/10" />

      {/* Very subtle outer rings */}
      <motion.div
        className="absolute w-[78%] h-[78%] rounded-full border border-primary/10 will-change-transform"
        style={{ transform: "translateZ(0)" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 90, repeat: Infinity, ease: "linear" }}
      />

      <motion.div
        className="absolute w-[58%] h-[58%] rounded-full border border-primary/10 border-dashed will-change-transform"
        style={{ transform: "translateZ(0)" }}
        animate={{ rotate: -360 }}
        transition={{ duration: 72, repeat: Infinity, ease: "linear" }}
      />

      {/* Main eye block */}
      <motion.div
        className="relative z-10 w-[76%] h-[48%] flex items-center justify-center will-change-transform"
        style={{ transform: "translateZ(0)" }}
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Soft glow behind eye */}
        <motion.div
          className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.12),transparent_68%)]"
          animate={{ opacity: [0.35, 0.7, 0.35] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Eye shape SVG */}
        <svg
          viewBox="0 0 360 220"
          className="absolute inset-0 w-full h-full"
          fill="none"
        >
          {/* Outer eye */}
          <path
            d="M28 110C60 64 111 38 180 38C249 38 300 64 332 110C300 156 249 182 180 182C111 182 60 156 28 110Z"
            stroke="rgba(212,175,55,0.42)"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="rgba(255,255,255,0.03)"
          />

          {/* Inner contour */}
          <path
            d="M54 110C80 78 120 58 180 58C240 58 280 78 306 110C280 142 240 162 180 162C120 162 80 142 54 110Z"
            stroke="rgba(212,175,55,0.14)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Small accent contour */}
          <path
            d="M78 110C100 87 132 73 180 73C228 73 260 87 282 110C260 133 228 147 180 147C132 147 100 133 78 110Z"
            stroke="rgba(212,175,55,0.08)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {/* Pupil / globe */}
        <motion.div
          className="relative h-28 w-28 rounded-full border border-primary/30 bg-background/55 backdrop-blur-md shadow-[0_0_45px_rgba(212,175,55,0.14)] overflow-hidden"
          animate={{ scale: [1, 1.015, 1] }}
          transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Globe glow */}
          <motion.div
            className="absolute inset-0 bg-[radial-gradient(circle_at_40%_35%,rgba(212,175,55,0.20),transparent_62%)]"
            animate={{ opacity: [0.45, 0.82, 0.45] }}
            transition={{ duration: 4.6, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Globe meridians/parallels */}
          <div className="absolute inset-0 rounded-full border border-primary/20" />
          <div className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-primary/12" />
          <div className="absolute top-1/2 left-0 right-0 h-px -translate-y-1/2 bg-primary/12" />
          <div className="absolute inset-y-0 left-[34%] w-px bg-primary/8" />
          <div className="absolute inset-y-0 right-[34%] w-px bg-primary/8" />
          <div className="absolute inset-x-0 top-[34%] h-px bg-primary/8" />
          <div className="absolute inset-x-0 bottom-[34%] h-px bg-primary/8" />

          {/* Rotating scan ring */}
          <motion.div
            className="absolute inset-2 rounded-full border border-primary/22 will-change-transform"
            style={{ transform: "translateZ(0)" }}
            animate={{ rotate: 360 }}
            transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
          >
            <div className="absolute left-1/2 top-1/2 h-[52%] w-px -translate-x-1/2 -translate-y-full bg-gradient-to-t from-primary/0 via-primary/40 to-primary/85 origin-bottom" />
          </motion.div>

          {/* Center lens core */}
          <motion.div
            className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_25px_rgba(212,175,55,0.75)]"
            animate={{ scale: [1, 1.14, 1], opacity: [0.82, 1, 0.82] }}
            transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Small reflection */}
          <motion.div
            className="absolute right-[26%] top-[26%] h-3.5 w-3.5 rounded-full bg-white/55 blur-[1px]"
            animate={{ opacity: [0.25, 0.65, 0.25] }}
            transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>

        {/* Elegant side connectors */}
        <motion.div
          className="absolute left-[18%] top-1/2 h-px w-[18%] -translate-y-1/2 bg-gradient-to-r from-primary/0 via-primary/25 to-primary/0"
          animate={{ opacity: [0.15, 0.45, 0.15] }}
          transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute right-[18%] top-1/2 h-px w-[18%] -translate-y-1/2 bg-gradient-to-r from-primary/0 via-primary/25 to-primary/0"
          animate={{ opacity: [0.15, 0.45, 0.15] }}
          transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut", delay: 0.35 }}
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
              animate={{ scale: [0.7, 1.35, 0.7], opacity: [0, 0.32, 0] }}
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
      </motion.div>

      {/* Top micro labels */}
      <div className="absolute left-8 top-8 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />
        <span className="text-[8px] uppercase tracking-[0.28em] text-muted-foreground/70">
          Panoramic Vision
        </span>
      </div>

      <div className="absolute right-8 top-8 text-[8px] uppercase tracking-[0.28em] text-muted-foreground/70">
        Live Preview
      </div>

      {/* Bottom label */}
      <div className="absolute bottom-7 left-1/2 -translate-x-1/2 text-center">
        <p className="text-[9px] uppercase tracking-[0.34em] text-muted-foreground/80 whitespace-nowrap">
          Experience Every Angle
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

              <VirtualTourVisionCard />
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
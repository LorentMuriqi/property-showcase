import { Layout } from "@/components/Layout";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";

function VirtualTourHouseCard() {
  const hotspots = [
    { top: "40%", left: "38%", delay: 0 },
    { top: "40%", right: "38%", delay: 0.45 },
    { top: "56%", left: "50%", delay: 0.9 },
  ];

  return (
    <div className="relative aspect-square bg-card rounded-2xl border border-border overflow-hidden flex items-center justify-center transform-gpu">
      {/* Ambient background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(212,175,55,0.14),transparent_48%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(212,175,55,0.04)_50%,transparent_100%)]" />

      {/* Inner frame */}
      <div className="absolute inset-8 rounded-[1.75rem] border border-primary/10" />

      {/* Subtle radar rings */}
      <motion.div
        className="absolute w-[72%] h-[72%] rounded-full border border-primary/10 will-change-transform"
        style={{ transform: "translateZ(0)" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 80, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute w-[52%] h-[52%] rounded-full border border-primary/10 border-dashed will-change-transform"
        style={{ transform: "translateZ(0)" }}
        animate={{ rotate: -360 }}
        transition={{ duration: 65, repeat: Infinity, ease: "linear" }}
      />

      {/* Scan line */}
      <motion.div
        className="absolute w-px h-[26%] bg-gradient-to-b from-primary/70 via-primary/18 to-transparent origin-bottom will-change-transform"
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

      {/* House block */}
      <motion.div
        className="relative z-10 w-[56%] h-[56%] flex items-center justify-center will-change-transform"
        style={{ transform: "translateZ(0)" }}
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Soft glow behind house */}
        <motion.div
          className="absolute inset-[12%] rounded-full bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.10),transparent_70%)]"
          animate={{ opacity: [0.35, 0.7, 0.35] }}
          transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Clear house silhouette */}
        <svg
          viewBox="0 0 240 240"
          className="absolute inset-0 w-full h-full"
          fill="none"
        >
          {/* Roof */}
          <path
            d="M58 108 L120 58 L182 108"
            stroke="rgba(212,175,55,0.55)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Chimney */}
          <path
            d="M155 78 L155 62"
            stroke="rgba(212,175,55,0.40)"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* House body */}
          <rect
            x="72"
            y="106"
            width="96"
            height="84"
            rx="18"
            stroke="rgba(212,175,55,0.40)"
            strokeWidth="3"
            fill="rgba(255,255,255,0.12)"
          />

          {/* Window left */}
          <rect
            x="88"
            y="122"
            width="24"
            height="24"
            rx="8"
            stroke="rgba(212,175,55,0.30)"
            strokeWidth="2"
            fill="rgba(255,255,255,0.08)"
          />

          {/* Window right */}
          <rect
            x="128"
            y="122"
            width="24"
            height="24"
            rx="8"
            stroke="rgba(212,175,55,0.30)"
            strokeWidth="2"
            fill="rgba(255,255,255,0.08)"
          />

          {/* Door */}
          <path
            d="M110 190 V154 C110 147 114 143 120 143 C126 143 130 147 130 154 V190"
            stroke="rgba(212,175,55,0.40)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="rgba(255,255,255,0.05)"
          />

          {/* Base line */}
          <path
            d="M84 190 H156"
            stroke="rgba(212,175,55,0.25)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>

        {/* Center focus glow */}
        <motion.div
          className="absolute left-1/2 top-[56%] h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/90 shadow-[0_0_24px_rgba(212,175,55,0.75)]"
          animate={{ scale: [1, 1.16, 1], opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
        />

        <motion.div
          className="absolute left-1/2 top-[56%] h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/15"
          animate={{ scale: [0.8, 1.12, 0.8], opacity: [0.12, 0.4, 0.12] }}
          transition={{ duration: 4.6, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Hotspots */}
        {hotspots.map((hotspot, index) => (
          <motion.div
            key={index}
            className="absolute will-change-transform"
            style={hotspot}
            animate={{ scale: [1, 1.08, 1], opacity: [0.65, 1, 0.65] }}
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
      </motion.div>

      {/* Top micro labels */}
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
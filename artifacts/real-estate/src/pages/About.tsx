import { Layout } from "@/components/Layout";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";

function VirtualTourVisionCard() {
  const hotspots = [
    { top: "38%", left: "35%", delay: 0 },
    { top: "38%", right: "35%", delay: 0.45 },
    { bottom: "36%", left: "50%", delay: 0.9 },
  ];

  return (
    <div className="relative aspect-square bg-card rounded-2xl border border-border overflow-hidden flex items-center justify-center transform-gpu">
      {/* Ambient background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(212,175,55,0.14),transparent_48%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(212,175,55,0.04)_50%,transparent_100%)]" />

      {/* Inner frame */}
      <div className="absolute inset-8 rounded-[1.75rem] border border-primary/10" />

      {/* Outer soft orbit */}
      <motion.div
        className="absolute w-[76%] h-[76%] rounded-full border border-primary/10 will-change-transform"
        style={{ transform: "translateZ(0)" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 80, repeat: Infinity, ease: "linear" }}
      />

      <motion.div
        className="absolute w-[58%] h-[58%] rounded-full border border-primary/10 border-dashed will-change-transform"
        style={{ transform: "translateZ(0)" }}
        animate={{ rotate: -360 }}
        transition={{ duration: 62, repeat: Infinity, ease: "linear" }}
      />

      {/* Main eye / globe block */}
      <motion.div
        className="relative z-10 w-[70%] h-[52%] flex items-center justify-center will-change-transform"
        style={{ transform: "translateZ(0)" }}
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Soft glow */}
        <motion.div
          className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.12),transparent_68%)]"
          animate={{ opacity: [0.35, 0.72, 0.35] }}
          transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Eye shape */}
        <svg
          viewBox="0 0 320 220"
          className="absolute inset-0 w-full h-full"
          fill="none"
        >
          {/* Eye outer shape */}
          <path
            d="M28 110C56 68 101 44 160 44C219 44 264 68 292 110C264 152 219 176 160 176C101 176 56 152 28 110Z"
            stroke="rgba(212,175,55,0.42)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="rgba(255,255,255,0.03)"
          />

          {/* Eye inner contour */}
          <path
            d="M54 110C76 80 110 63 160 63C210 63 244 80 266 110C244 140 210 157 160 157C110 157 76 140 54 110Z"
            stroke="rgba(212,175,55,0.14)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Globe outline */}
          <circle
            cx="160"
            cy="110"
            r="50"
            stroke="rgba(212,175,55,0.34)"
            strokeWidth="3"
            fill="rgba(255,255,255,0.06)"
          />

          {/* Globe meridians */}
          <ellipse
            cx="160"
            cy="110"
            rx="22"
            ry="50"
            stroke="rgba(212,175,55,0.18)"
            strokeWidth="2"
          />
          <ellipse
            cx="160"
            cy="110"
            rx="38"
            ry="50"
            stroke="rgba(212,175,55,0.12)"
            strokeWidth="2"
          />

          {/* Globe parallels */}
          <path
            d="M110 110H210"
            stroke="rgba(212,175,55,0.18)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M122 92C134 98 146 100 160 100C174 100 186 98 198 92"
            stroke="rgba(212,175,55,0.12)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M122 128C134 122 146 120 160 120C174 120 186 122 198 128"
            stroke="rgba(212,175,55,0.12)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>

        {/* Rotating scan ring */}
        <motion.div
          className="absolute w-[42%] h-[42%] rounded-full border border-primary/25 will-change-transform"
          style={{ transform: "translateZ(0)" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
        >
          <div className="absolute left-1/2 top-1/2 h-[54%] w-px -translate-x-1/2 -translate-y-full bg-gradient-to-t from-primary/0 via-primary/35 to-primary/80 origin-bottom" />
        </motion.div>

        {/* Center lens */}
        <motion.div
          className="absolute h-7 w-7 rounded-full bg-primary/90 shadow-[0_0_28px_rgba(212,175,55,0.75)]"
          animate={{ scale: [1, 1.12, 1], opacity: [0.82, 1, 0.82] }}
          transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
        />

        <motion.div
          className="absolute h-16 w-16 rounded-full border border-primary/18"
          animate={{ scale: [0.82, 1.08, 0.82], opacity: [0.12, 0.4, 0.12] }}
          transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
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

      {/* Micro labels */}
      <div className="absolute left-8 top-8 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />
        <span className="text-[8px] uppercase tracking-[0.28em] text-muted-foreground/70">
          Live View
        </span>
      </div>

      <div className="absolute right-8 top-8 text-[8px] uppercase tracking-[0.28em] text-muted-foreground/70">
        Panorama
      </div>

      {/* Bottom label */}
      <div className="absolute bottom-7 left-1/2 -translate-x-1/2 text-center">
        <p className="text-[9px] uppercase tracking-[0.34em] text-muted-foreground/80 whitespace-nowrap">
          See Every Detail
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
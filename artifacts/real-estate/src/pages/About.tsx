import { Layout } from "@/components/Layout";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";

function VirtualTourOrbCard() {
  const hotspots = [
    { top: "25%", left: "28%", delay: 0 },
    { top: "36%", right: "22%", delay: 0.35 },
    { bottom: "30%", left: "24%", delay: 0.7 },
    { bottom: "24%", right: "30%", delay: 1.05 },
  ];

  const connectionLines = [
    {
      className:
        "left-[31%] top-[29%] w-[24%] rotate-[18deg] origin-left",
    },
    {
      className:
        "right-[25%] top-[39%] w-[22%] -rotate-[32deg] origin-right",
    },
    {
      className:
        "left-[28%] bottom-[33%] w-[24%] -rotate-[18deg] origin-left",
    },
    {
      className:
        "right-[33%] bottom-[27%] w-[18%] rotate-[28deg] origin-right",
    },
  ];

  return (
    <div className="relative aspect-square bg-card rounded-2xl border border-border overflow-hidden flex items-center justify-center transform-gpu">
      {/* Premium background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.18),transparent_44%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(212,175,55,0.08)_45%,transparent_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(212,175,55,0.10),transparent_28%)]" />

      {/* Architectural frame */}
      <div className="absolute inset-10 rounded-2xl border border-primary/10" />
      <div className="absolute inset-16 rounded-full border border-primary/10" />
      <div className="absolute left-10 right-10 top-1/2 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      <div className="absolute top-10 bottom-10 left-1/2 w-px bg-gradient-to-b from-transparent via-primary/20 to-transparent" />

      {/* Subtle blueprint corner lines */}
      <div className="absolute left-12 top-12 h-10 w-10 border-l border-t border-primary/20 rounded-tl-xl" />
      <div className="absolute right-12 top-12 h-10 w-10 border-r border-t border-primary/20 rounded-tr-xl" />
      <div className="absolute bottom-12 left-12 h-10 w-10 border-b border-l border-primary/20 rounded-bl-xl" />
      <div className="absolute bottom-12 right-12 h-10 w-10 border-b border-r border-primary/20 rounded-br-xl" />

      {/* Slow portal rings */}
      <motion.div
        className="absolute w-[82%] h-[82%] rounded-full border border-primary/10 will-change-transform"
        style={{ transform: "translateZ(0)" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 58, repeat: Infinity, ease: "linear" }}
      />

      <motion.div
        className="absolute w-[66%] h-[66%] rounded-full border border-primary/20 border-dashed will-change-transform"
        style={{ transform: "translateZ(0)" }}
        animate={{ rotate: -360 }}
        transition={{ duration: 48, repeat: Infinity, ease: "linear" }}
      />

      <motion.div
        className="absolute w-[48%] h-[48%] rounded-full border border-primary/20 will-change-transform"
        animate={{ scale: [1, 1.04, 1], opacity: [0.35, 0.75, 0.35] }}
        transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Connected hotspot lines */}
      {connectionLines.map((line, index) => (
        <motion.div
          key={index}
          className={`absolute h-px bg-gradient-to-r from-primary/0 via-primary/25 to-primary/0 ${line.className}`}
          animate={{ opacity: [0.16, 0.55, 0.16] }}
          transition={{
            duration: 4.2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: index * 0.28,
          }}
        />
      ))}

      {/* Radar scan */}
      <motion.div
        className="absolute w-px h-[34%] bg-gradient-to-b from-primary/70 via-primary/20 to-transparent origin-bottom will-change-transform"
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

      {/* Soft scan halo */}
      <motion.div
        className="absolute w-[52%] h-[52%] rounded-full bg-primary/[0.03] will-change-transform"
        animate={{ scale: [0.92, 1.12, 0.92], opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 7.5, repeat: Infinity, ease: "easeInOut" }}
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

      {/* Main portal orb */}
      <motion.div
        className="relative z-10 w-36 h-36 rounded-full border border-primary/40 bg-background/75 backdrop-blur-xl shadow-[0_24px_90px_rgba(212,175,55,0.20)] flex flex-col items-center justify-center will-change-transform"
        style={{ transform: "translateZ(0)" }}
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 7.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <motion.div
          className="absolute inset-3 rounded-full border border-primary/15"
          animate={{ rotate: 360 }}
          transition={{ duration: 26, repeat: Infinity, ease: "linear" }}
        />

        <motion.div
          className="absolute inset-6 rounded-full bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.10),transparent_70%)]"
          animate={{ opacity: [0.45, 0.9, 0.45] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        />

        <span className="relative text-primary text-4xl md:text-5xl font-bold tracking-tight leading-none">
          360°
        </span>

        <span className="relative mt-3 text-[10px] uppercase tracking-[0.34em] text-foreground">
          Virtual Tour
        </span>
      </motion.div>

      {/* Micro UI details */}
      <div className="absolute left-8 top-8 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />
        <span className="text-[8px] uppercase tracking-[0.28em] text-muted-foreground/70">
          Live View
        </span>
      </div>

      <div className="absolute right-8 top-8 text-[8px] uppercase tracking-[0.28em] text-muted-foreground/70">
        Room 01
      </div>

      {/* Bottom label */}
      <div className="absolute bottom-7 left-1/2 -translate-x-1/2 text-center">
        <p className="text-[9px] uppercase tracking-[0.34em] text-muted-foreground/80 whitespace-nowrap">
          Explore In 360°
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
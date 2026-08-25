import type { ReactNode } from "react";
import { Layout } from "@/components/Layout";
import { motion, useReducedMotion } from "framer-motion";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";

const ABOUT_IMAGE = `${import.meta.env.BASE_URL}images/about-bg.png`;

const principles = [
  {
    number: "01",
    title: "Qartësi në prezantim",
    description:
      "Çdo pronë paraqitet me informacion të strukturuar, pamje të pastra dhe një rrjedhë që e bën eksplorimin të natyrshëm.",
  },
  {
    number: "02",
    title: "Kujdes në çdo detaj",
    description:
      "Nga tipografia te fotografia dhe organizimi i përmbajtjes, çdo element ruan një standard të njëjtë vizual dhe profesional.",
  },
  {
    number: "03",
    title: "Perspektivë më e plotë",
    description:
      "Turët virtuale 360° e ndihmojnë vizitorin të kuptojë hapësirën, lidhjen mes dhomave dhe karakterin real të pronës.",
  },
];

const approachItems = [
  {
    title: "Prezantim i përmbajtur",
    description:
      "Dizajn i pastër që e vendos pronën në qendër, pa zhurmë vizuale dhe pa elemente të panevojshme.",
  },
  {
    title: "Eksplorim intuitiv",
    description:
      "Një eksperiencë e qartë nga kërkimi fillestar deri te fotografia, detajet dhe turi virtual.",
  },
  {
    title: "Qasje nga kudo",
    description:
      "Prona mund të shqyrtohet në çdo kohë, duke krijuar një hap të parë më të informuar para vizitës fizike.",
  },
];

const virtualTourBenefits = [
  "Kuptim më real i përmasave dhe organizimit të hapësirës",
  "Lëvizje e lirë nga një ambient në tjetrin",
  "Vendimmarrje më e informuar para vizitës fizike",
];

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  distance?: number;
};

function Reveal({
  children,
  className,
  delay = 0,
  distance = 24,
}: RevealProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: distance }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{
        duration: 0.72,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}

function ArrowUpRightIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4"
    >
      <path
        d="M5 15L15 5M7 5h8v8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="h-5 w-5"
    >
      <path
        d="M4.5 10.5l3.2 3.2 7.8-8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EditorialImagePanel() {
  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="absolute -left-5 -top-5 hidden h-24 w-24 border-l border-t border-[#D4AF37]/50 lg:block"
      />

      <div className="relative aspect-[4/5] overflow-hidden bg-[#07111f] sm:aspect-[5/4] lg:aspect-[4/5]">
        <img
          src={ABOUT_IMAGE}
          alt="Arkitekturë bashkëkohore e prezantuar nga Aura Estates"
          className="h-full w-full object-cover transition-transform duration-700 hover:scale-[1.015]"
          loading="lazy"
          decoding="async"
        />

        <div className="absolute inset-0 bg-gradient-to-b from-[#07111f]/15 via-[#07111f]/5 to-[#07111f]/90" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#07111f]/25 to-transparent" />

        <div className="absolute left-5 top-5 border border-white/20 bg-[#07111f]/55 px-4 py-3 backdrop-blur-md sm:left-7 sm:top-7">
          <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-white/70">
            Aura Estates
          </p>
          <p className="mt-1 text-xs text-[#D4AF37]">Prona · Hapësirë · Perspektivë</p>
        </div>

        <div className="absolute inset-x-5 bottom-5 border-l border-[#D4AF37]/80 pl-5 sm:inset-x-8 sm:bottom-8 sm:pl-7">
          <p className="max-w-xl font-display text-2xl leading-snug text-white sm:text-3xl lg:text-[2rem]">
            “Një pronë duhet të kuptohet, jo vetëm të shihet.”
          </p>
        </div>
      </div>

      <div className="absolute -bottom-7 right-5 hidden min-w-[190px] border border-border bg-background px-6 py-5 shadow-[0_24px_60px_rgba(7,17,31,0.16)] sm:block lg:-right-7">
        <div className="flex items-end justify-between gap-5">
          <span className="font-display text-5xl leading-none text-primary">360°</span>
          <span className="pb-1 text-right text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Eksperiencë
            <br />
            virtuale
          </span>
        </div>
      </div>
    </div>
  );
}

function VirtualTourArtwork() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[470px]">
      <div
        aria-hidden="true"
        className="absolute inset-[3%] rounded-full border border-white/10"
      />
      <div
        aria-hidden="true"
        className="absolute inset-[12%] rounded-full border border-[#D4AF37]/25"
      />
      <div
        aria-hidden="true"
        className="absolute inset-[22%] rounded-full border border-dashed border-white/15"
      />

      <div
        aria-hidden="true"
        className="absolute left-1/2 top-[3%] h-[94%] w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-white/15 to-transparent"
      />
      <div
        aria-hidden="true"
        className="absolute left-[3%] top-1/2 h-px w-[94%] -translate-y-1/2 bg-gradient-to-r from-transparent via-white/15 to-transparent"
      />

      <svg
        aria-hidden="true"
        viewBox="0 0 500 500"
        className="absolute inset-0 h-full w-full"
        fill="none"
      >
        <path
          d="M80 250c0-93.9 76.1-170 170-170 55.6 0 105 26.7 136 68"
          stroke="rgba(212,175,55,0.55)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M420 250c0 93.9-76.1 170-170 170-55.6 0-105-26.7-136-68"
          stroke="rgba(255,255,255,0.24)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M250 80c46 0 83.3 76.1 83.3 170S296 420 250 420s-83.3-76.1-83.3-170S204 80 250 80Z"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1.2"
        />
        <path
          d="M94 185c43.7 24.5 97.2 38.5 156 38.5s112.3-14 156-38.5M94 315c43.7-24.5 97.2-38.5 156-38.5s112.3 14 156 38.5"
          stroke="rgba(255,255,255,0.11)"
          strokeWidth="1.2"
        />
      </svg>

      <span className="absolute left-1/2 top-0 -translate-x-1/2 text-[10px] font-medium uppercase tracking-[0.28em] text-white/45">
        Veri
      </span>
      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[10px] font-medium uppercase tracking-[0.28em] text-white/45">
        Jug
      </span>
      <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[10px] font-medium uppercase tracking-[0.28em] text-white/45">
        P
      </span>
      <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[10px] font-medium uppercase tracking-[0.28em] text-white/45">
        L
      </span>

      <div className="absolute inset-0 flex items-center justify-center text-center">
        <div>
          <p className="font-display text-[4.75rem] leading-none text-white sm:text-[6.25rem]">
            360<span className="text-[#D4AF37]">°</span>
          </p>
          <div className="mx-auto mt-5 h-px w-16 bg-[#D4AF37]/70" />
          <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.34em] text-white/55 sm:text-xs">
            Përvojë virtuale e pronës
          </p>
        </div>
      </div>

      <div className="absolute right-[12%] top-[18%] h-2.5 w-2.5 rounded-full border border-[#D4AF37] bg-[#07111f] shadow-[0_0_0_7px_rgba(212,175,55,0.10)]" />
      <div className="absolute bottom-[19%] left-[14%] h-2 w-2 rounded-full border border-white/60 bg-[#07111f] shadow-[0_0_0_6px_rgba(255,255,255,0.06)]" />
    </div>
  );
}

export default function About() {
  const reduceMotion = useReducedMotion();

  return (
    <Layout>
      <Helmet>
        <title>Rreth Nesh | Aura Estates</title>
        <meta
          name="description"
          content="Njihuni me Aura Estates — platformë moderne për prezantimin dhe zbulimin e pronave, me ture virtuale 360° dhe një eksperiencë të qartë në çdo hap."
        />
        <link rel="canonical" href="https://auraks.com/about" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Rreth Nesh | Aura Estates" />
        <meta
          property="og:description"
          content="Prezantim profesional i pronave, perspektivë më e plotë dhe ture virtuale 360° nga Aura Estates."
        />
        <meta property="og:url" content="https://auraks.com/about" />
        <meta
          property="og:image"
          content="https://auraks.com/images/about-bg.png"
        />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Aura Estates",
            url: "https://auraks.com",
            description:
              "Platformë moderne për prezantimin dhe zbulimin e pronave me ture virtuale 360°.",
          })}
        </script>
      </Helmet>

      <main className="min-h-screen overflow-hidden bg-background">
        {/* Hero */}
        <section className="relative isolate min-h-[680px] overflow-hidden bg-[#07111f] lg:min-h-[760px]">
          <img
            src={ABOUT_IMAGE}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover object-center"
            loading="eager"
            decoding="async"
          />

          <div className="absolute inset-0 bg-gradient-to-r from-[#06101f] via-[#06101f]/90 to-[#06101f]/35" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#06101f] via-transparent to-[#06101f]/35" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_34%,rgba(212,175,55,0.13),transparent_30%)]" />

          <div
            aria-hidden="true"
            className="absolute inset-y-0 left-[8%] hidden w-px bg-white/10 lg:block"
          />
          <div
            aria-hidden="true"
            className="absolute inset-y-0 right-[8%] hidden w-px bg-white/10 lg:block"
          />

          <div className="relative mx-auto flex min-h-[680px] max-w-7xl items-center px-5 pb-20 pt-32 sm:px-8 sm:pb-28 lg:min-h-[760px] lg:px-10 lg:pb-32 lg:pt-36">
            <div className="max-w-4xl">
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                className="mb-7 flex items-center gap-4"
              >
                <span className="h-px w-12 bg-[#D4AF37]" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/70">
                  Rreth Aura Estates
                </span>
              </motion.div>

              <motion.h1
                initial={reduceMotion ? false : { opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.85,
                  delay: reduceMotion ? 0 : 0.08,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="max-w-4xl font-display text-5xl font-medium leading-[1.03] tracking-[-0.035em] text-white sm:text-6xl md:text-7xl lg:text-[5.5rem]"
              >
                Prona të prezantuara me standard.
                <span className="mt-2 block font-normal italic text-[#D4AF37]">
                  Vendime të marra me qartësi.
                </span>
              </motion.h1>

              <motion.p
                initial={reduceMotion ? false : { opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.8,
                  delay: reduceMotion ? 0 : 0.18,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="mt-8 max-w-2xl text-base leading-8 text-white/70 sm:text-lg"
              >
                Aura Estates ndërthur prezantimin e kujdesshëm të pronës me
                teknologjinë virtuale 360°, për t’ju dhënë një pamje më të plotë
                përpara çdo vendimi.
              </motion.p>

              <motion.div
                initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.75,
                  delay: reduceMotion ? 0 : 0.28,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="mt-10 flex flex-col gap-3 sm:flex-row"
              >
                <Link
                  href="/projects"
                  className="group inline-flex min-h-12 items-center justify-center gap-3 bg-[#D4AF37] px-7 py-3 text-sm font-semibold text-[#07111f] transition-colors duration-300 hover:bg-[#e1c15a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2 focus-visible:ring-offset-[#07111f]"
                >
                  Shiko pronat
                  <span className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                    <ArrowUpRightIcon />
                  </span>
                </Link>

                <Link
                  href="/contact"
                  className="group inline-flex min-h-12 items-center justify-center gap-3 border border-white/30 bg-white/[0.04] px-7 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-colors duration-300 hover:border-white/55 hover:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#07111f]"
                >
                  Na kontaktoni
                  <span className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                    <ArrowUpRightIcon />
                  </span>
                </Link>
              </motion.div>
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 hidden border-t border-white/10 bg-[#07111f]/65 backdrop-blur-md sm:block">
            <div className="mx-auto grid max-w-7xl grid-cols-1 px-5 sm:grid-cols-3 sm:px-8 lg:px-10">
              {["Prezantim premium", "Tur virtual 360°", "Qasje e qartë"].map(
                (item, index) => (
                  <div
                    key={item}
                    className={`flex min-h-16 items-center gap-3 py-4 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/60 sm:min-h-20 sm:justify-center sm:py-0 ${
                      index > 0 ? "border-t border-white/10 sm:border-l sm:border-t-0" : ""
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-[#D4AF37]" />
                    {item}
                  </div>
                ),
              )}
            </div>
          </div>
        </section>

        {/* Brand statement */}
        <section className="px-5 py-24 sm:px-8 sm:py-28 lg:px-10 lg:py-36">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-12 lg:gap-8">
            <Reveal className="lg:col-span-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary">
                Kush jemi
              </p>
              <h2 className="mt-5 font-display text-4xl leading-tight tracking-[-0.025em] text-foreground sm:text-5xl">
                Një mënyrë më e qartë për ta njohur pronën.
              </h2>
            </Reveal>

            <Reveal className="lg:col-span-7 lg:col-start-6" delay={0.08}>
              <p className="font-display text-2xl leading-relaxed text-foreground sm:text-3xl">
                Aura Estates ndërtohet mbi një ide të thjeshtë: një pronë duhet
                të prezantohet me të njëjtin kujdes me të cilin është projektuar,
                ndërtuar dhe jetuar.
              </p>

              <div className="mt-10 grid gap-7 border-t border-border pt-8 md:grid-cols-2 md:gap-10">
                <p className="text-base leading-8 text-muted-foreground">
                  Në vend të një galerie me pamje të shkëputura, ne krijojmë një
                  rrjedhë të plotë ku fotografia, informacioni dhe eksperienca
                  360° punojnë së bashku.
                </p>
                <p className="text-base leading-8 text-muted-foreground">
                  Rezultati është një platformë e përmbajtur dhe profesionale, që
                  e ndihmon vizitorin të kuptojë më mirë hapësirën dhe të afrohet
                  me vendimin e duhur.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Approach */}
        <section className="border-y border-border bg-muted/25 px-5 py-24 sm:px-8 sm:py-28 lg:px-10 lg:py-36">
          <div className="mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-2 lg:gap-24">
            <Reveal className="pb-7 sm:pb-9">
              <EditorialImagePanel />
            </Reveal>

            <Reveal delay={0.08}>
              <div className="flex items-center gap-4">
                <span className="h-px w-10 bg-primary" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary">
                  Qasja jonë
                </p>
              </div>

              <h2 className="mt-6 font-display text-4xl leading-tight tracking-[-0.025em] text-foreground sm:text-5xl">
                Teknologji moderne, e vendosur në shërbim të hapësirës.
              </h2>

              <p className="mt-7 max-w-xl text-base leading-8 text-muted-foreground">
                Për ne, teknologjia nuk duhet ta komplikojë eksperiencën. Ajo
                duhet ta bëjë pronën më të kuptueshme, prezantimin më të plotë
                dhe kontaktin më të natyrshëm.
              </p>

              <div className="mt-10 border-t border-border">
                {approachItems.map((item, index) => (
                  <div
                    key={item.title}
                    className="grid gap-3 border-b border-border py-6 sm:grid-cols-[52px_1fr] sm:gap-5"
                  >
                    <span className="font-display text-lg text-primary">
                      0{index + 1}
                    </span>
                    <div>
                      <h3 className="text-base font-semibold text-foreground">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-sm leading-7 text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* Principles */}
        <section className="px-5 py-24 sm:px-8 sm:py-28 lg:px-10 lg:py-36">
          <div className="mx-auto max-w-7xl">
            <Reveal className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary">
                Parimet tona
              </p>
              <h2 className="mt-5 font-display text-4xl leading-tight tracking-[-0.025em] text-foreground sm:text-5xl">
                Një standard që ndihet në çdo detaj.
              </h2>
              <p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground">
                Dizajni, përmbajtja dhe teknologjia ndjekin të njëjtin qëllim: ta
                bëjnë përvojën e kërkimit më serioze, më të qartë dhe më të
                besueshme.
              </p>
            </Reveal>

            <div className="mt-14 grid gap-5 md:grid-cols-3">
              {principles.map((principle, index) => (
                <Reveal key={principle.number} delay={index * 0.07} className="h-full">
                  <article className="group flex h-full min-h-[320px] flex-col border border-border bg-background p-7 transition-all duration-300 hover:-translate-y-1 hover:border-primary/45 hover:shadow-[0_24px_60px_rgba(7,17,31,0.08)] sm:p-8">
                    <div className="flex items-center justify-between border-b border-border pb-6">
                      <span className="font-display text-2xl text-primary">
                        {principle.number}
                      </span>
                      <span className="h-2 w-2 rounded-full border border-primary/70 transition-colors duration-300 group-hover:bg-primary" />
                    </div>

                    <div className="mt-auto pt-16">
                      <h3 className="font-display text-2xl text-foreground">
                        {principle.title}
                      </h3>
                      <p className="mt-4 text-sm leading-7 text-muted-foreground">
                        {principle.description}
                      </p>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* 360 experience */}
        <section className="relative overflow-hidden bg-[#07111f] px-5 py-24 sm:px-8 sm:py-28 lg:px-10 lg:py-36">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_50%,rgba(212,175,55,0.11),transparent_32%)]" />
          <div
            aria-hidden="true"
            className="absolute inset-y-0 left-[8%] hidden w-px bg-white/[0.06] lg:block"
          />
          <div
            aria-hidden="true"
            className="absolute inset-y-0 right-[8%] hidden w-px bg-white/[0.06] lg:block"
          />

          <div className="relative mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-[0.95fr_1.05fr] lg:gap-24">
            <Reveal>
              <div className="flex items-center gap-4">
                <span className="h-px w-10 bg-[#D4AF37]" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#D4AF37]">
                  Eksperienca virtuale
                </p>
              </div>

              <h2 className="mt-6 font-display text-4xl leading-tight tracking-[-0.025em] text-white sm:text-5xl lg:text-6xl">
                Shihni hapësirën,
                <span className="block font-normal italic text-[#D4AF37]">
                  jo vetëm fotografinë.
                </span>
              </h2>

              <p className="mt-7 max-w-xl text-base leading-8 text-white/65">
                Një fotografi tregon një kënd. Një tur virtual 360° tregon
                marrëdhënien mes ambienteve, ritmin e hapësirës dhe mënyrën se si
                prona përjetohet në tërësi.
              </p>

              <div className="mt-9 space-y-4 border-t border-white/10 pt-8">
                {virtualTourBenefits.map((benefit) => (
                  <div key={benefit} className="flex gap-4">
                    <span className="mt-1 text-[#D4AF37]">
                      <CheckIcon />
                    </span>
                    <p className="text-sm leading-7 text-white/70">{benefit}</p>
                  </div>
                ))}
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <VirtualTourArtwork />
            </Reveal>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="px-5 py-24 sm:px-8 sm:py-28 lg:px-10 lg:py-32">
          <Reveal className="mx-auto max-w-7xl border-y border-border py-14 sm:py-16">
            <div className="grid items-center gap-10 lg:grid-cols-[1fr_auto] lg:gap-16">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary">
                  Hapi i ardhshëm
                </p>
                <h2 className="mt-5 max-w-3xl font-display text-4xl leading-tight tracking-[-0.025em] text-foreground sm:text-5xl">
                  Zbuloni pronën e duhur me një pamje më të plotë.
                </h2>
                <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground">
                  Shfletoni pronat e publikuara ose na kontaktoni për më shumë
                  informacion rreth një hapësire që ju intereson.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
                <Link
                  href="/projects"
                  className="group inline-flex min-h-12 items-center justify-center gap-3 bg-foreground px-7 py-3 text-sm font-semibold text-background transition-colors duration-300 hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  Eksploro pronat
                  <span className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                    <ArrowUpRightIcon />
                  </span>
                </Link>

                <Link
                  href="/contact"
                  className="group inline-flex min-h-12 items-center justify-center gap-3 border border-border bg-background px-7 py-3 text-sm font-semibold text-foreground transition-colors duration-300 hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  Kontakto Aura Estates
                  <span className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                    <ArrowUpRightIcon />
                  </span>
                </Link>
              </div>
            </div>
          </Reveal>
        </section>
      </main>
    </Layout>
  );
}

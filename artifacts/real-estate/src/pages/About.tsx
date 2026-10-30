import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";

// Reuses the architectural image already used on the home page.
const ABOUT_IMAGE = `${import.meta.env.BASE_URL}images/hero-bg.png`;
const DESCRIPTION =
  "Njihuni me Aura Estates, platforma për prezantimin dhe eksplorimin e pronave me informacion të qartë dhe ture virtuale 360°.";

const values = [
  {
    number: "01",
    title: "Informacion i qartë",
    description:
      "Detajet kryesore të pronës, të organizuara për t’u gjetur dhe shqyrtuar lehtë.",
  },
  {
    number: "02",
    title: "Perspektivë në 360°",
    description:
      "Eksploroni ambientet dhe lidhjen mes tyre, nga telefoni apo kompjuteri.",
  },
  {
    number: "03",
    title: "Një hap më afër",
    description:
      "Njiheni hapësirën përpara vizitës dhe na kontaktoni për hapin e ardhshëm.",
  },
];

function ArrowRight() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-[18px] w-[18px] shrink-0"
    >
      <path
        d="M4 12h15m-6-6 6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function About() {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <Layout>
      <Helmet>
        <title>Rreth Nesh | Aura Estates</title>
        <meta name="description" content={DESCRIPTION} />
        <link rel="canonical" href="https://auraks.com/about" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Rreth Nesh | Aura Estates" />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:url" content="https://auraks.com/about" />
        <meta
          property="og:image"
          content="https://auraks.com/images/hero-bg.png"
        />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "AboutPage",
            name: "Rreth Nesh | Aura Estates",
            url: "https://auraks.com/about",
            description: DESCRIPTION,
            inLanguage: "sq",
            about: {
              "@type": "Organization",
              name: "Aura Estates",
              url: "https://auraks.com",
            },
          })}
        </script>
      </Helmet>

      {/* Layout already supplies the page's main landmark and navigation. */}
      <div className="bg-background text-foreground">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <section
            aria-labelledby="about-heading"
            className="pb-10 pt-32 sm:pb-14 sm:pt-36 lg:pb-16 lg:pt-40"
          >
            <p className="mb-7 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:mb-9">
              <span aria-hidden="true" className="h-px w-8 bg-primary" />
              Rreth Aura Estates
            </p>

            <div className="grid gap-7 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:gap-14">
              <h1
                id="about-heading"
                className="max-w-[760px] font-display text-[2.35rem] font-medium leading-[1.12] tracking-[-0.045em] sm:text-5xl xl:text-[3.75rem]"
              >
                Njihni hapësirën.
                <span className="mt-1 block text-muted-foreground">
                  Zgjidhni me qartësi.
                </span>
              </h1>

              <div className="max-w-lg lg:pb-1">
                <p className="text-[15px] leading-7 text-muted-foreground sm:text-base sm:leading-8">
                  Aura Estates bashkon pronat, informacionin dhe turet virtuale
                  360° në një platformë të vetme, për t’ju ndihmuar të njihni
                  hapësirën përpara se ta vizitoni.
                </p>
                <Link
                  href="/projects"
                  className="mt-5 inline-flex min-h-11 items-center gap-3 border-b border-foreground/25 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background motion-reduce:transition-none"
                >
                  Shfletoni pronat
                  <ArrowRight />
                </Link>
              </div>
            </div>
          </section>

          <figure>
            <div className="relative aspect-[4/3] overflow-hidden rounded-sm bg-muted sm:aspect-[16/7] lg:aspect-[16/6]">
              {imageFailed ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
                  <span aria-hidden="true" className="h-px w-12 bg-primary" />
                  <span className="font-display text-3xl font-medium tracking-tight sm:text-5xl">
                    Aura Estates
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Prona dhe ture virtuale 360°
                  </span>
                </div>
              ) : (
                <img
                  src={ABOUT_IMAGE}
                  alt="Pamje arkitekturore e një shtëpie bashkëkohore në mbrëmje"
                  width={1408}
                  height={768}
                  loading="eager"
                  decoding="async"
                  onError={() => setImageFailed(true)}
                  className="h-full w-full object-cover object-center"
                />
              )}
            </div>
            <figcaption className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-border py-4 text-[11px] leading-5 text-muted-foreground sm:text-xs">
              <span>Hapësira në fokus.</span>
              <span>Prezantim i pronave · Ture virtuale 360°</span>
            </figcaption>
          </figure>

          <section
            aria-labelledby="approach-heading"
            className="py-14 sm:py-20 lg:py-24"
          >
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:gap-14">
              <div>
                <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Qasja jonë
                </p>
                <h2
                  id="approach-heading"
                  className="max-w-lg font-display text-[1.8rem] font-medium leading-[1.25] tracking-[-0.035em] sm:text-[2.2rem]"
                >
                  Kujdes në prezantim.
                  <br />
                  Thjeshtësi në eksplorim.
                </h2>
              </div>
              <p className="max-w-lg text-[15px] leading-7 text-muted-foreground sm:text-base sm:leading-8 lg:pt-8">
                Qëllimi ynë është ta bëjmë njohjen e një prone më të thjeshtë.
                Fotografia, detajet dhe përvoja virtuale plotësojnë njëra-tjetrën,
                duke ju dhënë një pamje më të plotë përpara një bisede apo vizite.
              </p>
            </div>

            <ul className="mt-10 grid gap-7 sm:mt-12 md:grid-cols-3 md:gap-10">
              {values.map((value) => (
                <li key={value.number} className="border-t border-border pt-5 sm:pt-6">
                  <span aria-hidden="true" className="text-xs font-medium tracking-wide text-muted-foreground">
                    {value.number}
                  </span>
                  <h3 className="mt-4 text-base font-semibold tracking-[-0.015em]">
                    {value.title}
                  </h3>
                  <p className="mt-2 max-w-sm text-sm leading-7 text-muted-foreground">
                    {value.description}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section aria-labelledby="contact-heading" className="border-t border-border bg-muted/40">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-5 py-10 sm:px-8 sm:py-12 md:flex-row md:items-center md:gap-10">
            <div>
              <h2 id="contact-heading" className="font-display text-2xl font-medium leading-snug tracking-[-0.025em] sm:text-[1.75rem]">
                Le të flasim për pronën tuaj.
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-7 text-muted-foreground">
                Për një prezantim, një tur virtual apo më shumë informacion.
              </p>
            </div>
            <Link
              href="/contact"
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-8 rounded-sm bg-foreground px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background motion-reduce:transition-none"
            >
              Na kontaktoni
              <ArrowRight />
            </Link>
          </div>
        </section>
      </div>
    </Layout>
  );
}

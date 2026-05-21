import { Layout } from "@/components/Layout";
import { Helmet } from "react-helmet-async";
import { FileText, Mail } from "lucide-react";

export default function TermsOfService() {
  const lastUpdated = "Janar 2026";

  return (
    <Layout>
      <Helmet>
        <title>Kushtet e Shërbimit | Aura Estates</title>
        <meta
          name="description"
          content="Lexoni Kushtet e Shërbimit të Aura Estates për përdorimin e faqes, informacionin e pronave dhe turet virtuale."
        />
        <meta property="og:title" content="Kushtet e Shërbimit | Aura Estates" />
        <meta
          property="og:description"
          content="Kushtet për përdorimin e faqes Aura Estates dhe informacionit të publikuar për prona."
        />
        <meta property="og:url" content="https://auraks.com/kushtet-e-sherbimit" />
      </Helmet>

      <div className="bg-background pt-32 pb-24 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest mb-6">
              <FileText size={15} />
              Kushtet
            </div>

            <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">
              Kushtet e Shërbimit
            </h1>

            <p className="text-muted-foreground text-lg leading-relaxed">
              Këto Kushte të Shërbimit përcaktojnë rregullat dhe kushtet për
              përdorimin e faqes Aura Estates, përfshirë shfletimin e pronave,
              kërkesat për informacion dhe përdorimin e tureve virtuale.
            </p>

            <p className="text-sm text-muted-foreground mt-4">
              Përditësuar së fundmi: {lastUpdated}
            </p>
          </div>

          <div className="space-y-8 text-muted-foreground leading-8">
            <section className="glass-panel rounded-2xl p-6 md:p-8">
              <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                1. Pranimi i kushteve
              </h2>
              <p>
                Duke përdorur faqen Aura Estates, ju pajtoheni me këto Kushte të
                Shërbimit. Nëse nuk pajtoheni me ndonjë pjesë të këtyre
                kushteve, ju lutemi të mos e përdorni faqen.
              </p>
            </section>

            <section className="glass-panel rounded-2xl p-6 md:p-8">
              <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                2. Qëllimi i faqes
              </h2>
              <p>
                Aura Estates ofron një platformë online për prezantimin e
                pronave të patundshme. Faqja mund të përfshijë fotografi,
                përshkrime, çmime, lokacione, karakteristika të pronës,
                informacione kontakti dhe ture virtuale 360°.
              </p>
              <p className="mt-4">
                Informacioni i publikuar ka qëllim informues dhe prezantues dhe
                nuk përbën domosdoshmërisht ofertë përfundimtare ligjore ose
                kontraktuale.
              </p>
            </section>

            <section className="glass-panel rounded-2xl p-6 md:p-8">
              <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                3. Saktësia e informacionit
              </h2>
              <p>
                Ne përpiqemi që informacioni për pronat të jetë sa më i saktë
                dhe i përditësuar. Megjithatë, çmimet, disponueshmëria,
                sipërfaqet, karakteristikat, statusi i pronës dhe detajet e
                tjera mund të ndryshojnë pa paralajmërim.
              </p>
              <p className="mt-4">
                Përpara marrjes së çdo vendimi për blerje, qira, vizitë ose
                marrëveshje, përdoruesi duhet të konfirmojë informacionin
                përfundimtar me Aura Estates ose përfaqësuesin përgjegjës të
                pronës.
              </p>
            </section>

            <section className="glass-panel rounded-2xl p-6 md:p-8">
              <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                4. Çmimet dhe disponueshmëria
              </h2>
              <p>
                Çmimet e shfaqura në faqe janë informative dhe mund të ndryshojnë
                varësisht nga pronari, tregu, kushtet e marrëveshjes ose
                përditësimet e fundit të pronës.
              </p>
              <p className="mt-4">
                Publikimi i një prone në faqe nuk garanton që ajo pronë do të
                jetë gjithmonë e disponueshme për shitje ose qira.
              </p>
            </section>

            <section className="glass-panel rounded-2xl p-6 md:p-8">
              <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                5. Fotografitë dhe turet virtuale
              </h2>
              <p>
                Fotografitë, videot, materialet vizuale dhe turet virtuale 360°
                përdoren për prezantim sa më të mirë të pronës. Ato ndihmojnë
                përdoruesin të krijojë një përshtypje paraprake, por nuk
                zëvendësojnë inspektimin fizik të pronës.
              </p>
              <p className="mt-4">
                Pamja reale e pronës mund të ndryshojë për shkak të ndriçimit,
                këndit të fotografimit, mobilimit, përditësimeve të pronës ose
                ndryshimeve të tjera pas publikimit.
              </p>
            </section>

            <section className="glass-panel rounded-2xl p-6 md:p-8">
              <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                6. Kërkesat për informacion dhe kontaktet
              </h2>
              <p>
                Kur dërgoni kërkesë për informacion, planifikim vizite ose
                interesim për një pronë, ju pranoni që Aura Estates ose
                përfaqësuesit e autorizuar të mund t’ju kontaktojnë për t’iu
                përgjigjur kërkesës suaj.
              </p>
              <p className="mt-4">
                Ju jeni përgjegjës për saktësinë e të dhënave që dërgoni përmes
                formularëve ose kanaleve të kontaktit.
              </p>
            </section>

            <section className="glass-panel rounded-2xl p-6 md:p-8">
              <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                7. Përdorimi i lejuar i faqes
              </h2>
              <p>
                Përdoruesit duhet ta përdorin faqen vetëm për qëllime të ligjshme
                dhe në mënyrë që nuk dëmton funksionimin, sigurinë ose
                reputacionin e faqes.
              </p>

              <ul className="list-disc pl-6 mt-4 space-y-2">
                <li>Nuk lejohet përdorimi i faqes për aktivitete mashtruese ose të paligjshme.</li>
                <li>Nuk lejohet ndërhyrja në sistemet teknike të faqes.</li>
                <li>Nuk lejohet kopjimi masiv i përmbajtjes pa autorizim.</li>
                <li>Nuk lejohet përdorimi i materialeve të faqes për qëllime konkurruese pa leje.</li>
              </ul>
            </section>

            <section className="glass-panel rounded-2xl p-6 md:p-8">
              <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                8. Pronësia intelektuale
              </h2>
              <p>
                Logoja, dizajni, tekstet, fotografitë, videot, turet virtuale,
                struktura e faqes dhe materialet e tjera të publikuara në Aura
                Estates mund të jenë pronë e Aura Estates, partnerëve ose
                pronarëve përkatës.
              </p>
              <p className="mt-4">
                Nuk lejohet kopjimi, ripublikimi, shpërndarja ose përdorimi i
                këtyre materialeve pa leje paraprake me shkrim, përveç rasteve
                kur lejohet shprehimisht nga ligji.
              </p>
            </section>

            <section className="glass-panel rounded-2xl p-6 md:p-8">
              <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                9. Linke të jashtme
              </h2>
              <p>
                Faqja mund të përmbajë linke drejt faqeve ose shërbimeve të
                palëve të treta. Aura Estates nuk mban përgjegjësi për
                përmbajtjen, politikat ose praktikat e privatësisë së këtyre
                faqeve të jashtme.
              </p>
            </section>

            <section className="glass-panel rounded-2xl p-6 md:p-8">
              <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                10. Kufizimi i përgjegjësisë
              </h2>
              <p>
                Aura Estates nuk mban përgjegjësi për vendime të marra vetëm mbi
                bazën e informacionit të publikuar në faqe pa konfirmim shtesë.
                Përdoruesit këshillohen të verifikojnë çdo informacion të
                rëndësishëm përpara çdo vendimi financiar, ligjor ose kontraktual.
              </p>
              <p className="mt-4">
                Ne nuk garantojmë që faqja do të jetë gjithmonë pa ndërprerje,
                pa gabime teknike ose pa vonesa, megjithëse përpiqemi të ofrojmë
                shërbim të qëndrueshëm dhe të sigurt.
              </p>
            </section>

            <section className="glass-panel rounded-2xl p-6 md:p-8">
              <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                11. Ndryshimet në kushte
              </h2>
              <p>
                Aura Estates mund t’i përditësojë këto Kushte të Shërbimit herë
                pas here. Versioni më i fundit do të jetë gjithmonë i publikuar
                në këtë faqe.
              </p>
              <p className="mt-4">
                Vazhdimi i përdorimit të faqes pas përditësimit të kushteve
                nënkupton pranimin e ndryshimeve.
              </p>
            </section>

            <section className="rounded-2xl p-6 md:p-8 border border-primary/20 bg-primary/10">
              <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                12. Kontakt
              </h2>
              <p>
                Për pyetje rreth këtyre Kushteve të Shërbimit, mund të na
                kontaktoni në:
              </p>

              <div className="mt-5 flex items-center gap-3 text-foreground">
                <Mail size={18} className="text-primary" />
                <a
                  href="mailto:info@auraks.com"
                  className="hover:text-primary transition-colors"
                >
                  info@auraks.com
                </a>
              </div>
            </section>
          </div>
        </div>
      </div>
    </Layout>
  );
}
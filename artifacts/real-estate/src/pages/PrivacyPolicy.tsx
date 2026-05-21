import { Layout } from "@/components/Layout";
import { Helmet } from "react-helmet-async";
import { Mail, ShieldCheck } from "lucide-react";

export default function PrivacyPolicy() {
  const lastUpdated = "Janar 2026";

  return (
    <Layout>
      <Helmet>
        <title>Politika e Privatësisë | Aura Estates</title>
        <meta
          name="description"
          content="Lexoni Politikën e Privatësisë së Aura Estates dhe mënyrën se si trajtohen të dhënat personale të përdoruesve."
        />
        <meta property="og:title" content="Politika e Privatësisë | Aura Estates" />
        <meta
          property="og:description"
          content="Informacion mbi mbledhjen, përdorimin dhe mbrojtjen e të dhënave personale në Aura Estates."
        />
        <meta property="og:url" content="https://auraks.com/politika-e-privatesise" />
      </Helmet>

      <div className="bg-background pt-32 pb-24 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest mb-6">
              <ShieldCheck size={15} />
              Privatësia
            </div>

            <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">
              Politika e Privatësisë
            </h1>

            <p className="text-muted-foreground text-lg leading-relaxed">
              Kjo Politikë e Privatësisë shpjegon se si Aura Estates mbledh,
              përdor, ruan dhe mbron të dhënat personale të përdoruesve gjatë
              përdorimit të faqes sonë.
            </p>

            <p className="text-sm text-muted-foreground mt-4">
              Përditësuar së fundmi: {lastUpdated}
            </p>
          </div>

          <div className="space-y-8 text-muted-foreground leading-8">
            <section className="glass-panel rounded-2xl p-6 md:p-8">
              <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                1. Kush jemi ne
              </h2>
              <p>
                Aura Estates është një platformë për prezantimin e pronave të
                patundshme, përfshirë fotografi, përshkrime, çmime, të dhëna
                kontakti dhe ture virtuale 360°. Qëllimi ynë është t’u ofrojmë
                klientëve një mënyrë të qartë, moderne dhe profesionale për të
                eksploruar prona.
              </p>
            </section>

            <section className="glass-panel rounded-2xl p-6 md:p-8">
              <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                2. Çfarë të dhënash mund të mbledhim
              </h2>
              <p>
                Kur përdorni faqen tonë ose na kontaktoni, ne mund të mbledhim
                të dhëna të tilla si:
              </p>

              <ul className="list-disc pl-6 mt-4 space-y-2">
                <li>Emri dhe mbiemri, nëse na e dërgoni përmes formularit të kontaktit.</li>
                <li>Adresa e email-it.</li>
                <li>Numri i telefonit.</li>
                <li>Mesazhi ose kërkesa që dërgoni për një pronë të caktuar.</li>
                <li>Interesimi juaj për blerje, qira, vizitë ose informacion shtesë.</li>
                <li>
                  Të dhëna teknike bazë, si lloji i pajisjes, shfletuesi, data
                  dhe ora e vizitës, nëse përdoren mjete analitike ose teknike.
                </li>
              </ul>
            </section>

            <section className="glass-panel rounded-2xl p-6 md:p-8">
              <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                3. Si i përdorim të dhënat
              </h2>
              <p>
                Të dhënat përdoren vetëm për qëllime të lidhura me shërbimin
                tonë dhe komunikimin me klientët. Konkretisht, ato mund të
                përdoren për:
              </p>

              <ul className="list-disc pl-6 mt-4 space-y-2">
                <li>T’iu përgjigjur kërkesave tuaja për prona.</li>
                <li>Të organizuar komunikim ose vizita për prona.</li>
                <li>Të dërguar informacione shtesë rreth një prone që ju intereson.</li>
                <li>Të përmirësuar funksionimin, sigurinë dhe përmbajtjen e faqes.</li>
                <li>Të parandaluar abuzime, keqpërdorime ose aktivitete të paautorizuara.</li>
              </ul>
            </section>

            <section className="glass-panel rounded-2xl p-6 md:p-8">
              <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                4. Baza ligjore për përpunimin e të dhënave
              </h2>
              <p>
                Përpunimi i të dhënave personale bëhet në përputhje me
                legjislacionin në fuqi për mbrojtjen e të dhënave personale në
                Republikën e Kosovës, përfshirë Ligjin Nr. 06/L-082 për
                Mbrojtjen e të Dhënave Personale.
              </p>
              <p className="mt-4">
                Në varësi të rastit, të dhënat mund të përpunohen mbi bazën e
                pëlqimit tuaj, interesit legjitim për t’iu përgjigjur kërkesës,
                ose nevojës për të ndërmarrë hapa para lidhjes së një marrëveshjeje.
              </p>
            </section>

            <section className="glass-panel rounded-2xl p-6 md:p-8">
              <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                5. A i ndajmë të dhënat me palë të treta?
              </h2>
              <p>
                Ne nuk i shesim të dhënat tuaja personale. Të dhënat mund të
                ndahen vetëm kur është e nevojshme për t’iu përgjigjur kërkesës
                suaj, për shembull me agjentë, përfaqësues të pronës, partnerë
                teknikë ose ofrues shërbimesh që ndihmojnë në funksionimin e
                faqes.
              </p>
              <p className="mt-4">
                Në çdo rast, ndarja e të dhënave bëhet vetëm në masën e
                nevojshme dhe për qëllime të arsyeshme të lidhura me shërbimin.
              </p>
            </section>

            <section className="glass-panel rounded-2xl p-6 md:p-8">
              <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                6. Ruajtja e të dhënave
              </h2>
              <p>
                Të dhënat ruhen vetëm për aq kohë sa është e nevojshme për
                qëllimin për të cilin janë mbledhur, për shembull për t’iu
                përgjigjur një kërkese, për të vazhduar komunikimin me klientin
                ose për të përmbushur detyrime ligjore.
              </p>
              <p className="mt-4">
                Kur të dhënat nuk janë më të nevojshme, ato fshihen ose
                anonimizohen në mënyrë të arsyeshme.
              </p>
            </section>

            <section className="glass-panel rounded-2xl p-6 md:p-8">
              <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                7. Siguria e të dhënave
              </h2>
              <p>
                Ne ndërmarrim masa të arsyeshme teknike dhe organizative për të
                mbrojtur të dhënat personale nga qasja e paautorizuar, humbja,
                ndryshimi ose keqpërdorimi.
              </p>
              <p className="mt-4">
                Megjithatë, asnjë sistem online nuk mund të garantojë siguri
                absolute. Për këtë arsye, përdoruesit duhet të shmangin dërgimin
                e informacionit tepër sensitiv përmes formularëve të zakonshëm
                të kontaktit.
              </p>
            </section>

            <section className="glass-panel rounded-2xl p-6 md:p-8">
              <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                8. Cookies dhe teknologji të ngjashme
              </h2>
              <p>
                Faqja mund të përdorë cookies ose teknologji të ngjashme për
                funksionim teknik, përmirësim të eksperiencës së përdoruesit,
                siguri dhe analiza bazë të përdorimit.
              </p>
              <p className="mt-4">
                Nëse në të ardhmen përdoren mjete të avancuara analitike ose
                marketingu, kjo politikë mund të përditësohet për të reflektuar
                përdorimin e tyre.
              </p>
            </section>

            <section className="glass-panel rounded-2xl p-6 md:p-8">
              <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                9. Të drejtat tuaja
              </h2>
              <p>
                Në përputhje me ligjin në fuqi, ju mund të keni të drejtë të:
              </p>

              <ul className="list-disc pl-6 mt-4 space-y-2">
                <li>Kërkoni qasje në të dhënat tuaja personale.</li>
                <li>Kërkoni korrigjimin e të dhënave të pasakta.</li>
                <li>Kërkoni fshirjen e të dhënave kur nuk janë më të nevojshme.</li>
                <li>Kundërshtoni ose kufizoni përpunimin e të dhënave në raste të caktuara.</li>
                <li>Tërhiqni pëlqimin, kur përpunimi bazohet në pëlqim.</li>
              </ul>
            </section>

            <section className="glass-panel rounded-2xl p-6 md:p-8">
              <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                10. Ndryshimet në këtë politikë
              </h2>
              <p>
                Kjo Politikë e Privatësisë mund të përditësohet herë pas here
                për të reflektuar ndryshime në shërbimet tona, në mënyrën e
                përpunimit të të dhënave ose në kërkesat ligjore.
              </p>
              <p className="mt-4">
                Versioni më i fundit do të jetë gjithmonë i publikuar në këtë faqe.
              </p>
            </section>

            <section className="rounded-2xl p-6 md:p-8 border border-primary/20 bg-primary/10">
              <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                11. Kontakt
              </h2>
              <p>
                Për pyetje rreth kësaj Politike të Privatësisë ose për kërkesa
                lidhur me të dhënat tuaja personale, mund të na kontaktoni në:
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
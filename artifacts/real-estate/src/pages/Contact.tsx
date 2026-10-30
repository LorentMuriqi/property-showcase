import { useRef, useState, type FormEvent } from "react";
import { ArrowRight, ArrowUpRight, ChevronDown, Mail, Phone } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import TurnstileWidget from "@/components/TurnstileWidget";
import { useToast } from "@/hooks/use-toast";

const DESCRIPTION =
  "Kontaktoni Aura Estates për prona, prezantime dhe ture virtuale 360°. Na telefononi, na dërgoni email ose përdorni formularin e kontaktit.";

// Keep the existing contact details and phone validation rules.
const PHONE_LENGTHS: Record<string, number> = {
  "+383": 8,
  "+355": 9,
  "+389": 8,
  "+382": 8,
  "+387": 8,
  "+385": 9,
  "+386": 8,
};

const COUNTRIES = [
  { code: "+383", name: "Kosovë", short: "XK" },
  { code: "+355", name: "Shqipëri", short: "AL" },
  { code: "+389", name: "Maqedoni e Veriut", short: "MK" },
  { code: "+382", name: "Mali i Zi", short: "ME" },
  { code: "+387", name: "Bosnje dhe Hercegovinë", short: "BA" },
  { code: "+385", name: "Kroaci", short: "HR" },
  { code: "+386", name: "Slloveni", short: "SI" },
];

const FIELD_CLASS =
  "min-h-12 w-full min-w-0 rounded-sm border border-border bg-background px-3.5 py-3 text-base leading-6 text-foreground placeholder:text-muted-foreground/75 transition-colors hover:border-foreground/30 focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground disabled:cursor-wait disabled:bg-muted motion-reduce:transition-none";
const LABEL_CLASS = "mb-2 block text-sm font-medium text-foreground";
const FOCUS_CLASS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-4 focus-visible:ring-offset-background";

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("0") ? digits.slice(1) : digits;
}

function isPhoneValid(code: string, phone: string) {
  return normalizePhone(phone).length === PHONE_LENGTHS[code];
}

export default function Contact() {
  const { toast } = useToast();
  const [countryCode, setCountryCode] = useState("+383");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [captchaVersion, setCaptchaVersion] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionInFlight = useRef(false);
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_CONTACT_SITE_KEY;
  const phoneInvalid =
    phoneTouched && phoneNumber.length > 0 && !isPhoneValid(countryCode, phoneNumber);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submissionInFlight.current) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      firstName: String(formData.get("firstName") || "").trim(),
      lastName: String(formData.get("lastName") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      countryCode: String(formData.get("countryCode") || "").trim(),
      phoneNumber: normalizePhone(String(formData.get("phoneNumber") || "").trim()),
      requestType: String(formData.get("requestType") || "").trim(),
      message: String(formData.get("message") || "").trim(),
    };

    if (
      !payload.firstName ||
      !payload.lastName ||
      !payload.countryCode ||
      !payload.phoneNumber ||
      !payload.requestType ||
      !payload.message
    ) {
      toast({
        title: "Gabim",
        description: "Ju lutem plotësoni të gjitha fushat e detyrueshme.",
        variant: "destructive",
      });
      return;
    }

    if (!isPhoneValid(payload.countryCode, payload.phoneNumber)) {
      setPhoneTouched(true);
      form.querySelector<HTMLInputElement>('[name="phoneNumber"]')?.focus();
      toast({
        title: "Gabim",
        description: "Numri i telefonit është i pavlefshëm.",
        variant: "destructive",
      });
      return;
    }

    if (!turnstileToken) {
      toast({
        title: "Verifikimi i sigurisë",
        description: "Ju lutemi përfundoni verifikimin e sigurisë.",
        variant: "destructive",
      });
      return;
    }

    submissionInFlight.current = true;
    setIsSubmitting(true);

    try {
      // Preserve the existing endpoint, payload and server-side verification.
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, turnstileToken }),
      });

      const raw = await response.text();
      let serverMessage = "";
      try {
        const data: unknown = raw ? JSON.parse(raw) : null;
        if (
          data &&
          typeof data === "object" &&
          "message" in data &&
          typeof data.message === "string"
        ) {
          serverMessage = data.message;
        }
      } catch {
        // The endpoint may return plain text rather than JSON.
      }

      if (!response.ok) {
        throw new Error(serverMessage || raw || "Nuk u dërgua mesazhi.");
      }

      toast({
        title: "Kërkesa u pranua",
        description: "Mesazhi u dërgua me sukses. Do t’ju kontaktojmë së shpejti.",
      });
      form.reset();
      setCountryCode("+383");
      setPhoneNumber("");
      setPhoneTouched(false);
    } catch (error: unknown) {
      toast({
        title: "Gabim",
        description: error instanceof Error ? error.message : "Nuk u dërgua mesazhi.",
        variant: "destructive",
      });
    } finally {
      setTurnstileToken(null);
      setCaptchaVersion((version) => version + 1);
      submissionInFlight.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <Helmet>
        <title>Kontakt | Aura Estates</title>
        <meta name="description" content={DESCRIPTION} />
        <link rel="canonical" href="https://auraks.com/contact" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Kontakt | Aura Estates" />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:url" content="https://auraks.com/contact" />
      </Helmet>

      <div className="bg-background text-foreground">
        {/* The smallest spacing also accommodates the existing 300px CAPTCHA. */}
        <div className="mx-auto max-w-7xl px-2.5 pb-16 pt-32 min-[360px]:px-5 sm:px-8 sm:pb-20 sm:pt-36 lg:pb-24 lg:pt-40">
          <header className="border-b border-border pb-10 sm:pb-12 lg:pb-14">
            <p className="mb-7 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:mb-9">
              <span aria-hidden="true" className="h-px w-8 bg-primary" />
              Kontakti
            </p>
            <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-end lg:gap-16">
              <h1 className="font-display text-[2.6rem] font-medium leading-[1.12] tracking-[-0.045em] sm:text-5xl xl:text-[3.75rem]">
                Le të flasim.
              </h1>
              <p className="max-w-lg text-[15px] leading-7 text-muted-foreground sm:text-base sm:leading-8 lg:pb-1">
                Për një pronë, një prezantim apo një tur virtual 360°.
                Na tregoni çfarë keni në mendje.
              </p>
            </div>
          </header>

          <div className="grid gap-12 pt-10 sm:gap-14 sm:pt-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:pt-14">
            <section aria-labelledby="direct-contact-heading" className="min-w-0">
              <h2 id="direct-contact-heading" className="font-display text-xl font-medium tracking-[-0.025em] sm:text-2xl">
                Kontakt i drejtpërdrejtë
              </h2>
              <p className="mt-3 max-w-sm text-sm leading-7 text-muted-foreground">
                Na telefononi ose na shkruani në email.
              </p>

              <div className="mt-7 sm:mt-8">
                <a
                  href="tel:+38349123456"
                  aria-label="Telefono Aura Estates në +383 49 123 456"
                  className={`group flex min-h-24 items-center gap-4 border-t border-border py-6 ${FOCUS_CLASS}`}
                >
                  <Phone aria-hidden="true" size={20} strokeWidth={1.5} className="shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-muted-foreground">Telefoni</span>
                    <span className="mt-2 block text-xl font-medium leading-snug tracking-[-0.025em] sm:text-2xl">
                      +383 49 123 456
                    </span>
                  </span>
                  <ArrowUpRight aria-hidden="true" size={20} strokeWidth={1.5} className="shrink-0 text-muted-foreground transition-colors group-hover:text-foreground motion-reduce:transition-none" />
                </a>
                <a
                  href="mailto:info@auraks.com"
                  aria-label="Dërgo email te info@auraks.com"
                  className={`group flex min-h-24 items-center gap-4 border-y border-border py-6 ${FOCUS_CLASS}`}
                >
                  <Mail aria-hidden="true" size={20} strokeWidth={1.5} className="shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-muted-foreground">Emaili</span>
                    <span className="mt-2 block break-words text-xl font-medium leading-snug tracking-[-0.025em] sm:text-2xl">
                      info@auraks.com
                    </span>
                  </span>
                  <ArrowUpRight aria-hidden="true" size={20} strokeWidth={1.5} className="shrink-0 text-muted-foreground transition-colors group-hover:text-foreground motion-reduce:transition-none" />
                </a>
              </div>
            </section>

            <section aria-labelledby="contact-form-heading" className="min-w-0 lg:border-l lg:border-border lg:pl-12 xl:pl-16">
              <h2 id="contact-form-heading" className="font-display text-xl font-medium tracking-[-0.025em] sm:text-2xl">
                Na shkruani
              </h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                Plotësoni formularin dhe do t’ju kontaktojmë.
              </p>

              <form onSubmit={handleSubmit} aria-labelledby="contact-form-heading" aria-busy={isSubmitting} className="mt-7 space-y-5 sm:mt-8">
                <fieldset disabled={isSubmitting} className="min-w-0 space-y-5">
                  <legend className="sr-only">Të dhënat e kontaktit dhe mesazhi</legend>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="min-w-0">
                      <label htmlFor="contact-first-name" className={LABEL_CLASS}>Emri</label>
                      <input id="contact-first-name" name="firstName" required type="text" autoComplete="given-name" className={FIELD_CLASS} />
                    </div>
                    <div className="min-w-0">
                      <label htmlFor="contact-last-name" className={LABEL_CLASS}>Mbiemri</label>
                      <input id="contact-last-name" name="lastName" required type="text" autoComplete="family-name" className={FIELD_CLASS} />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="contact-email" className={LABEL_CLASS}>
                      Emaili <span className="font-normal text-muted-foreground">(opsional)</span>
                    </label>
                    <input id="contact-email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} className={FIELD_CLASS} />
                  </div>

                  <div>
                    <label htmlFor="contact-phone" className={LABEL_CLASS}>Numri i telefonit</label>
                    <div className="grid grid-cols-[116px_minmax(0,1fr)] gap-2 sm:grid-cols-[128px_minmax(0,1fr)] sm:gap-3">
                      <div className="relative min-w-0">
                        <label htmlFor="contact-country-code" className="sr-only">Prefiksi i shtetit</label>
                        <select
                          id="contact-country-code"
                          name="countryCode"
                          required
                          autoComplete="tel-country-code"
                          value={countryCode}
                          onChange={(event) => setCountryCode(event.target.value)}
                          className={`${FIELD_CLASS} appearance-none pl-3 pr-7`}
                        >
                          {COUNTRIES.map(({ code, name, short }) => (
                            <option key={code} value={code} aria-label={`${name} ${code}`}>{short} {code}</option>
                          ))}
                        </select>
                        <ChevronDown aria-hidden="true" size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      </div>
                      <input
                        id="contact-phone"
                        name="phoneNumber"
                        required
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel-national"
                        value={phoneNumber}
                        onChange={(event) => setPhoneNumber(event.target.value)}
                        onBlur={() => setPhoneTouched(true)}
                        aria-invalid={phoneInvalid}
                        aria-describedby={phoneInvalid ? "contact-phone-error" : undefined}
                        className={`${FIELD_CLASS} ${phoneInvalid ? "border-red-600 focus:border-red-600 focus:ring-red-600" : ""}`}
                      />
                    </div>
                    {phoneInvalid && (
                      <p id="contact-phone-error" role="status" className="mt-2 text-sm text-red-700">
                        Kontrolloni numrin e telefonit dhe prefiksin e shtetit.
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="contact-request-type" className={LABEL_CLASS}>Si mund t’ju ndihmojmë?</label>
                    <div className="relative">
                      <select id="contact-request-type" name="requestType" required className={`${FIELD_CLASS} appearance-none pr-10`}>
                        <option value="Blerje e një prone">Blerje e një prone</option>
                        <option value="Shitje e një prone">Shitje e një prone</option>
                        <option value="Shërbime të Turit Virtual">Shërbime të Turit Virtual</option>
                        <option value="Kërkesë e Përgjithshme">Kërkesë e Përgjithshme</option>
                      </select>
                      <ChevronDown aria-hidden="true" size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="contact-message" className={LABEL_CLASS}>Mesazhi</label>
                    <textarea id="contact-message" name="message" required rows={4} placeholder="Na tregoni pak më shumë…" className={`${FIELD_CLASS} min-h-32 resize-y`} />
                  </div>
                </fieldset>

                {turnstileSiteKey ? (
                  <div className="flex justify-start">
                    <TurnstileWidget key={captchaVersion} siteKey={turnstileSiteKey} onVerify={setTurnstileToken} />
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-muted-foreground">
                    Për momentin, na kontaktoni përmes telefonit ose emailit.
                  </p>
                )}

                <button
                  type="submit"
                  disabled={!turnstileToken || isSubmitting}
                  className={`inline-flex min-h-12 w-full items-center justify-between gap-6 rounded-sm bg-foreground px-5 py-3.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none ${FOCUS_CLASS}`}
                >
                  <span role="status" aria-live="polite">{isSubmitting ? "Duke dërguar…" : "Dërgo mesazhin"}</span>
                  <ArrowRight aria-hidden="true" size={18} strokeWidth={1.5} />
                </button>
                <p className="text-xs leading-6 text-muted-foreground">
                  Për trajtimin e të dhënave, lexoni{" "}
                  <Link href="/politika-e-privatesise" className={`rounded-sm underline decoration-border underline-offset-4 transition-colors hover:text-foreground motion-reduce:transition-none ${FOCUS_CLASS}`}>
                    Politikën e Privatësisë
                  </Link>.
                </p>
              </form>
            </section>
          </div>
        </div>
      </div>
    </Layout>
  );
}

import { Layout } from "@/components/Layout";
import { Mail, MapPin, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function Contact() {
  const { toast } = useToast();


const PHONE_LENGTHS: Record<string, number> = {
  "+383": 8, // Kosovë
  "+355": 9, // Shqipëri
  "+389": 8, // Maqedoni e Veriut
  "+382": 8, // Mali i Zi
  "+387": 8, // Bosnje dhe Hercegovinë
  "+385": 9, // Kroaci
  "+386": 8, // Slloveni
};

const [countryCode, setCountryCode] = useState("+383");
const [phoneNumber, setPhoneNumber] = useState("");
const [phoneTouched, setPhoneTouched] = useState(false);

const sanitizePhone = (value: string) => value.replace(/\D/g, "");

const isPhoneValid = (code: string, phone: string) => {
  const digits = sanitizePhone(phone);
  return digits.length === PHONE_LENGTHS[code];
};



const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();

  const form = e.currentTarget;
  const formData = new FormData(form);

const payload = {
  firstName: String(formData.get("firstName") || "").trim(),
  lastName: String(formData.get("lastName") || "").trim(),
  email: String(formData.get("email") || "").trim(),
  countryCode: String(formData.get("countryCode") || "").trim(),
  phoneNumber: sanitizePhone(String(formData.get("phoneNumber") || "").trim()),
  requestType: String(formData.get("requestType") || "").trim(),
  message: String(formData.get("message") || "").trim(),
};

if (
  !payload.firstName ||
  !payload.lastName ||
  !payload.email ||
  !payload.countryCode ||
  !payload.phoneNumber ||
  !payload.requestType ||
  !payload.message
) {
    toast({
      title: "Gabim",
      description: "Ju lutem plotësoni të gjitha fushat.",
      variant: "destructive",
    });
    return;
  }
  if (!isPhoneValid(payload.countryCode, payload.phoneNumber)) {
  setPhoneTouched(true);
  toast({
    title: "Gabim",
    description: "Numri i telefonit është i pavlefshëm.",
    variant: "destructive",
  });
  return;
}

  try {
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });



const raw = await res.text();

let data: any = null;

try {
  data = raw ? JSON.parse(raw) : null;
} catch {
  data = null;
}

if (!res.ok) {
  throw new Error(
    data?.message || raw || "Nuk u dërgua mesazhi."
  );
}



    toast({
      title: "Kërkesa u Pranua",
      description: "Mesazhi u dërgua me sukses. Do t'ju kontaktojmë së shpejti.",
    });

    form.reset();
  } catch (error: any) {
    toast({
      title: "Gabim",
      description: error.message || "Nuk u dërgua mesazhi.",
      variant: "destructive",
    });
  }
};

  return (
    <Layout>
      <div className="bg-background min-h-screen pt-32 pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="mb-16 text-center max-w-3xl mx-auto">
            <h1 className="font-display text-5xl font-bold text-white mb-6"><span className="text-primary italic">Konsultim</span> Privat</h1>
            <p className="text-muted-foreground text-lg">
              Lidhuni me këshilltarët tanë të dedikuar për një diskutim konfidencial në lidhje me portofolin tuaj të pasurive të paluajtshme.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            {/* Contact Info */}
            <div className="space-y-12">
              <div className="glass-panel p-10 rounded-2xl">
                <h3 className="price-font text-2xl text-white mb-8">Selia Globale</h3>
                <div className="space-y-8">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <MapPin size={24} />
                    </div>
                    <div>
                      <h4 className="price-font text-white font-medium mb-1">Zyra</h4>
                      <p className="price-font text-muted-foreground">100 Luxury Way, Suite 500<br/>Beverly Hills, CA 90210<br/>Shtetet e Bashkuara</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Phone size={24} />
                    </div>
                    <div>
                      <h4 className="price-font text-white font-medium mb-1">Linja Direkte</h4>
                      <p className="price-font text-muted-foreground">+1 (310) 555-0198</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Mail size={24} />
                    </div>
                    <div>
                      <h4 className="price-font text-white font-medium mb-1">Email-i</h4>
                      <p className="price-font text-muted-foreground">info@auraks.com</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="glass-panel p-10 rounded-2xl">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/70 uppercase tracking-wider">Emri</label>
                    <input name="firstName" required type="text" className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/70 uppercase tracking-wider">Mbiemri</label>
                    <input name="lastName" required type="text" className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/70 uppercase tracking-wider">Adresa e Email-it</label>
                  <input name="email" required type="email" className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors" />
                </div>
				
				
<div className="space-y-2">
  <label className="text-sm font-medium text-white/70 uppercase tracking-wider">
    Numri i Telefonit
  </label>

  <div className="grid grid-cols-[150px_1fr] gap-3">
    <select
      name="countryCode"
      required
      value={countryCode}
      onChange={(e) => setCountryCode(e.target.value)}
      className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary appearance-none"
    >
      <option value="+383">🇽🇰 +383</option>
      <option value="+355">🇦🇱 +355</option>
      <option value="+389">🇲🇰 +389</option>
      <option value="+382">🇲🇪 +382</option>
      <option value="+387">🇧🇦 +387</option>
      <option value="+385">🇭🇷 +385</option>
      <option value="+386">🇸🇮 +386</option>
    </select>

    <input
      name="phoneNumber"
      required
      type="tel"
      inputMode="numeric"
      value={phoneNumber}
      onChange={(e) => setPhoneNumber(e.target.value)}
      onBlur={() => setPhoneTouched(true)}
      placeholder="49 239 568"
      className={`w-full bg-background border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors ${
        phoneTouched && phoneNumber && !isPhoneValid(countryCode, phoneNumber)
          ? "border-red-500"
          : "border-white/10"
      }`}
    />
  </div>

  {phoneTouched && phoneNumber && !isPhoneValid(countryCode, phoneNumber) && (
    <p className="text-sm text-red-400">Numër telefoni i pavlefshëm</p>
  )}
</div>
				
				

                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/70 uppercase tracking-wider">Natyra e Kërkesës</label>
                  <select name="requestType" required className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary appearance-none">
         <option value="Blerje e një prone">Blerje e një prone</option>
<option value="Shitje e një prone">Shitje e një prone</option>
<option value="Shërbime të Turit Virtual">Shërbime të Turit Virtual</option>
<option value="Kërkesë e Përgjithshme">Kërkesë e Përgjithshme</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/70 uppercase tracking-wider">Mesazhi</label>
                 <textarea name="message" required rows={4} className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors resize-none"></textarea>
                </div>

                <button type="submit" className="w-full py-4 bg-primary text-primary-foreground font-bold tracking-widest uppercase text-sm rounded-xl hover:bg-white transition-colors mt-4">
                  Dërgo Kërkesën
                </button>
              </form>
            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
}

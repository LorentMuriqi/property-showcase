import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useForm, useFieldArray } from "react-hook-form";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Image as ImageIcon,
  Link as LinkIcon,
  Code,
  Building2,
  Phone,
  Mail,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

const Input = ({ label, ...props }: any) => (
  <div className="space-y-2">
    <label className="text-xs font-medium text-white/70 uppercase tracking-wider">
      {label}
    </label>
    <input
      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
      {...props}
    />
  </div>
);

export default function AdminProjectForm() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { id } = useParams();
  const isEditing = !!id;
  const { toast } = useToast();

  const [projectToEdit, setProjectToEdit] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      setLocation("/admin/login");
    }
  }, [authLoading, isAdmin, setLocation]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
  } = useForm<any>({
    defaultValues: {
      status: "for_sale",
      images: [{ url: "", caption: "", isPrimary: true }],
      customFields: {},
      title: "",
      description: "",
      country: "",
      city: "",
      address: "",
      price: "",
      currency: "",
      areaM2: "",
      propertyType: "",
      bedrooms: "",
      bathrooms: "",
      livingRooms: "",
      floors: "",
      yearBuilt: "",
      virtualTourUrl: "",
      virtualTourEmbedCode: "",
      contactCompany: "",
      contactPhone: "",
      contactEmail: "",
      activeDays: 30,
    },
  });

  const {
    fields: imageFields,
    append: appendImage,
    remove: removeImage,
  } = useFieldArray({
    control,
    name: "images",
  });

  useEffect(() => {
    const fetchProject = async () => {
      if (authLoading || !isAdmin || !isEditing || !id) return;

      setIsLoading(true);

      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        console.error("Fetch property error:", error);
        toast({
          title: "Gabim",
          description: "Prona nuk u gjet.",
          variant: "destructive",
        });
        setLocation("/admin");
        return;
      }

      setProjectToEdit(data);
      setIsLoading(false);
    };

    fetchProject();
  }, [authLoading, isAdmin, id, isEditing, setLocation, toast]);

  useEffect(() => {
    if (isEditing && projectToEdit) {
      reset({
        title: projectToEdit.title || "",
        description: projectToEdit.description || "",
        country: projectToEdit.country || "",
        city: projectToEdit.city || "",
        address: projectToEdit.address || "",
        status: projectToEdit.status || "for_sale",
        price: projectToEdit.price ?? "",
        currency: projectToEdit.currency || "",
        areaM2: projectToEdit.area_m2 ?? projectToEdit.areaM2 ?? "",
        propertyType:
          projectToEdit.property_type ?? projectToEdit.propertyType ?? "",
        bedrooms: projectToEdit.bedrooms ?? "",
        bathrooms: projectToEdit.bathrooms ?? "",
        livingRooms:
          projectToEdit.living_rooms ?? projectToEdit.livingRooms ?? "",
        floors: projectToEdit.floors ?? "",
        yearBuilt: projectToEdit.year_built ?? projectToEdit.yearBuilt ?? "",
        virtualTourUrl:
          projectToEdit.virtual_tour_url ?? projectToEdit.virtualTourUrl ?? "",
        virtualTourEmbedCode:
          projectToEdit.virtual_tour_embed_code ??
          projectToEdit.virtualTourEmbedCode ??
          "",
        contactCompany:
          projectToEdit.contact_company ?? projectToEdit.contactCompany ?? "",
        contactPhone:
          projectToEdit.contact_phone ?? projectToEdit.contactPhone ?? "",
        contactEmail:
          projectToEdit.contact_email ?? projectToEdit.contactEmail ?? "",
        images:
          Array.isArray(projectToEdit.images) && projectToEdit.images.length > 0
            ? projectToEdit.images
            : [{ url: "", caption: "", isPrimary: true }],
        activeDays: projectToEdit.active_days ?? 30,
      });
    }
  }, [projectToEdit, isEditing, reset]);

  const onSubmit = async (data: any) => {
    try {
      setIsSaving(true);

      const cleanedImages = (data.images || []).filter(
        (img: any) => img?.url && img.url.trim() !== "",
      );

      const numericFields = [
        "price",
        "areaM2",
        "bedrooms",
        "bathrooms",
        "livingRooms",
        "floors",
        "yearBuilt",
        "activeDays",
      ];

      numericFields.forEach((field) => {
        if (
          data[field] !== null &&
          data[field] !== undefined &&
          data[field] !== ""
        ) {
          data[field] = Number(data[field]);
        } else {
          data[field] = null;
        }
      });

      const nowIso = new Date().toISOString();
      const expiresAt =
        data.activeDays && data.activeDays > 0
          ? new Date(Date.now() + data.activeDays * 24 * 60 * 60 * 1000).toISOString()
          : null;

      const payload = {
        title: data.title || "",
        description: data.description || "",
        country: data.country || "",
        city: data.city || "",
        address: data.address || "",
        status: data.status || "for_sale",
        price: data.price,
        currency: data.currency || "",
        area_m2: data.areaM2,
        property_type: data.propertyType || "",
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        living_rooms: data.livingRooms,
        floors: data.floors,
        year_built: data.yearBuilt,
        virtual_tour_url: data.virtualTourUrl || "",
        virtual_tour_embed_code: data.virtualTourEmbedCode || "",
        contact_company: data.contactCompany || "",
        contact_phone: data.contactPhone || "",
        contact_email: data.contactEmail || "",
        images: cleanedImages,
        location: [data.city, data.country].filter(Boolean).join(", "),
        active_days: data.activeDays,
      };

      if (isEditing) {
        const updatePayload: any = { ...payload };

        if (projectToEdit?.listing_status === "expired" || projectToEdit?.listing_status === "paused") {
          updatePayload.listing_status = "active";
          updatePayload.is_paused = false;
          updatePayload.published_at = nowIso;
          updatePayload.expires_at = expiresAt;
        } else if (data.activeDays) {
          updatePayload.expires_at = expiresAt;
        }

        const { error } = await supabase
          .from("properties")
          .update(updatePayload)
          .eq("id", id);

        if (error) throw error;

        toast({
          title: "Sukses",
          description: "Prona u përditësua me sukses.",
        });
      } else {
        const insertPayload = {
          ...payload,
          listing_status: "active",
          is_paused: false,
          published_at: nowIso,
          expires_at: expiresAt,
        };

        const { error } = await supabase.from("properties").insert([insertPayload]);

        if (error) throw error;

        toast({
          title: "Sukses",
          description: "Prona u krijua me sukses.",
        });
      }

      setLocation("/admin");
    } catch (error: any) {
      console.error("Save property error:", error);
      toast({
        title: "Gabim në ruajtjen e pronës",
        description: error.message || "Ndodhi një gabim i papritur.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || (isEditing && isLoading)) {
    return <div className="p-8 text-white">Loading...</div>;
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-white/5 p-4 md:p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setLocation("/admin")}
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-display text-2xl font-bold text-white leading-none">
              {isEditing ? "Edito Projektin" : "Projekt i Ri"}
            </h1>
            <p className="text-muted-foreground text-xs uppercase tracking-widest mt-1">
              Konfigurimi i Listimit
            </p>
          </div>
        </div>

        <button
          onClick={handleSubmit(onSubmit)}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold tracking-widest uppercase text-sm rounded-xl hover:bg-white transition-colors disabled:opacity-50"
        >
          <Save size={18} />{" "}
          {isSaving ? "Duke ruajtur..." : isEditing ? "Ruaj" : "Publiko"}
        </button>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 mt-8">
        <form className="space-y-8">
          <div className="glass-panel p-6 md:p-8 rounded-2xl space-y-6">
            <h2 className="font-display text-xl text-primary border-b border-white/10 pb-4">
              Detajet Thelbësore
            </h2>

            <Input
              label="Titulli i Pronës *"
              {...register("title", { required: true })}
              placeholder="P.sh., Vila e Luksit"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Shteti *"
                {...register("country", { required: true })}
              />
              <Input
                label="Qyteti *"
                {...register("city", { required: true })}
              />
              <Input label="Adresa e Rrugës" {...register("address")} />

              <div className="space-y-2">
                <label className="text-xs font-medium text-white/70 uppercase tracking-wider">
                  Statusi *
                </label>
                <select
                  {...register("status")}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary appearance-none cursor-pointer"
                >
                  <option value="for_sale">Në Shitje</option>
				{/* <option value="sold">Shitur</option> */}
				{/* <option value="rented">Dhënë me Qira</option> */}
                  <option value="for_rent">Me Qira</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Aktiv për sa ditë"
                type="number"
                min="1"
                {...register("activeDays")}
              />
              <div className="space-y-2">
                <label className="text-xs font-medium text-white/70 uppercase tracking-wider">
                  Shënim
                </label>
                <div className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white/60">
                  Pas skadimit, projekti largohet nga faqja publike dhe mbetet vetëm në admin si “Skaduar”.
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-white/70 uppercase tracking-wider">
                Përshkrimi
              </label>
              <textarea
                {...register("description")}
                rows={5}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary resize-none"
              />
            </div>
          </div>

          <div className="glass-panel p-6 md:p-8 rounded-2xl space-y-6">
            <h2 className="font-display text-xl text-primary border-b border-white/10 pb-4">
              Specifikimet
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <Input label="Çmimi" type="number" {...register("price")} />
              <Input
                label="Monedha"
                {...register("currency")}
                placeholder="USD"
              />
              <Input
                label="Sipërfaqja (m²)"
                type="number"
                {...register("areaM2")}
              />
              <Input
                label="Lloji i Pronës"
                {...register("propertyType")}
                placeholder="Vilë, Apartament..."
              />
              <Input
                label="Dhoma Gjumi"
                type="number"
                {...register("bedrooms")}
              />
              <Input
                label="Banjo"
                type="number"
                {...register("bathrooms")}
              />
              <Input
                label="Dhoma Ndenjeje"
                type="number"
                {...register("livingRooms")}
              />
              <Input label="Kate" type="number" {...register("floors")} />
              <Input
                label="Viti i Ndërtimit"
                type="number"
                {...register("yearBuilt")}
              />
            </div>
          </div>

          <div className="glass-panel p-6 md:p-8 rounded-2xl space-y-6 border-l-4 border-l-primary">
            <h2 className="font-display text-xl text-primary border-b border-white/10 pb-4 flex items-center gap-2">
              Eksperienca Virtuale (Tur 360°)
            </h2>
            <p className="text-sm text-muted-foreground">
              Ofroni një link direkt për turin OSE kod embed (iframe) nga
              ofrues si Kuula, Matterport etj.
            </p>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-medium text-white/70 uppercase tracking-wider flex items-center gap-2">
                  <LinkIcon size={14} />
                  URL e Turit
                </label>
                <input
                  type="url"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                  {...register("virtualTourUrl")}
                  placeholder="https://kuula.co/share/..."
                />
              </div>

              <div className="flex items-center gap-4 text-white/30 uppercase text-xs font-bold before:flex-1 before:h-px before:bg-white/10 after:flex-1 after:h-px after:bg-white/10">
                OSE
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-white/70 uppercase tracking-wider flex items-center gap-2">
                  <Code size={14} />
                  Kodi Embed (HTML)
                </label>
                <textarea
                  rows={4}
                  className="w-full font-mono text-sm bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-primary/80 focus:outline-none focus:border-primary resize-none"
                  {...register("virtualTourEmbedCode")}
                  placeholder="<iframe src='...' allowfullscreen></iframe>"
                />
              </div>
            </div>
          </div>

          <div className="glass-panel p-6 md:p-8 rounded-2xl space-y-6 border-l-4 border-l-primary/60">
            <h2 className="font-display text-xl text-primary border-b border-white/10 pb-4 flex items-center gap-2">
              <Building2 size={20} /> Kontakti i Kompanisë (Kërko Informacion)
            </h2>
            <p className="text-sm text-muted-foreground">
              Këto të dhëna do shfaqen tek seksioni "Kërko Informacion" në
              faqen e pronës.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-medium text-white/70 uppercase tracking-wider flex items-center gap-2">
                  <Building2 size={14} /> Emri i Kompanisë
                </label>
                <input
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
                  {...register("contactCompany")}
                  placeholder="P.sh., Aura Estates SH.P.K."
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-white/70 uppercase tracking-wider flex items-center gap-2">
                  <Phone size={14} /> Numri i Telefonit
                </label>
                <input
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
                  {...register("contactPhone")}
                  placeholder="+355 69 123 4567"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-white/70 uppercase tracking-wider flex items-center gap-2">
                  <Mail size={14} /> Adresa Email
                </label>
                <input
                  type="email"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
                  {...register("contactEmail")}
                  placeholder="info@kompania.al"
                />
              </div>
            </div>
          </div>

          <div className="glass-panel p-6 md:p-8 rounded-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="font-display text-xl text-primary flex items-center gap-2">
                <ImageIcon size={20} /> Galeria e Fotove
              </h2>

              <button
                type="button"
                onClick={() =>
                  appendImage({
                    url: "",
                    caption: "",
                    isPrimary: imageFields.length === 0,
                  })
                }
                className="text-sm text-primary hover:text-white font-medium flex items-center gap-1"
              >
                <Plus size={16} /> Shto Foto
              </button>
            </div>

            <div className="space-y-4">
              {imageFields.map((field, index) => (
                <div
                  key={field.id}
                  className="flex gap-4 items-start bg-black/20 p-4 rounded-xl border border-white/5"
                >
                  <div className="flex-1 space-y-4">
                    <input
                      {...register(`images.${index}.url` as const)}
                      placeholder="URL e Fotos (https://...)"
                      className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                    />
                    <input
                      {...register(`images.${index}.caption` as const)}
                      placeholder="Përshkrimi (Opsionale)"
                      className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                    />
                  </div>

                  <div className="flex flex-col items-center gap-4 pt-2">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="radio"
                        name="primaryImage"
                        checked={!!watch(`images.${index}.isPrimary`)}
                        onChange={() => {
                          imageFields.forEach((_, i) => {
                            setValue(`images.${i}.isPrimary`, false);
                          });
                          setValue(`images.${index}.isPrimary`, true);
                        }}
                        className="accent-primary"
                      />
                      Kryesore
                    </label>

                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="text-destructive hover:text-red-400 p-2 bg-destructive/10 rounded-lg"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}

              {imageFields.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  Nuk u shtuan foto. Kliko "Shto Foto" më sipër.
                </p>
              )}
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
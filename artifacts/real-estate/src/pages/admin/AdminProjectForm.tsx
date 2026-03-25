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
  const numericId = id ? Number(id) : null;
  const { toast } = useToast();

  const [projectToEdit, setProjectToEdit] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      setLocation("/admin/login");
    }
  }, [authLoading, isAdmin, setLocation]);

  const { register, control, handleSubmit, reset, watch, setValue } = useForm<any>({
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
    },
  });

  const { fields: imageFields, append: appendImage, remove: removeImage } = useFieldArray({
    control,
    name: "images",
  });

  useEffect(() => {
    const fetchProject = async () => {
<<<<<<< HEAD
      if (authLoading || !isAdmin || !isEditing || !id) return;
=======
      if (authLoading || !isAdmin || !isEditing || !numericId) return;
>>>>>>> 7664624 (fix project details with supabase uuid)

      setIsLoading(true);

      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .eq("id", numericId)
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
<<<<<<< HEAD
  }, [authLoading, isAdmin, id, isEditing, setLocation, toast]);
=======
  }, [authLoading, isAdmin, isEditing, numericId, setLocation, toast]);
>>>>>>> 7664624 (fix project details with supabase uuid)

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
        propertyType: projectToEdit.property_type ?? projectToEdit.propertyType ?? "",
        bedrooms: projectToEdit.bedrooms ?? "",
        bathrooms: projectToEdit.bathrooms ?? "",
        livingRooms: projectToEdit.living_rooms ?? projectToEdit.livingRooms ?? "",
        floors: projectToEdit.floors ?? "",
        yearBuilt: projectToEdit.year_built ?? projectToEdit.yearBuilt ?? "",
<<<<<<< HEAD
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
=======
        virtualTourUrl: projectToEdit.virtual_tour_url ?? projectToEdit.virtualTourUrl ?? "",
        virtualTourEmbedCode:
          projectToEdit.virtual_tour_embed_code ?? projectToEdit.virtualTourEmbedCode ?? "",
        contactCompany: projectToEdit.contact_company ?? projectToEdit.contactCompany ?? "",
        contactPhone: projectToEdit.contact_phone ?? projectToEdit.contactPhone ?? "",
        contactEmail: projectToEdit.contact_email ?? projectToEdit.contactEmail ?? "",
>>>>>>> 7664624 (fix project details with supabase uuid)
        images:
          Array.isArray(projectToEdit.images) && projectToEdit.images.length > 0
            ? projectToEdit.images
            : [{ url: "", caption: "", isPrimary: true }],
<<<<<<< HEAD
        customFields:
          projectToEdit.custom_fields ?? projectToEdit.customFields ?? {},
=======
        customFields: projectToEdit.custom_fields ?? projectToEdit.customFields ?? {},
>>>>>>> 7664624 (fix project details with supabase uuid)
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
      ];

      numericFields.forEach((field) => {
        if (data[field] !== null && data[field] !== undefined && data[field] !== "") {
          data[field] = Number(data[field]);
        } else {
          data[field] = null;
        }
      });

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
        custom_fields: data.customFields || {},
        location: [data.city, data.country].filter(Boolean).join(", "),
      };

<<<<<<< HEAD
      if (isEditing) {
        const { error } = await supabase.from("properties").update(payload).eq("id", id);
=======
      if (isEditing && numericId) {
        const { error } = await supabase
          .from("properties")
          .update(payload)
          .eq("id", numericId);

>>>>>>> 7664624 (fix project details with supabase uuid)
        if (error) throw error;
      } else {
        const { error } = await supabase.from("properties").insert([payload]);
        if (error) throw error;
      }

      toast({
        title: "Sukses",
        description: isEditing
          ? "Prona u përditësua me sukses."
          : "Prona u krijua me sukses.",
      });

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
<<<<<<< HEAD
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
          {/* pjesa tjetër e UI mbetet fiks si te kodi yt aktual */}
        </form>
      </main>
    </div>
=======
    // UI i njëjtë siç e ke
>>>>>>> 7664624 (fix project details with supabase uuid)
  );
}
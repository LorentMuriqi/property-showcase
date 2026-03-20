import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useForm, useFieldArray } from "react-hook-form";
import { ArrowLeft, Save, Plus, Trash2, Image as ImageIcon, Link as LinkIcon, Code } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useGetProject, useCreateProject, useUpdateProject } from "@workspace/api-client-react";
import type { CreateProjectRequest } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

// Helper component for styled inputs
const Input = ({ label, ...props }: any) => (
  <div className="space-y-2">
    <label className="text-xs font-medium text-white/70 uppercase tracking-wider">{label}</label>
    <input 
      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
      {...props}
    />
  </div>
);

export default function AdminProjectForm() {
  const { isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const { id } = useParams();
  const isEditing = !!id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAdmin) setLocation("/admin/login");
  }, [isAdmin, setLocation]);

  const { data: projectToEdit, isLoading } = useGetProject(Number(id), { query: { enabled: isEditing } });
  
  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject();

  const { register, control, handleSubmit, reset, watch, setValue } = useForm<CreateProjectRequest>({
    defaultValues: {
      status: "for_sale",
      images: [{ url: "", caption: "", isPrimary: true }],
      customFields: {}
    }
  });

  const { fields: imageFields, append: appendImage, remove: removeImage } = useFieldArray({
    control,
    name: "images"
  });

  useEffect(() => {
    if (isEditing && projectToEdit) {
      // Omit id and dates for the form
      const { id, createdAt, updatedAt, ...formData } = projectToEdit as any;
      reset(formData);
    }
  }, [projectToEdit, isEditing, reset]);

  const onSubmit = async (data: CreateProjectRequest) => {
    try {
      // Clean up empty images
      data.images = data.images?.filter(img => img.url.trim() !== "");
      
      // Ensure numeric fields are actually numbers if provided as strings by input
      const numericFields = ['price', 'areaM2', 'bedrooms', 'bathrooms', 'livingRooms', 'floors', 'yearBuilt'];
      numericFields.forEach(field => {
        if (data[field as keyof CreateProjectRequest] !== null && data[field as keyof CreateProjectRequest] !== undefined && data[field as keyof CreateProjectRequest] !== "") {
          (data as any)[field] = Number(data[field as keyof CreateProjectRequest]);
        } else {
          (data as any)[field] = null;
        }
      });

      if (isEditing) {
        await updateMutation.mutateAsync({ id: Number(id), data });
        toast({ title: "Sukses", description: "Prona u përditësua me sukses." });
      } else {
        await createMutation.mutateAsync({ data });
        toast({ title: "Sukses", description: "Prona u krijua me sukses." });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setLocation("/admin");
    } catch (error: any) {
      toast({ 
        title: "Gabim në ruajtjen e pronës", 
        description: error.message || "Ndodhi një gabim i papritur.",
        variant: "destructive"
      });
    }
  };

  if (isEditing && isLoading) return <div className="p-8 text-white">Loading...</div>;
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      
      {/* Header Bar */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-white/5 p-4 md:p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => setLocation("/admin")} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-display text-2xl font-bold text-white leading-none">
              {isEditing ? "Edito Projektin" : "Projekt i Ri"}
            </h1>
            <p className="text-muted-foreground text-xs uppercase tracking-widest mt-1">Konfigurimi i Listimit</p>
          </div>
        </div>
        <button 
          onClick={handleSubmit(onSubmit)}
          disabled={createMutation.isPending || updateMutation.isPending}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold tracking-widest uppercase text-sm rounded-xl hover:bg-white transition-colors disabled:opacity-50"
        >
          <Save size={18} /> {isEditing ? "Ruaj" : "Publiko"}
        </button>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 mt-8">
        <form className="space-y-8">
          
          {/* Basic Info */}
          <div className="glass-panel p-6 md:p-8 rounded-2xl space-y-6">
            <h2 className="font-display text-xl text-primary border-b border-white/10 pb-4">Detajet Thelbësore</h2>
            
            <Input label="Titulli i Pronës *" {...register("title", { required: true })} placeholder="P.sh., Vila e Luksit" />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input label="Shteti *" {...register("country", { required: true })} />
              <Input label="Qyteti *" {...register("city", { required: true })} />
              <Input label="Adresa e Rrugës" {...register("address")} />
              
              <div className="space-y-2">
                <label className="text-xs font-medium text-white/70 uppercase tracking-wider">Statusi *</label>
                <select 
                  {...register("status")}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary appearance-none cursor-pointer"
                >
                  <option value="for_sale">Në Shitje</option>
                  <option value="sold">Shitur</option>
                  <option value="rented">Dhënë me Qira</option>
                  <option value="for_rent">Me Qira</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-white/70 uppercase tracking-wider">Përshkrimi</label>
              <textarea 
                {...register("description")} 
                rows={5}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary resize-none"
              />
            </div>
          </div>

          {/* Specs */}
          <div className="glass-panel p-6 md:p-8 rounded-2xl space-y-6">
            <h2 className="font-display text-xl text-primary border-b border-white/10 pb-4">Specifikimet</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <Input label="Çmimi" type="number" {...register("price")} />
              <Input label="Monedha" {...register("currency")} placeholder="USD" />
              <Input label="Sipërfaqja (m²)" type="number" {...register("areaM2")} />
              <Input label="Lloji i Pronës" {...register("propertyType")} placeholder="Vilë, Apartament..." />
              <Input label="Dhoma Gjumi" type="number" {...register("bedrooms")} />
              <Input label="Banjo" type="number" {...register("bathrooms")} />
              <Input label="Dhoma Ndenjeje" type="number" {...register("livingRooms")} />
              <Input label="Kate" type="number" {...register("floors")} />
              <Input label="Viti i Ndërtimit" type="number" {...register("yearBuilt")} />
            </div>
          </div>

          {/* Virtual Tour */}
          <div className="glass-panel p-6 md:p-8 rounded-2xl space-y-6 border-l-4 border-l-primary">
            <h2 className="font-display text-xl text-primary border-b border-white/10 pb-4 flex items-center gap-2">
              Eksperienca Virtuale (Tur 360°)
            </h2>
            <p className="text-sm text-muted-foreground">Ofroni një link direkt për turin OSE kod embed (iframe) nga ofrues si Kuula, Matterport etj.</p>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-medium text-white/70 uppercase tracking-wider flex items-center gap-2"><LinkIcon size={14}/> URL e Turit</label>
                <input 
                  type="url"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
                  {...register("virtualTourUrl")}
                  placeholder="https://kuula.co/share/..."
                />
              </div>
              <div className="flex items-center gap-4 text-white/30 uppercase text-xs font-bold before:flex-1 before:h-px before:bg-white/10 after:flex-1 after:h-px after:bg-white/10">OSE</div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-white/70 uppercase tracking-wider flex items-center gap-2"><Code size={14}/> Kodi Embed (HTML)</label>
                <textarea 
                  rows={4}
                  className="w-full font-mono text-sm bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-primary/80 focus:outline-none focus:border-primary resize-none"
                  {...register("virtualTourEmbedCode")}
                  placeholder="<iframe src='...' allowfullscreen></iframe>"
                />
              </div>
            </div>
          </div>

          {/* Image Gallery */}
          <div className="glass-panel p-6 md:p-8 rounded-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="font-display text-xl text-primary flex items-center gap-2">
                <ImageIcon size={20} /> Galeria e Fotove
              </h2>
              <button 
                type="button"
                onClick={() => appendImage({ url: "", caption: "", isPrimary: imageFields.length === 0 })}
                className="text-sm text-primary hover:text-white font-medium flex items-center gap-1"
              >
                <Plus size={16} /> Shto Foto
              </button>
            </div>
            
            <div className="space-y-4">
              {imageFields.map((field, index) => (
                <div key={field.id} className="flex gap-4 items-start bg-black/20 p-4 rounded-xl border border-white/5">
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
                        checked={watch(`images.${index}.isPrimary`)}
                        onChange={() => {
                          // set all to false, then this to true
                          imageFields.forEach((_, i) => setValue(`images.${i}.isPrimary`, false));
                          setValue(`images.${index}.isPrimary`, true);
                        }}
                        className="accent-primary"
                      /> Kryesore
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
                <p className="text-center text-muted-foreground py-4">Nuk u shtuan foto. Kliko "Shto Foto" më sipër.</p>
              )}
            </div>
          </div>

        </form>
      </main>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useParams } from "wouter";
import PropertyVirtualTourViewer from "@/components/PropertyVirtualTourViewer";
import { supabase } from "@/lib/supabase";

type PropertyStatus = {
  id: string;
  title: string | null;
  listing_status: string | null;
  is_paused: boolean | null;
  expires_at: string | null;
  virtual_tour_status: string | null;
};

function isTourAvailable(property: PropertyStatus | null) {
  if (!property) return false;
  if (property.virtual_tour_status !== "published") return false;
  if (property.listing_status !== "active") return false;
  if (property.is_paused) return false;

  if (property.expires_at) {
    const expiresAt = new Date(property.expires_at).getTime();
    if (Number.isFinite(expiresAt) && expiresAt < Date.now()) return false;
  }

  return true;
}

export default function PublicVirtualTour() {
  const { id } = useParams();
  const [property, setProperty] = useState<PropertyStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    const loadProperty = async () => {
      if (!id) {
        setProperty(null);
        setIsAvailable(false);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      const { data, error } = await supabase
        .from("properties")
        .select(`
          id,
          title,
          listing_status,
          is_paused,
          expires_at,
          virtual_tour_status
        `)
        .eq("id", id)
        .single();

      if (error || !data) {
        setProperty(null);
        setIsAvailable(false);
      } else {
        setProperty(data);
        setIsAvailable(isTourAvailable(data));
      }

      setIsLoading(false);
    };

    loadProperty();
  }, [id]);

  if (isLoading) {
    return (
      <div className="w-screen h-[100dvh] bg-black flex items-center justify-center text-white">
        Duke ngarkuar turin virtual...
      </div>
    );
  }

  if (!isAvailable || !property || !id) {
    return (
      <div className="w-screen h-[100dvh] bg-black flex items-center justify-center px-6 text-center">
        <div>
          <h1 className="text-white text-2xl font-bold mb-3">
            Virtual tour nuk është i disponueshëm
          </h1>
          <p className="text-white/60 max-w-md">
            Ky tur virtual mund të jetë në draft, i skaduar, i pezulluar ose i larguar nga platforma.
          </p>
        </div>
      </div>
    );
  }

  return (
    <PropertyVirtualTourViewer
      propertyId={id}
      onClose={() => {
        window.history.back();
      }}
    />
  );
}
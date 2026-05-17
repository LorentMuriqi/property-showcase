import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { supabase } from "@/lib/supabase";
import { VirtualTour360 } from "@/components/VirtualTour360";

type PublicTourResponse = {
  available: boolean;
  reason?: string;
  tour?: {
    id: string;
    title: string;
    expiresAt: string | null;
  };
  scenes?: any[];
};

export default function PublicClientVirtualTour() {
  const { token } = useParams();
  const [data, setData] = useState<PublicTourResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTour = async () => {
      if (!token) {
        setData({ available: false, reason: "not_found" });
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      const { data, error } = await supabase.rpc("get_client_virtual_tour", {
        p_token: token,
      });

      if (error || !data) {
        setData({ available: false, reason: "not_found" });
      } else {
        setData(data as PublicTourResponse);
      }

      setIsLoading(false);
    };

    loadTour();
  }, [token]);

  if (isLoading) {
    return (
      <div className="w-screen h-[100dvh] bg-black flex items-center justify-center text-white">
        Duke ngarkuar turin virtual...
      </div>
    );
  }

  if (!data?.available || !data.scenes || data.scenes.length === 0) {
    return (
      <div className="w-screen h-[100dvh] bg-black flex items-center justify-center px-6 text-center">
        <div>
          <h1 className="text-white text-2xl font-bold mb-3">
            Virtual tour nuk është i disponueshëm
          </h1>
          <p className="text-white/60 max-w-md">
            Ky tur virtual mund të jetë i skaduar, i pezulluar ose i larguar nga platforma.
          </p>
        </div>
      </div>
    );
  }

  const defaultScene = data.scenes.find((scene) => scene.isDefault);

  return (
    <VirtualTour360
      scenes={data.scenes}
      defaultSceneId={defaultScene?.id ?? data.scenes[0]?.id}
      onClose={() => {
        window.history.back();
      }}
    />
  );
}
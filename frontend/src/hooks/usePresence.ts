import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export interface PresenceUser {
  user_id: string;
  nombre: string;
  apellido: string;
}

export function usePresence(
  informeId: string,
  currentUser: { id: string; nombre: string; apellido: string } | null
): PresenceUser[] {
  const [others, setOthers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!informeId || !currentUser || !import.meta.env.VITE_SUPABASE_URL) return;

    const channel = supabase.channel(`informe:${informeId}`, {
      config: { presence: { key: currentUser.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceUser>();
        const all = Object.values(state).flat();
        setOthers(all.filter((u) => u.user_id !== currentUser.id));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: currentUser.id,
            nombre: currentUser.nombre,
            apellido: currentUser.apellido,
          });
        }
      });

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [informeId, currentUser]);

  return others;
}

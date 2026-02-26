import { useState } from "react";
import { MOLTBOOK_AGENT } from "@/lib/moltbook-config";
import { useToast } from "@/hooks/use-toast";

export function useMoltbook() {
  const [isRegistering, setIsRegistering] = useState(false);
  const { toast } = useToast();

  const registerAgent = async () => {
    setIsRegistering(true);
    console.log("📡 Conectando con el registro de Moltbook...");
    
    try {
      const response = await fetch(MOLTBOOK_AGENT.endpoints.registry, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Limpiamos nombres y añadimos symbol para evitar el Error 400
          name: "Ai Tor", 
          symbol: "AITOR",
          description: "Agente autonomo de AlienFlow DAO. Operando en frecuencia 3-6-9.",
          category: "reasoning"
        }),
      });

      const data = await response.json();
      console.log("📦 Respuesta del Oráculo:", data);

      // Verificamos si la respuesta fue exitosa
      if (!response.ok) {
        console.error("❌ Error de Moltbook:", data.message || "Petición rechazada");
        return null;
      }

      const agent = data.agent || data;

      if (agent && agent.claim_url) {
        // Guardamos la key para el futuro
        localStorage.setItem("moltbook_api_key", agent.api_key);
        
        toast({
          title: "¡Portal Abierto!",
          description: "Redirigiendo a la verificación de X...",
        });

        // Intentamos abrir la URL directamente
        window.open(agent.claim_url, "_blank");

        return agent; 
      } else {
        console.error("❌ La respuesta no contiene claim_url o api_key:", data);
        return null;
      }
    } catch (error) {
      console.error("❌ Error de red:", error);
      toast({
        title: "Error de Enlace",
        description: "Revisa tu conexión o el estado del oráculo.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsRegistering(false);
    }
  };

  return { registerAgent, isRegistering };
}

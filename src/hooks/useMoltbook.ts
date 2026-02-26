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
          name: MOLTBOOK_AGENT.name,
          description: "Agente autónomo de la ΔlieπFlΦw DAO. Operando en frecuencia 3-6-9.",
        }),
      });

      const data = await response.json();
      console.log("📦 Respuesta del Oráculo:", data);

      // Algunos endpoints de Moltbook devuelven el objeto directo o dentro de .agent
      const agent = data.agent || data;

      if (agent && agent.claim_url) {
        localStorage.setItem("moltbook_api_key", agent.api_key);
        
        toast({
          title: "¡Portal Abierto!",
          description: "Redirigiendo a la verificación de X...",
        });

        return agent; 
      } else {
        console.error("❌ La respuesta no contiene claim_url:", data);
        return null;
      }
    } catch (error) {
      console.error("❌ Error de red:", error);
      toast({
        title: "Error de Enlace",
        description: "No se pudo conectar con el oráculo.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsRegistering(false);
    }
  };

  return { registerAgent, isRegistering };
}

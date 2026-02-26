import { useState } from "react";
import { MOLTBOOK_AGENT } from "@/lib/moltbook-config";
import { useToast } from "@/hooks/use-toast";

export function useMoltbook() {
  const [isRegistering, setIsRegistering] = useState(false);
  const { toast } = useToast();

  const registerAgent = async () => {
    setIsRegistering(true);
    console.log("📡 Sincronizando con el Oráculo...");
    
    try {
      const response = await fetch("https://www.moltbook.com/api/v1/agents/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Ai Tor",
          symbol: "aitor69",
          twitter: "Alien69Flow",
          description: "Agente autonomo de AlienFlow DAO. Frecuencia 3-6-9.",
          wallet_address: "0x399caF0800F105E69BBA6729383E67fcF2117d4c",
          category: "reasoning"
        }),
      });

      const data = await response.json();
      console.log("📦 Respuesta del Oráculo:", data);

      if (!response.ok) {
        // Debug detallado de los errores
        console.error("❌ Errores detectados:", data.error || data.message);
        toast({
          title: "Error de Registro",
          description: Array.isArray(data.error) ? data.error[0] : (data.message || "Datos inválidos"),
          variant: "destructive",
        });
        return null;
      }

      const agent = data.agent || data;

      if (agent && agent.claim_url) {
        localStorage.setItem("moltbook_api_key", agent.api_key);
        
        toast({
          title: "¡Portal Detectado!",
          description: "Abriendo verificación en X...",
        });

        // Pequeño delay para que el navegador no bloquee el pop-up
        setTimeout(() => {
          window.open(agent.claim_url, "_blank");
        }, 500);

        return agent; 
      }
      
      return null;
    } catch (error) {
      console.error("❌ Error de red fatal:", error);
      return null;
    } finally {
      setIsRegistering(false);
    }
  };

  return { registerAgent, isRegistering };
}

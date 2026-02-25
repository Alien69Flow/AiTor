// src/hooks/useMoltbook.ts
import { useState } from "react";
import { MOLTBOOK_AGENT } from "@/lib/moltbook-config";
import { useToast } from "@/hooks/use-toast";

export function useMoltbook() {
  const [isRegistering, setIsRegistering] = useState(false);
  const { toast } = useToast();

  const registerAgent = async () => {
    setIsRegistering(true);
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

      if (data.agent) {
        // Guardamos la API Key en el almacenamiento del navegador (temporalmente)
        // Lo ideal sería guardarlo en tu perfil de Supabase después
        localStorage.setItem("moltbook_api_key", data.agent.api_key);
        
        toast({
          title: "¡Código de Reclamación Generado!",
          description: "Copia la URL para verificar tu agente en X.",
        });

        // Retornamos los datos para que el Sidebar pueda mostrarlos
        return data.agent; 
      }
    } catch (error) {
      toast({
        title: "Error de Enlace",
        description: "No se pudo conectar con el oráculo de Moltbook.",
        variant: "destructive",
      });
    } finally {
      setIsRegistering(false);
    }
  };

  return { registerAgent, isRegistering };
}

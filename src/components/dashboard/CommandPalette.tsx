import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bot,
  Globe,
  Link2,
  LogIn,
  Orbit,
  Radio,
  Settings,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { OFFICIAL_SOURCES } from "@/lib/live-signals";
import type { TabId } from "@/pages/Index";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const WORKSPACES: { id: TabId; label: string; hint: string; Icon: typeof Bot }[] = [
  { id: "agents", label: "Agentes", hint: "Chat, núcleo y ciudad DAO", Icon: Bot },
  { id: "alien", label: "Alien", hint: "Monitor UAP, cámaras y fuentes", Icon: Radio },
  { id: "cosmos", label: "Cosmos", hint: "Sistema solar y objetos cercanos", Icon: Orbit },
  { id: "globe", label: "Globe", hint: "Globo táctico y capas OSINT", Icon: Globe },
  { id: "markets", label: "Markets", hint: "Cripto, predicciones y señales", Icon: BarChart3 },
  { id: "system", label: "System", hint: "Centro de control y acceso", Icon: Settings },
];

/**
 * ⌘K / Ctrl+K palette: every workspace, the account entry and the official
 * sources one keystroke away. Built on the project's own cmdk dialog so focus
 * trapping and keyboard semantics come from Radix.
 */
export function CommandPalette({ open, onOpenChange, activeTab, onTabChange }: CommandPaletteProps) {
  const navigate = useNavigate();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange]);

  const run = (action: () => void) => {
    onOpenChange(false);
    // Let the dialog unmount before moving focus or navigating.
    window.setTimeout(action, 0);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Enlace copiado");
    } catch {
      toast.error("El navegador bloqueó el portapapeles");
    }
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar sección, cuenta o fuente oficial…" />
      <CommandList>
        <CommandEmpty>Sin resultados.</CommandEmpty>

        <CommandGroup heading="Espacios de trabajo">
          {WORKSPACES.map((workspace) => (
            <CommandItem
              key={workspace.id}
              value={`${workspace.label} ${workspace.hint}`}
              onSelect={() => run(() => onTabChange(workspace.id))}
            >
              <workspace.Icon className="mr-2 h-4 w-4 text-primary/80" aria-hidden="true" />
              <span className="text-[12px]">{workspace.label}</span>
              <span className="ml-2 truncate font-mono text-[10px] text-muted-foreground/60">{workspace.hint}</span>
              {activeTab === workspace.id && <CommandShortcut>actual</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Cuenta">
          <CommandItem value="cuenta iniciar sesión acceso wallet" onSelect={() => run(() => navigate("/auth"))}>
            <LogIn className="mr-2 h-4 w-4 text-secondary/80" aria-hidden="true" />
            <span className="text-[12px]">Iniciar sesión o gestionar la cuenta</span>
          </CommandItem>
          <CommandItem value="niveles planes precios suscripción" onSelect={() => run(() => onTabChange("system"))}>
            <Sparkles className="mr-2 h-4 w-4 text-accent" aria-hidden="true" />
            <span className="text-[12px]">Ver niveles y activar un plan</span>
            <span className="ml-2 font-mono text-[10px] text-muted-foreground/60">System → Acceso</span>
          </CommandItem>
          <CommandItem value="wallet reown conectar" onSelect={() => run(() => onTabChange("system"))}>
            <Wallet className="mr-2 h-4 w-4 text-primary/80" aria-hidden="true" />
            <span className="text-[12px]">Conectar wallet y verificar holdings</span>
          </CommandItem>
          <CommandItem value="copiar enlace compartir" onSelect={() => run(() => void copyLink())}>
            <Link2 className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span className="text-[12px]">Copiar el enlace de esta vista</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Fuentes oficiales">
          {OFFICIAL_SOURCES.slice(0, 10).map((source) => (
            <CommandItem
              key={source.label}
              value={`${source.label} ${source.desc}`}
              onSelect={() =>
                run(() => window.open(source.url, "_blank", "noopener,noreferrer"))
              }
            >
              <ShieldCheck className="mr-2 h-4 w-4 text-cyan-300/70" aria-hidden="true" />
              <span className="text-[12px]">{source.label}</span>
              <span className="ml-2 truncate font-mono text-[10px] text-muted-foreground/60">{source.desc}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Helmet } from "react-helmet-async";
import { z } from "zod";
import { Separator } from "@/components/ui/separator";
import { SpaceBackground } from "@/components/SpaceBackground";
import alienflowLogo from "@/assets/alienflow-logo.png";
import { Mail, Lock, ArrowRight, Loader2, Wallet } from "lucide-react";

const authSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signIn, signUp, signInWithGoogle, signInWithApple, user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate("/", { replace: true });
    }
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = authSchema.safeParse({ email, password });
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }
    setIsSubmitting(true);
    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          toast.error(error.message.includes("Invalid login credentials") 
            ? "Credenciales incorrectas" 
            : error.message);
        } else {
          toast.success("¡Bienvenido, Soberano!");
        }
      } else {
        const { error } = await signUp(email, password);
        if (error) {
          toast.error(error.message.includes("already registered") 
            ? "Este email ya está registrado" 
            : error.message);
        } else {
          toast.success("¡Cuenta creada! Revisa tu email para confirmar tu cuenta.");
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    setIsSubmitting(true);
    try {
      const fn = provider === "google" ? signInWithGoogle : signInWithApple;
      const { error } = await fn();
      if (error) toast.error(error.message || `Error con ${provider}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent shadow-[0_0_15px_rgba(105,175,0,0.4)]" />
          <p className="text-[10px] font-mono text-primary/60 tracking-[0.3em] uppercase animate-pulse">
            Sincronizando identidad...
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{isLogin ? "Iniciar Sesión" : "Registrarse"} | AlienFlow AI Tor</title>
        <meta name="description" content="Accede a AI Tor - Terminal de Inteligencia Autónoma de AlienFlow DAO" />
      </Helmet>
      <SpaceBackground />

      <div className="relative flex min-h-screen items-center justify-center p-4">
        {/* Main Card */}
        <div className="w-full max-w-md relative">
          {/* Glow effect behind card */}
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-secondary/10 to-primary/20 rounded-2xl blur-xl opacity-60" />
          
          <div className="relative border border-primary/20 rounded-2xl bg-card/80 backdrop-blur-xl overflow-hidden shadow-[0_0_40px_rgba(105,175,0,0.1)]">
            {/* Scanline overlay */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(105,175,0,0.1) 2px, rgba(105,175,0,0.1) 4px)'
            }} />

            {/* Header */}
            <div className="relative px-8 pt-8 pb-6 text-center">
              <div className="flex justify-center mb-4">
                <div className="relative group">
                  <div className="absolute -inset-3 bg-primary/10 rounded-full blur-lg group-hover:bg-primary/20 transition-all duration-500" />
                  <img 
                    src={alienflowLogo} 
                    alt="AlienFlow Logo" 
                    className="relative w-20 h-20 object-contain drop-shadow-[0_0_12px_rgba(105,175,0,0.4)] group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              </div>
              <h1 className="text-3xl font-heading tracking-wider">
                <span className="text-secondary drop-shadow-[0_0_8px_rgba(255,215,0,0.3)]">Δlieπ</span>
                <span className="text-primary drop-shadow-[0_0_8px_rgba(105,175,0,0.3)]">FlΦw</span>
              </h1>
              <p className="text-[10px] font-mono text-muted-foreground/70 mt-2 tracking-[0.3em] uppercase">
                {isLogin ? "≡ Acceso al Nexo Soberano ≡" : "≡ Registro de Nueva Identidad ≡"}
              </p>
            </div>

            {/* Content */}
            <div className="px-8 pb-8 space-y-4">
              {/* Social Login Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 border-border/40 bg-card/40 hover:bg-primary/10 hover:border-primary/40 transition-all duration-300 group"
                  onClick={() => handleOAuth("google")}
                  disabled={isSubmitting}
                >
                  <svg className="mr-2 h-4 w-4 opacity-80 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span className="text-xs text-foreground/80">Google</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="h-11 border-border/40 bg-card/40 hover:bg-primary/10 hover:border-primary/40 transition-all duration-300 group"
                  onClick={() => handleOAuth("apple")}
                  disabled={isSubmitting}
                >
                  <svg className="mr-2 h-4 w-4 opacity-80 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                  </svg>
                  <span className="text-xs text-foreground/80">Apple</span>
                </Button>
              </div>

              {/* Wallet Button (decorative/future) */}
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 border-secondary/30 bg-secondary/5 hover:bg-secondary/15 hover:border-secondary/50 transition-all duration-300 group"
                disabled
              >
                <Wallet className="mr-2 h-4 w-4 text-secondary/60 group-hover:text-secondary transition-colors" />
                <span className="text-xs text-secondary/60 group-hover:text-secondary/80">Conectar Wallet</span>
                <span className="ml-2 text-[8px] font-mono text-secondary/40 border border-secondary/20 rounded px-1.5 py-0.5 uppercase">Pronto</span>
              </Button>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full bg-border/30" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-[0.2em]">
                  <span className="bg-card px-3 text-muted-foreground/50 font-mono">o con email</span>
                </div>
              </div>

              {/* Email Form */}
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-[10px] font-mono text-muted-foreground/70 uppercase tracking-wider">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="tu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className="pl-10 h-11 border-border/30 bg-muted/30 focus:border-primary/40 focus:ring-primary/20 transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-[10px] font-mono text-muted-foreground/70 uppercase tracking-wider">Contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete={isLogin ? "current-password" : "new-password"}
                      className="pl-10 h-11 border-border/30 bg-muted/30 focus:border-primary/40 focus:ring-primary/20 transition-all"
                    />
                  </div>
                </div>
                <Button 
                  type="submit" 
                  className="w-full h-11 bg-primary/90 text-primary-foreground hover:bg-primary font-heading tracking-wider uppercase text-sm shadow-[0_0_20px_rgba(105,175,0,0.2)] hover:shadow-[0_0_30px_rgba(105,175,0,0.4)] transition-all duration-300" 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      {isLogin ? "Acceder al Nexo" : "Crear Identidad"}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              {/* Toggle */}
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-[11px] font-mono text-muted-foreground/60 hover:text-primary transition-colors tracking-wide"
                >
                  {isLogin ? "¿Sin identidad? → Crear cuenta" : "¿Ya tienes acceso? → Iniciar sesión"}
                </button>
              </div>

              {/* Disclaimer */}
              <p className="text-[7px] font-mono text-muted-foreground/30 text-center leading-relaxed mt-4">
                Al acceder aceptas los términos del protocolo ΔlieπFlΦw. Tu soberanía digital es sagrada.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

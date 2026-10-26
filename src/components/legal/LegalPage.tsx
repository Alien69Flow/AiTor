import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { SpaceBackground } from "@/components/SpaceBackground";

export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

interface LegalPageProps {
  path: "/privacy" | "/terms";
  title: string;
  description: string;
  /** Fecha de la última revisión del texto, en formato legible. */
  updated: string;
  intro: string;
  sections: LegalSection[];
  /** Enlace a la página hermana (privacidad ↔ términos). */
  other: { to: string; label: string };
}

const SITE = "https://aitor.alienflow.space";
/**
 * Dirección de contacto del responsable del tratamiento. Es la que verá Google
 * al revisar la app OAuth y la que vale para ejercer derechos GDPR, así que
 * tiene que ser un buzón del dominio propio —no un correo personal— y estar
 * vivo, porque aquí es donde llegan las solicitudes de borrado.
 */
export const LEGAL_CONTACT = "contact@alienflow.space";

/**
 * Marco común de las páginas legales. Google revisa estas URLs al publicar la
 * app OAuth, así que tienen que ser páginas con contenido propio y no el
 * catch-all de la SPA: de ahí que sean rutas reales y no un modal.
 */
export function LegalPage({ path, title, description, updated, intro, sections, other }: LegalPageProps) {
  return (
    <>
      <Helmet>
        <title>{title} | Ai Tor</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={`${SITE}${path}`} />
        <meta property="og:title" content={`${title} | Ai Tor`} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={`${SITE}${path}`} />
        <meta property="og:type" content="article" />
        <meta name="twitter:title" content={`${title} | Ai Tor`} />
        <meta name="twitter:description" content={description} />
        <meta name="robots" content="index, follow" />
      </Helmet>

      <SpaceBackground />

      <div className="relative min-h-screen px-4 py-10 md:py-14">
        <div className="mx-auto w-full max-w-3xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-primary/80 transition-colors hover:text-primary"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Volver al terminal
            </Link>
            <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary/70" aria-hidden="true" /> ΔlieπFlΦw DAO
            </span>
          </div>

          <article className="rounded-sm border border-primary/20 bg-card/70 p-5 backdrop-blur-md md:p-8">
            <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-primary/70">Documento legal</p>
            <h1 className="mt-2 font-heading text-2xl tracking-wider text-foreground md:text-3xl">{title}</h1>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Última actualización: {updated}
            </p>

            <p className="mt-5 text-sm leading-relaxed text-foreground/85">{intro}</p>

            {sections.map((section) => (
              <section key={section.heading} className="mt-7">
                <h2 className="font-heading text-base tracking-wide text-primary md:text-lg">{section.heading}</h2>
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph.slice(0, 48)} className="mt-2 text-sm leading-relaxed text-foreground/80">
                    {paragraph}
                  </p>
                ))}
                {section.bullets && (
                  <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-foreground/80">
                    {section.bullets.map((bullet) => (
                      <li key={bullet.slice(0, 48)}>{bullet}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}

            <footer className="mt-9 border-t border-border/50 pt-4 text-sm text-foreground/80">
              <p>
                Contacto para cualquier duda o solicitud:{" "}
                <a className="text-primary underline underline-offset-2" href={`mailto:${LEGAL_CONTACT}`}>
                  {LEGAL_CONTACT}
                </a>
                . También puedes escribir desde{" "}
                <a className="text-primary underline underline-offset-2" href={`${SITE}/auth`}>
                  {SITE.replace("https://", "")}/auth
                </a>
                .
              </p>
              <p className="mt-3">
                <Link className="text-primary underline underline-offset-2" to={other.to}>
                  {other.label}
                </Link>
              </p>
            </footer>
          </article>
        </div>
      </div>
    </>
  );
}

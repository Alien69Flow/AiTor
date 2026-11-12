import type { ReactNode } from "react";
import { Trophy } from "lucide-react";

/**
 * Marco común de las tarjetas del arcade extendido.
 *
 * Es el mismo esqueleto que `GameCard` en `GamesArcade`: título, pista, marca
 * y cuerpo. Vive aparte para que los juegos nuevos no tengan que compartir
 * fichero con los cuatro que ya estaban montados.
 */
export function ArcadeCard({
	title,
	hint,
	icon,
	best,
	children,
}: {
	title: string;
	hint: string;
	icon: ReactNode;
	best: number;
	children: ReactNode;
}) {
	return (
		<section className="flex min-h-0 flex-col rounded-xl border border-border/50 bg-card/50">
			<header className="flex items-start gap-2 border-b border-border/40 px-3 py-2.5">
				<span className="mt-0.5 text-primary">{icon}</span>
				<div className="min-w-0">
					<h2 className="font-heading text-[10px] uppercase tracking-widest text-foreground/85">{title}</h2>
					<p className="mt-0.5 font-mono text-[9px] leading-relaxed text-muted-foreground/55">{hint}</p>
				</div>
				<span className="ml-auto flex shrink-0 items-center gap-1 font-mono text-[9px] text-muted-foreground/50">
					<Trophy className="h-3 w-3" />
					{best}
				</span>
			</header>
			<div className="flex flex-1 flex-col p-3">{children}</div>
		</section>
	);
}

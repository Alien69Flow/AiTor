import { describe, expect, it } from "vitest";
import { KIND_LABEL, MINIAPPS, PLAYABLE_IDS, liveMiniApps, miniAppById, plannedMiniApps } from "./miniapps";

describe("registro de miniapps", () => {
	it("no repite identificadores", () => {
		const ids = MINIAPPS.map((app) => app.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("todo módulo jugable tiene componente y motor, y ninguno diseñado los finge", () => {
		for (const app of liveMiniApps()) {
			expect(app.component, `${app.id} sin componente`).toBeTruthy();
			expect(app.engine, `${app.id} sin motor`).toBeTruthy();
			expect(app.requires, `${app.id} jugable no debe pedir requisitos`).toBeUndefined();
		}
		for (const app of plannedMiniApps()) {
			expect(app.requires, `${app.id} sin requisitos`).toBeTruthy();
			expect(app.component, `${app.id} no debería tener componente`).toBeUndefined();
		}
	});

	it("los módulos jugables son exactamente los que el arcade sabe montar", () => {
		expect(PLAYABLE_IDS).toEqual(liveMiniApps().map((app) => app.id));
		expect(PLAYABLE_IDS).toEqual(["impulse", "memory", "reactor", "veintiuna"]);
	});

	it("cada clase tiene su etiqueta", () => {
		for (const app of MINIAPPS) expect(KIND_LABEL[app.kind]).toBeTruthy();
	});

	it("nada cobra ni paga todavía", () => {
		// Si algún día se conecta un riel real, esta prueba cambia a propósito,
		// junto con la ficha: no antes y no de tapadillo.
		expect(MINIAPPS.filter((app) => app.payouts.state === "activo")).toHaveLength(0);
		for (const app of liveMiniApps()) {
			expect(app.payouts.rail).toBe("ninguno");
			expect(app.payouts.state).toBe("sin premios");
		}
	});

	it("un módulo con riel declarado dice qué le falta", () => {
		const withRail = MINIAPPS.filter((app) => app.payouts.rail !== "ninguno");
		expect(withRail.length).toBeGreaterThan(0);
		for (const app of withRail) {
			expect(app.payouts.note.length).toBeGreaterThan(20);
			expect(app.requires).toBeTruthy();
		}
	});

	it("el reto diario sólo se apoya en módulos jugables", () => {
		const daily = MINIAPPS.filter((app) => app.challenge);
		expect(daily.length).toBe(3);
		for (const app of daily) expect(app.status).toBe("jugable");
	});

	it("busca por id y distingue el que no existe", () => {
		expect(miniAppById("veintiuna")?.name).toBe("Veintiuna");
		expect(miniAppById("no-existe")).toBeUndefined();
	});
});

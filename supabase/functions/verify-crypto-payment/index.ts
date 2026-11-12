// Verifica un pago on-chain en stablecoin y activa el nivel Synapse.
//
// El orden importa y es deliberado:
//   1. se comprueba la transacción contra la red;
//   2. se **reserva** el hash en `crypto_payments` (status 'verified');
//   3. sólo entonces se extiende el plan;
//   4. se marca el pago como 'granted'.
//
// Si el proceso muere entre 2 y 4, la fila queda reservada y el mismo usuario
// puede reintentar sin pagar dos veces: se completa lo que faltaba. Si ya está
// 'granted', el hash responde 409 en vez de regalar otro periodo.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { resolveRecipient } from "../_shared/uns.ts";
import { PERIOD_DAYS, extendPaidUntil } from "../_shared/paid-until.ts";
import {
	BILLING_CYCLES,
	PAY_CHAINS,
	PRICE_VERSION,
	cyclePrice,
	type BillingCycle,
	type PayChain,
	type PayToken,
} from "../_shared/pricing.ts";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

type Log = { address?: string; topics?: string[]; data?: string };
type Receipt = { status?: string; logs?: Log[] };

Deno.serve(async (req) => {
	if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

	try {
		const authHeader = req.headers.get("Authorization") ?? "";
		if (!authHeader.startsWith("Bearer ")) return json({ error: "No autenticado" }, 401);

		const admin = createClient(
			Deno.env.get("SUPABASE_URL")!,
			Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
			{ auth: { persistSession: false } },
		);
		const { data: userData, error: userError } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
		const user = userData?.user;
		if (userError || !user) return json({ error: "Sesión inválida" }, 401);

		const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
		const { txHash, chain, token = "USDC", cycle = "monthly", wallet } = body;

		const chainKey = typeof chain === "string" ? (chain as PayChain) : ("" as PayChain);
		const chainInfo = PAY_CHAINS[chainKey];
		const tokenKey = String(token).toUpperCase() as PayToken;
		const tokenInfo = chainInfo?.tokens[tokenKey];
		const cycleKey = (typeof cycle === "string" ? cycle : "monthly") as BillingCycle;
		const price = cyclePrice(cycleKey);
		if (!chainInfo || !tokenInfo || price === null) {
			return json({ error: "Red, moneda o periodo no soportados" }, 400);
		}

		const hash = String(txHash ?? "").toLowerCase();
		if (!/^0x[a-f0-9]{64}$/.test(hash)) return json({ error: "Hash de transacción inválido" }, 400);

		// Camino rápido: si ya se acreditó, no se gasta una llamada al RPC.
		const { data: known } = await admin
			.from("crypto_payments")
			.select("id, status")
			.eq("tx_hash", hash)
			.maybeSingle();
		if (known?.status === "granted") return json({ error: "Esta transacción ya fue utilizada" }, 409);

		const recipient = await resolveRecipient("alienflow.crypto", chainKey);
		if (!recipient) return json({ error: "No se pudo resolver la dirección de cobro" }, 503);

		const receipt = await waitForReceipt(chainInfo.rpc, hash);
		if (!receipt) return json({ error: "La transacción aún no se ha confirmado. Inténtalo en unos segundos." }, 202);
		if (receipt.status !== "0x1") return json({ error: "La transacción falló en la red" }, 400);

		const expected = BigInt(Math.round(price * 10 ** tokenInfo.decimals));
		const toTopic = "0x" + recipient.address.toLowerCase().replace("0x", "").padStart(64, "0");
		const paid = (receipt.logs ?? []).some(
			(log) =>
				log.address?.toLowerCase() === tokenInfo.address.toLowerCase() &&
				log.topics?.[0]?.toLowerCase() === TRANSFER_TOPIC &&
				log.topics?.[2]?.toLowerCase() === toTopic &&
				typeof log.data === "string" &&
				BigInt(log.data) >= expected,
		);
		if (!paid) {
			return json({ error: `No se encontró un pago de ${price} ${tokenKey} a ${recipient.domain}` }, 400);
		}

		// Reserva del hash: a partir de aquí el pago existe aunque algo falle después.
		const { error: ledgerError } = await admin.from("crypto_payments").insert({
			user_id: user.id,
			tx_hash: hash,
			chain: chainKey,
			token: tokenKey,
			cycle: cycleKey,
			amount_usd: price,
			price_version: PRICE_VERSION,
			wallet_address: typeof wallet === "string" ? wallet.toLowerCase() : null,
			recipient: `${recipient.domain} (${recipient.address})`,
			status: "verified",
		});

		if (ledgerError) {
			if (ledgerError.code === "42P01") {
				return json(
					{ error: "Falta aplicar supabase/migrations/20261110120000_crypto_payments.sql" },
					503,
				);
			}
			if (ledgerError.code !== "23505") throw ledgerError;
			// Otra petición lo reservó a la vez: sólo se sigue si es del mismo
			// usuario y todavía no se acreditó (recuperación de un intento a medias).
			const { data: raced } = await admin
				.from("crypto_payments")
				.select("id, status, user_id")
				.eq("tx_hash", hash)
				.maybeSingle();
			if (!raced || raced.user_id !== user.id || raced.status === "granted") {
				return json({ error: "Esta transacción ya fue utilizada" }, 409);
			}
		}

		// El plan caduca: se lee lo que quedaba para que renovar antes de tiempo
		// sume el periodo en vez de tirar los días que ya estaban pagados.
		const { data: current } = await admin
			.from("user_credits")
			.select("paid_until")
			.eq("user_id", user.id)
			.maybeSingle();
		const paidUntil = extendPaidUntil(
			(current as { paid_until?: string | null } | null)?.paid_until,
			PERIOD_DAYS[cycleKey],
		);

		const { error: creditError } = await admin
			.from("user_credits")
			.upsert(
				{
					user_id: user.id,
					paid_tier: "basic",
					paid_until: paidUntil,
					used: 0,
					updated_at: new Date().toISOString(),
				},
				{ onConflict: "user_id" },
			);
		if (creditError) throw creditError;

		// Acreditado: el hash queda cerrado y no se puede volver a usar.
		await admin
			.from("crypto_payments")
			.update({ status: "granted", granted_at: new Date().toISOString() })
			.eq("tx_hash", hash);

		return json({
			success: true,
			tier: "synapse",
			cycle: cycleKey,
			token: tokenKey,
			paidUntil,
			priceVersion: PRICE_VERSION,
			explorer: chainInfo.explorer + hash,
		});
	} catch (error) {
		console.error("verify-crypto-payment", error);
		return json({ error: error instanceof Error ? error.message : "Error verificando el pago" }, 500);
	}
});

async function waitForReceipt(rpc: string, txHash: string, attempts = 12): Promise<Receipt | null> {
	for (let i = 0; i < attempts; i++) {
		const response = await fetch(rpc, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: [txHash] }),
		});
		const body = (await response.json()) as { result?: Receipt | null };
		if (body?.result) return body.result;
		await new Promise((resolve) => setTimeout(resolve, 4000));
	}
	return null;
}

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { ...corsHeaders, "Content-Type": "application/json" },
	});
}

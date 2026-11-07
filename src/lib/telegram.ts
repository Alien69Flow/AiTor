/**
 * Puente entre la web de Ai Tor y su versión en Telegram (bot @Alien69Bot).
 *
 * La continuidad real de la conversación depende del almacenamiento de cada
 * superficie (localStorage en la web, threadManager en el backend), así que lo
 * que este módulo garantiza es la navegación bidireccional con contexto: al
 * abrir la Mini App desde la web se marca `startapp=web`, y al volver a la web
 * desde Telegram se marca `?source=telegram`.
 */

export const TELEGRAM_BOT_HANDLE = "Alien69Bot";
export const TELEGRAM_CHAT_URL = `https://t.me/${TELEGRAM_BOT_HANDLE}`;
export const TELEGRAM_APP_URL = `https://t.me/${TELEGRAM_BOT_HANDLE}/app`;
/** Origen público del terminal; en desarrollo se usa el actual. */
export const WEB_ORIGIN =
  (typeof window !== "undefined" && window.location?.origin?.startsWith("http"))
    ? window.location.origin
    : "https://aitor.alienflow.space";

interface TelegramWebApp {
  initData?: string;
  initDataUnsafe?: { start_param?: string | null };
  version?: string;
  platform?: string;
  /** Abre un enlace t.me dentro del cliente de Telegram (fuera no existe). */
  openTelegramLink?: (url: string) => void;
  close?: () => void;
}

function webApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  const holder = window as unknown as { Telegram?: { WebApp?: TelegramWebApp } };
  return holder.Telegram?.WebApp ?? null;
}

/** true solo cuando la app corre dentro del cliente de Telegram (initData real). */
export function isRunningInTelegram(): boolean {
  const app = webApp();
  return Boolean(app && typeof app.initData === "string" && app.initData.length > 0);
}

/** `startapp` con el que la Mini App fue abierta (p. ej. "web" desde la web). */
export function telegramStartParam(): string | null {
  const param = webApp()?.initDataUnsafe?.start_param;
  return param && typeof param === "string" ? param : null;
}

/** Enlace de vuelta a la web con la marca de procedencia. */
export function webLinkFromTelegram(): string {
  return `${WEB_ORIGIN}/?source=telegram`;
}

/**
 * Abre Telegram: la Mini App por defecto (`startApp="web"` deja constancia de
 * que el usuario vino de la web) o el chat del bot con `startApp="chat"`.
 */
export function openTelegram(startApp: "web" | "chat" = "web"): void {
  const url = startApp === "chat" ? TELEGRAM_CHAT_URL : `${TELEGRAM_APP_URL}?startapp=${startApp}`;
  const app = webApp();
  if (app?.openTelegramLink) {
    app.openTelegramLink(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

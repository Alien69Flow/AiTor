#!/usr/bin/env node
/**
 * Refresca `src/data/arsenal.json` con la API de GitHub.
 *
 * El catálogo curado vive en el propio JSON: cada repo ya trae `destination` y
 * `status`, que son decisiones y no se tocan desde aquí. Este script sólo
 * actualiza lo que cambia solo —descripción, lenguaje, estrellas, licencia,
 * último push, forks— para que la pestaña Sistema no envejezca mintiendo.
 *
 * Uso:
 *   npm run arsenal:sync            # refresca la metadata de lo curado
 *   npm run arsenal:sync -- --list  # añade también percances de la cuenta
 *
 * Sin `GITHUB_TOKEN` la API pública limita a 60 peticiones por hora y por IP;
 * con el token sube a 5.000. El script hace una sola petición por página.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(ROOT, "src", "data", "arsenal.json");
const OWNER = "Alien69Flow";

const current = JSON.parse(readFileSync(FILE, "utf8"));
const curated = new Map();
for (const group of current.destinations) {
  for (const repo of group.repos) curated.set(repo.name.toLowerCase(), { ...repo });
}

const headers = { accept: "application/vnd.github+json" };
if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

const repos = [];
for (let page = 1; page <= 5; page++) {
  const response = await fetch(`https://api.github.com/users/${OWNER}/repos?per_page=100&page=${page}`, {
    headers,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`GitHub respondió ${response.status} en la página ${page}`);
  const batch = await response.json();
  if (!Array.isArray(batch) || batch.length === 0) break;
  repos.push(...batch);
  if (batch.length < 100) break;
}

const byName = new Map(repos.map((repo) => [repo.name.toLowerCase(), repo]));
const refreshed = [];
const missing = [];

for (const [key, entry] of curated) {
  const repo = byName.get(key);
  if (!repo) {
    missing.push(entry.name);
    continue;
  }
  refreshed.push({
    name: repo.name,
    url: repo.html_url,
    description: (repo.description || "").slice(0, 240),
    language: repo.language,
    stars: repo.stargazers_count,
    fork: repo.fork,
    archived: repo.archived,
    license: repo.license?.spdx_id ?? null,
    pushedAt: (repo.pushed_at || "").slice(0, 10),
    homepage: repo.homepage || null,
    topics: (repo.topics || []).slice(0, 6),
    destination: entry.destination,
    status: entry.status,
  });
}

const order = current.destinations.map((group) => group.id);
refreshed.sort(
  (a, b) => order.indexOf(a.destination) - order.indexOf(b.destination) || a.name.localeCompare(b.name),
);

const next = {
  ...current,
  generatedAt: new Date().toISOString(),
  totalReposInAccount: repos.length,
  forksInAccount: repos.filter((repo) => repo.fork).length,
  curated: refreshed.length,
  destinations: current.destinations.map((group) => ({
    ...group,
    repos: refreshed.filter((repo) => repo.destination === group.id),
  })),
};

writeFileSync(FILE, `${JSON.stringify(next, null, 2)}\n`);
console.log(
  `arsenal: ${next.curated} curados de ${next.totalReposInAccount} (${next.forksInAccount} forks)` +
    (missing.length ? ` · no encontrados: ${missing.join(", ")}` : ""),
);

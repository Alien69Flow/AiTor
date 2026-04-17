import { supabase } from "@/integrations/supabase/client";

// --- Helpers ---

function parseRepoUrl(input: string): { owner: string; repo: string } | null {
  const urlMatch = input.match(/github\.com\/([^/\s]+)\/([^/\s#?]+)/);
  if (urlMatch) return { owner: urlMatch[1], repo: urlMatch[2].replace(/\.git$/, "") };
  const shortMatch = input.trim().match(/^([^/\s]+)\/([^/\s]+)$/);
  if (shortMatch) return { owner: shortMatch[1], repo: shortMatch[2].replace(/\.git$/, "") };
  return null;
}

async function githubFetch(action: string, params: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("github-proxy", {
    body: { action, ...params },
  });
  if (error) {
    console.error("github-proxy error:", error.message);
    return null;
  }
  return data;
}

// --- Tool: Web Search (Firecrawl) ---

export async function fetchWebContext(query: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke("firecrawl-search", {
      body: { query, options: { limit: 5, lang: "es" } },
    });
    if (error) {
      console.error("firecrawl-search error:", error.message);
      return null;
    }
    const results = data?.data || [];
    if (results.length === 0) return null;
    return results.map((r: any, i: number) =>
      `[${i + 1}] ${r.title || "Sin título"}\nURL: ${r.url || ""}\n${r.description || ""}\n${r.markdown ? r.markdown.slice(0, 500) : ""}`
    ).join("\n\n---\n\n");
  } catch (e) {
    console.error("Web search error:", e);
    return null;
  }
}

// --- Tool: GitHub Analyze ---

export async function analyzeRepo(repoInput: string): Promise<string | null> {
  const parsed = parseRepoUrl(repoInput);
  if (!parsed) return null;
  const { owner, repo } = parsed;

  try {
    const [repoInfo, tree, commits] = await Promise.all([
      githubFetch("repo_info", { owner, repo }),
      githubFetch("tree", { owner, repo, branch: "main" }),
      githubFetch("commits", { owner, repo }),
    ]);

    if (!repoInfo && !tree) {
      const treeAlt = await githubFetch("tree", { owner, repo, branch: "master" });
      if (!treeAlt) return null;
    }

    const readme = await githubFetch("contents", { owner, repo, path: "README.md" });

    let ctx = `# Análisis: ${owner}/${repo}\n\n`;
    if (repoInfo) {
      ctx += `## Info\n- **Desc**: ${repoInfo.description || "N/A"}\n- **Lang**: ${repoInfo.language || "N/A"}\n- ⭐ ${repoInfo.stargazers_count} | 🍴 ${repoInfo.forks_count}\n- **Visibilidad**: ${repoInfo.private ? "Privado" : "Público"}\n\n`;
    }
    if (tree?.tree) {
      const files = tree.tree.filter((f: any) => f.type === "blob").slice(0, 100).map((f: any) => f.path);
      ctx += `## Archivos (${files.length})\n\`\`\`\n${files.join("\n")}\n\`\`\`\n\n`;
    }
    if (commits?.length) {
      ctx += `## Últimos Commits\n`;
      commits.slice(0, 8).forEach((c: any) => {
        ctx += `- ${c.commit?.message?.split("\n")[0] || "?"}\n`;
      });
      ctx += "\n";
    }
    if (readme?.content) {
      try {
        const decoded = atob(readme.content.replace(/\n/g, ""));
        ctx += `## README\n${decoded.slice(0, 2000)}\n\n`;
      } catch {}
    }
    return ctx;
  } catch (e) {
    console.error("GitHub analysis error:", e);
    return null;
  }
}

// --- Tool: GitHub Edit ---

export interface GitHubFile { path: string; content: string; }

export function parseGitHubChanges(response: string): GitHubFile[] {
  const files: GitHubFile[] = [];
  const regex = /<file\s+path="([^"]+)">([\s\S]*?)<\/file>/g;
  let match;
  while ((match = regex.exec(response)) !== null) {
    files.push({ path: match[1], content: match[2].trim() });
  }
  return files;
}

export function stripGitHubChangesBlock(response: string): string {
  return response.replace(/<github_changes>[\s\S]*?<\/github_changes>/g, '').trim();
}

export async function fetchRepoFilesForEdit(owner: string, repo: string) {
  const tree = await githubFetch("tree", { owner, repo, branch: "main" })
    || await githubFetch("tree", { owner, repo, branch: "master" });
  if (!tree?.tree) return { tree: null, keyFiles: new Map<string, string>() };

  const priorityFiles = ["README.md", "package.json", "tsconfig.json", "src/App.tsx", "src/main.tsx", "index.html", "vite.config.ts"];
  const keyFiles = new Map<string, string>();
  for (const filePath of priorityFiles) {
    if (keyFiles.size >= 6) break;
    const inTree = tree.tree.find((f: any) => f.path === filePath && f.type === "blob");
    if (inTree) {
      const fileData = await githubFetch("get_file", { owner, repo, path: filePath });
      if (fileData?.content) {
        try { keyFiles.set(filePath, atob(fileData.content.replace(/\n/g, "")).slice(0, 5000)); } catch {}
      }
    }
  }
  return { tree, keyFiles };
}

export async function applyGitHubChanges(
  owner: string, repo: string, files: GitHubFile[], branch = "main"
): Promise<{ success: boolean; applied: string[]; failed: string[] }> {
  const applied: string[] = [];
  const failed: string[] = [];
  for (const file of files) {
    try {
      const existing = await githubFetch("get_file", { owner, repo, path: file.path, branch });
      const sha = existing?.sha;
      const content = btoa(unescape(encodeURIComponent(file.content)));
      const result = await githubFetch("create_or_update_file", {
        owner, repo, path: file.path, content,
        message: `Update ${file.path} via AI Tor`, branch, ...(sha && { sha }),
      });
      if (result?.commit) applied.push(file.path); else failed.push(file.path);
    } catch { failed.push(file.path); }
  }
  return { success: failed.length === 0, applied, failed };
}

// --- Tool: Crypto Price (CoinGecko) ---

export async function fetchCryptoPrice(coinIds: string[]): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke("crypto-price", {
      body: { coinIds },
    });
    if (error) {
      console.error("crypto-price error:", error.message);
      return null;
    }
    if (!data?.prices) return null;

    let ctx = "## Precios Crypto en Tiempo Real\n\n";
    for (const [coin, info] of Object.entries(data.prices) as [string, any][]) {
      ctx += `- **${coin.toUpperCase()}**: $${info.usd?.toLocaleString() ?? "N/A"}`;
      if (info.usd_24h_change != null) ctx += ` (${info.usd_24h_change > 0 ? "+" : ""}${info.usd_24h_change.toFixed(2)}%)`;
      ctx += "\n";
    }
    return ctx;
  } catch (e) {
    console.error("Crypto price error:", e);
    return null;
  }
}

// --- Intent Detection ---

const CRYPTO_KEYWORDS = /\b(bitcoin|btc|ethereum|eth|solana|sol|bnb|xrp|cardano|ada|dogecoin|doge|polkadot|dot|avalanche|avax|polygon|matic|chainlink|link|precio|price|mercado|market)\b/i;
const GITHUB_URL_REGEX = /github\.com\/([^/\s]+)\/([^/\s#?]+)/;
const WEB_SEARCH_KEYWORDS = /\b(busca|search|qué es|what is|últimas noticias|latest news|investiga|research|encuentra|find)\b/i;

export interface DetectedTools {
  webSearch: string | null;
  githubAnalysis: string | null;
  githubEdit: { owner: string; repo: string; instruction: string } | null;
  cryptoPrice: string[] | null;
}

export function detectTools(content: string): DetectedTools {
  const result: DetectedTools = { webSearch: null, githubAnalysis: null, githubEdit: null, cryptoPrice: null };

  const ghMatch = content.match(GITHUB_URL_REGEX);
  if (ghMatch) {
    const editKeywords = /\b(edita|modifica|cambia|update|edit|fix|refactor|añade|add|crea|create)\b/i;
    if (editKeywords.test(content)) {
      const instruction = content.replace(GITHUB_URL_REGEX, "").trim() || "Analiza y sugiere mejoras";
      result.githubEdit = { owner: ghMatch[1], repo: ghMatch[2].replace(/\.git$/, ""), instruction };
    } else {
      result.githubAnalysis = `${ghMatch[1]}/${ghMatch[2]}`;
    }
    return result;
  }

  if (CRYPTO_KEYWORDS.test(content)) {
    const coinMap: Record<string, string> = {
      bitcoin: "bitcoin", btc: "bitcoin", ethereum: "ethereum", eth: "ethereum",
      solana: "solana", sol: "solana", bnb: "binancecoin", xrp: "ripple",
      cardano: "cardano", ada: "cardano", dogecoin: "dogecoin", doge: "dogecoin",
      polkadot: "polkadot", dot: "polkadot", avalanche: "avalanche-2", avax: "avalanche-2",
      polygon: "matic-network", matic: "matic-network", chainlink: "chainlink", link: "chainlink",
    };
    const found = new Set<string>();
    for (const [keyword, coinId] of Object.entries(coinMap)) {
      if (new RegExp(`\\b${keyword}\\b`, "i").test(content)) found.add(coinId);
    }
    if (found.size > 0) {
      result.cryptoPrice = [...found];
    }
  }

  if (!result.cryptoPrice && WEB_SEARCH_KEYWORDS.test(content)) {
    result.webSearch = content;
  }

  return result;
}

export { parseRepoUrl };

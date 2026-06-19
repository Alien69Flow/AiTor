/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Input validation helpers ───────────────────────────────────────────
const OWNER_REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;
const PATH_RE = /^[A-Za-z0-9._\-\/]{0,500}$/;
const BRANCH_RE = /^[A-Za-z0-9._\-\/]{1,200}$/;
const SHA_RE = /^[a-f0-9]{4,64}$/i;
const ALLOWED_ACTIONS = new Set([
  'repo_info', 'contents', 'tree', 'branches', 'commits',
  'get_file', 'create_or_update_file', 'create_branch', 'get_ref',
]);
// Optional owner/repo allowlist via env. Format: "owner1/repo1,owner2/repo2"
const ALLOWLIST = (Deno.env.get('GITHUB_REPO_ALLOWLIST') || '')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── AuthN: require a valid Supabase user JWT ─────────────────────
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    );
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const GITHUB_PAT = Deno.env.get('GITHUB_PAT');
    if (!GITHUB_PAT) {
      return new Response(
        JSON.stringify({ error: 'GitHub PAT not configured. Please add your GITHUB_PAT secret.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { action, owner, repo, path, branch, content, message, sha } = body;

    // ── Input validation ─────────────────────────────────────────────
    if (!ALLOWED_ACTIONS.has(action)) {
      return new Response(JSON.stringify({ error: `Unknown action: ${action}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (typeof owner !== 'string' || !OWNER_REPO_RE.test(owner) ||
        typeof repo  !== 'string' || !OWNER_REPO_RE.test(repo)) {
      return new Response(JSON.stringify({ error: 'Invalid owner/repo' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (ALLOWLIST.length && !ALLOWLIST.includes(`${owner}/${repo}`.toLowerCase())) {
      return new Response(JSON.stringify({ error: 'Repository not allowlisted' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (path !== undefined && (typeof path !== 'string' || !PATH_RE.test(path) || path.includes('..'))) {
      return new Response(JSON.stringify({ error: 'Invalid path' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (branch !== undefined && branch !== null && (typeof branch !== 'string' || !BRANCH_RE.test(branch))) {
      return new Response(JSON.stringify({ error: 'Invalid branch' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (sha !== undefined && sha !== null && (typeof sha !== 'string' || !SHA_RE.test(sha))) {
      return new Response(JSON.stringify({ error: 'Invalid sha' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (body.from_sha !== undefined && !SHA_RE.test(String(body.from_sha))) {
      return new Response(JSON.stringify({ error: 'Invalid from_sha' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (body.new_branch !== undefined && !BRANCH_RE.test(String(body.new_branch))) {
      return new Response(JSON.stringify({ error: 'Invalid new_branch' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const headers = {
      'Authorization': `Bearer ${GITHUB_PAT}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    let url: string;
    let method = 'GET';
    let requestBody: string | undefined;

    switch (action) {
      case 'repo_info':
        url = `https://api.github.com/repos/${owner}/${repo}`;
        break;
      case 'contents':
        url = `https://api.github.com/repos/${owner}/${repo}/contents/${path || ''}`;
        if (branch) url += `?ref=${branch}`;
        break;
      case 'tree':
        url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch || 'main'}?recursive=1`;
        break;
      case 'branches':
        url = `https://api.github.com/repos/${owner}/${repo}/branches`;
        break;
      case 'commits':
        url = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=10`;
        break;
      case 'get_file':
        // Get file contents including SHA for updates
        url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
        if (branch) url += `?ref=${branch}`;
        break;
      case 'create_or_update_file':
        // Create or update a file in the repository
        url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
        method = 'PUT';
        requestBody = JSON.stringify({
          message: message || `Update ${path} via AI Tor`,
          content: content, // Must be base64 encoded
          branch: branch || 'main',
          ...(sha && { sha }), // Include SHA if updating existing file
        });
        break;
      case 'create_branch':
        // Create a new branch from a reference
        url = `https://api.github.com/repos/${owner}/${repo}/git/refs`;
        method = 'POST';
        const refSha = body.from_sha;
        const newBranch = body.new_branch;
        requestBody = JSON.stringify({
          ref: `refs/heads/${newBranch}`,
          sha: refSha,
        });
        break;
      case 'get_ref':
        // Get a reference (branch) SHA
        url = `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch || 'main'}`;
        break;
      default:
        // Already validated above; keep exhaustive fallthrough safe.
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const fetchOptions: RequestInit = {
      method,
      headers: {
        ...headers,
        ...(requestBody && { 'Content-Type': 'application/json' }),
      },
      ...(requestBody && { body: requestBody }),
    };

    const response = await fetch(url, fetchOptions);
    const data = await response.json();

    if (!response.ok) {
      console.error('GitHub API error:', data);
      return new Response(
        JSON.stringify({ error: `GitHub API error: ${data.message || 'Unknown error'}`, details: data }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('GitHub proxy error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

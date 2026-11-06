/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const READ_ACTIONS = new Set(['repo_info', 'contents', 'tree', 'branches', 'commits', 'get_file', 'get_ref']);
const WRITE_ACTIONS = new Set(['create_or_update_file', 'create_branch']);

function allowedRepos(): string[] {
  return (Deno.env.get('GITHUB_REPO_ALLOWLIST') || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GITHUB_PAT = Deno.env.get('GITHUB_PAT');
    if (!GITHUB_PAT) {
      return new Response(
        JSON.stringify({ error: 'GitHub PAT not configured. Please add your GITHUB_PAT secret.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Require a verified user for every call — the shared PAT must never be
    // reachable anonymously.
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { action, owner, repo, path, branch, content, message, sha } = body;

    if (typeof action !== 'string' || (!READ_ACTIONS.has(action) && !WRITE_ACTIONS.has(action))) {
      return new Response(JSON.stringify({ error: 'Unknown action' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (typeof owner !== 'string' || typeof repo !== 'string' ||
        !/^[\w.-]{1,100}$/.test(owner) || !/^[\w.-]{1,100}$/.test(repo)) {
      return new Response(JSON.stringify({ error: 'Invalid repository' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mandatory, non-empty repository allowlist for the shared PAT.
    const allowlist = allowedRepos();
    if (allowlist.length === 0 || !allowlist.includes(`${owner}/${repo}`.toLowerCase())) {
      return new Response(
        JSON.stringify({ error: 'Repository not allowed' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Write actions require an admin role.
    if (WRITE_ACTIONS.has(action)) {
      // Read the caller's own roles under RLS (the has_role helper is no
      // longer executable by client roles).
      const { data: roleRow } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userData.user.id)
        .eq('role', 'admin')
        .maybeSingle();
      if (!roleRow) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
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
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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

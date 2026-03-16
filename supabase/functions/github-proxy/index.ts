/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const body = await req.json();
    const { action, owner, repo, path, branch, content, message, sha } = body;

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

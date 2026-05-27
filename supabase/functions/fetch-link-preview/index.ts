import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function extractMeta(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, 'i'),
  ];
  if (property.startsWith('og:')) {
    const twitterKey = property.replace('og:', 'twitter:');
    patterns.push(
      new RegExp(`<meta[^>]+name=["']${twitterKey}["'][^>]+content=["']([^"']+)["']`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${twitterKey}["']`, 'i'),
    );
  }
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1]?.trim() || null;
}

// SSRF guard: block private / loopback / link-local hostnames and IP literals.
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') ||
      h.endsWith('.internal') || h === 'metadata.google.internal') return true;
  // IPv6 loopback / unspecified / link-local / unique-local
  if (h === '::1' || h === '::' || h.startsWith('fe80:') || h.startsWith('fc') || h.startsWith('fd')) return true;
  // IPv4 literal
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [parseInt(m[1], 10), parseInt(m[2], 10)];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true; // multicast / reserved
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // AUTH: require a signed-in user. Prevents anonymous proxy abuse.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing url' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Validate URL: only http(s), block private / loopback hosts (SSRF guard).
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid url' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return new Response(JSON.stringify({ error: 'Only http(s) URLs allowed' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (isBlockedHost(parsed.hostname)) {
      return new Response(JSON.stringify({ error: 'Host not allowed' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    let html: string;
    try {
      const res = await fetch(parsed.toString(), {
        signal: controller.signal,
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LinkPreviewBot/1.0)' },
      });
      // Re-validate final URL after redirects to block redirect-based SSRF.
      try {
        const finalUrl = new URL(res.url);
        if (isBlockedHost(finalUrl.hostname)) {
          return new Response(JSON.stringify({}), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      } catch { /* ignore */ }

      // Only read first 50KB to avoid huge pages
      const reader = res.body?.getReader();
      const chunks: Uint8Array[] = [];
      let totalSize = 0;
      const maxSize = 50000;
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          totalSize += value.length;
          if (totalSize > maxSize) break;
        }
        reader.cancel();
      }
      const merged = new Uint8Array(totalSize);
      let off = 0;
      for (const c of chunks) {
        merged.set(c.subarray(0, Math.min(c.length, totalSize - off)), off);
        off += c.length;
        if (off >= totalSize) break;
      }
      html = new TextDecoder().decode(merged);
    } catch {
      return new Response(JSON.stringify({}), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } finally {
      clearTimeout(timeout);
    }

    const domain = parsed.hostname.replace(/^www\./, '');
    const result = {
      title: extractMeta(html, 'og:title') || extractTitle(html) || null,
      description: extractMeta(html, 'og:description') || null,
      image: extractMeta(html, 'og:image') || null,
      url: extractMeta(html, 'og:url') || url,
      domain,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({}), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

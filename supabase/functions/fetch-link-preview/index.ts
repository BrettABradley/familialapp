const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function extractMeta(html: string, property: string): string | null {
  // Try property="og:..." and name="twitter:..."
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing url' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    let html: string;
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LinkPreviewBot/1.0)' },
      });
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
      html = new TextDecoder().decode(new Uint8Array(totalSize).map((_, i) => {
        let offset = 0;
        for (const chunk of chunks) {
          if (i < offset + chunk.length) return chunk[i - offset];
          offset += chunk.length;
        }
        return 0;
      }));
    } catch {
      return new Response(JSON.stringify({}), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } finally {
      clearTimeout(timeout);
    }

    const domain = new URL(url).hostname.replace(/^www\./, '');
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

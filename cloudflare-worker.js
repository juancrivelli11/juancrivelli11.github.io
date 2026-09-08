// ═══════════════════════════════════════════════════════════════════════════
// PROXY PROPIO PARA YAHOO FINANCE — Cloudflare Worker (plan gratis)
// ═══════════════════════════════════════════════════════════════════════════
// Por qué existe: la app usaba proxys públicos gratuitos (corsproxy.io,
// allorigins.win, codetabs.com) para poder pedirle precios a Yahoo Finance
// desde el navegador (Yahoo no permite pedidos directos por CORS). Esos
// servicios gratuitos se saturan, bloquean o caen sin aviso — nada que hacer
// del lado de la app cuando eso pasa.
//
// Este Worker es TU PROPIO intermediario: corre en la infraestructura de
// Cloudflare (gratis hasta 100.000 pedidos/día, de sobra para uso personal),
// y solo vos lo controlás. No depende de la buena voluntad de terceros.
//
// CÓMO PUBLICARLO (una sola vez, ~5 minutos):
// 1. Andá a https://dash.cloudflare.com y creá una cuenta gratis (solo pide email).
// 2. En el menú izquierdo: Workers & Pages → Create → Create Worker.
// 3. Ponele un nombre (ej: "crifund-proxy") → Deploy (crea uno de ejemplo).
// 4. Click en "Edit code" (o el lápiz) → borrá TODO el código de ejemplo →
//    pegá este archivo completo → "Save and Deploy".
// 5. Cloudflare te da una URL tipo https://crifund-proxy.TU-USUARIO.workers.dev
//    — copiá esa URL y pasámela para conectarla a la app.
// ═══════════════════════════════════════════════════════════════════════════

export default {
  async fetch(request) {
    const CORS_HEADERS = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const incoming = new URL(request.url);
    const target = incoming.searchParams.get('url');
    if (!target) {
      return new Response('Falta el parámetro ?url=', { status: 400, headers: CORS_HEADERS });
    }

    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch (e) {
      return new Response('URL inválida', { status: 400, headers: CORS_HEADERS });
    }

    // Lista blanca de hosts permitidos: evita que este Worker se use como
    // proxy abierto para cualquier sitio (lo que podría hacer que Cloudflare
    // lo suspenda por abuso, o que alguien lo use para otra cosa).
    const allowedHosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
    if (!allowedHosts.includes(targetUrl.hostname)) {
      return new Response('Host no permitido: ' + targetUrl.hostname, { status: 403, headers: CORS_HEADERS });
    }

    try {
      const resp = await fetch(targetUrl.toString(), {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CriFundProxy/1.0)' },
      });
      const body = await resp.text();
      return new Response(body, {
        status: resp.status,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': resp.headers.get('Content-Type') || 'application/json',
        },
      });
    } catch (e) {
      return new Response('Error al buscar el precio: ' + e.message, { status: 502, headers: CORS_HEADERS });
    }
  },
};

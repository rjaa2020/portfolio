// Lightweight, privacy-conscious page-view tracking.
// Sends one row per page view to a Supabase table (`page_views`) via its
// REST API. The embedded key is the Supabase "publishable"/anon key, which
// is safe to expose in client-side code: row-level security restricts it
// to INSERT-only on page_views, and geo lookups go through a
// security-definer function (get_or_create_geo) rather than direct table
// access, so the key can never read existing rows.

const SUPABASE_URL = "https://ecikownuzaqrfahqzdbs.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_8LCofiePNZPKDRhg62Sz-g_t87ZW_IR";

function getSessionId() {
  try {
    const key = "pv_session_id";
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(key, id);
    }
    return id;
  } catch {
    // sessionStorage unavailable (privacy mode, etc.) — fall back to a
    // per-call random id rather than losing the pageview entirely.
    return crypto.randomUUID();
  }
}

// Resolves the visitor's city/region/country via a free, keyless IP
// geolocation lookup, then exchanges it for a geo_id via the
// get_or_create_geo RPC. Cached in sessionStorage so this only runs once
// per visit rather than once per page.
async function getGeoId() {
  try {
    const cached = sessionStorage.getItem("pv_geo_id");
    if (cached) return Number(cached);
  } catch {
    // ignore — fall through to a fresh lookup
  }

  let city = null;
  let region = null;
  let country = null;
  try {
    const res = await fetch("https://ipapi.co/json/");
    if (res.ok) {
      const data = await res.json();
      city = data.city || null;
      region = data.region || null;
      country = data.country_name || null;
    }
  } catch {
    // geolocation lookup failed (offline, blocked, rate-limited) — proceed
    // with an "Unknown" geo rather than dropping the pageview.
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_or_create_geo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ p_city: city, p_region: region, p_country: country }),
    });
    if (!res.ok) return null;
    const geoId = await res.json();
    try {
      sessionStorage.setItem("pv_geo_id", String(geoId));
    } catch {
      // ignore
    }
    return geoId;
  } catch {
    return null;
  }
}

async function trackPageView() {
  const geoId = await getGeoId();
  const payload = {
    path: window.location.pathname,
    referrer: document.referrer || null,
    session_id: getSessionId(),
    user_agent: navigator.userAgent,
    geo_id: geoId,
  };

  fetch(`${SUPABASE_URL}/rest/v1/page_views`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // Fail silently — analytics should never break the site or surface
    // errors to visitors.
  });
}

trackPageView();
document.addEventListener("astro:page-load", trackPageView);

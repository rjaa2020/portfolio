// Lightweight, privacy-conscious page-view tracking.
// Sends one row per page view to a Supabase table (`page_views`) via its
// REST API. The embedded key is the Supabase "publishable"/anon key, which
// is safe to expose in client-side code: row-level security restricts it
// to INSERT-only on page_views, and geo/user-agent lookups go through
// security-definer functions (get_or_create_geo, get_or_create_user_agent)
// rather than direct table access, so the key can never read existing rows.

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

// Calls a get_or_create_* RPC and caches the resulting id in sessionStorage
// under cacheKey, so repeat lookups within a visit are free.
async function getOrCreateId(cacheKey, rpcName, body) {
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) return Number(cached);
  } catch {
    // ignore — fall through to a fresh lookup
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${rpcName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const id = await res.json();
    try {
      sessionStorage.setItem(cacheKey, String(id));
    } catch {
      // ignore
    }
    return id;
  } catch {
    return null;
  }
}

// Resolves the visitor's city/region/country via a free, keyless IP
// geolocation lookup, then exchanges it for a geo_id via get_or_create_geo.
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

  return getOrCreateId("pv_geo_id", "get_or_create_geo", {
    p_city: city,
    p_region: region,
    p_country: country,
  });
}

function getUserAgentId() {
  return getOrCreateId("pv_user_agent_id", "get_or_create_user_agent", {
    p_user_agent: navigator.userAgent,
  });
}


function trackClick(fields) {
  const payload = {
    session_id: getSessionId(),
    path: window.location.pathname,
    ...fields,
  };

  fetch(`${SUPABASE_URL}/rest/v1/clicks`, {
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
    // Fail silently, same as page-view tracking.
  });
}

// Tracks clicks on hyperlinks and images specifically (not every click),
// via event delegation so it covers elements added after initial load.
function setupClickTracking() {
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    const img = event.target.closest("img");

    if (img) {
      trackClick({
        target_type: "image",
        href: link ? link.getAttribute("href") : null,
        src: img.currentSrc || img.src || null,
        alt: img.getAttribute("alt") || null,
        link_text: null,
      });
    } else if (link) {
      trackClick({
        target_type: "link",
        href: link.getAttribute("href"),
        src: null,
        alt: null,
        link_text: (link.textContent || "").trim().slice(0, 200) || null,
      });
    }
  });
}

async function trackPageView() {
  const [geoId, userAgentId] = await Promise.all([getGeoId(), getUserAgentId()]);
  const payload = {
    path: window.location.pathname,
    referrer: document.referrer || null,
    session_id: getSessionId(),
    geo_id: geoId,
    user_agent_id: userAgentId,
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
setupClickTracking();

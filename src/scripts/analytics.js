// Lightweight, privacy-conscious page-view tracking.
// Sends one row per page view to a Supabase table (`page_views`) via its
// REST API. The embedded key is the Supabase "publishable"/anon key, which
// is safe to expose in client-side code: row-level security on the table
// restricts it to INSERT only, so it can never read or modify existing rows.

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

function trackPageView() {
  const payload = {
    path: window.location.pathname,
    referrer: document.referrer || null,
    session_id: getSessionId(),
    user_agent: navigator.userAgent,
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

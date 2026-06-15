// Kleiner, wiederverwendbarer Erato-API-Client.
// - Holt ein OIDC-Token (Keycloak Direct Grant) und cacht es.
// - Erneuert das Token automatisch bei Ablauf.
// - Bietet duenne fetch-Helfer (GET/POST/PUT) mit Bearer-Auth.
//
// Konfiguration via Env-Vars (mit Dev-Defaults):
//   ERATO_API_URL       (default: http://localhost:3001)
//   KEYCLOAK_TOKEN_URL  (default: http://localhost:8085/realms/erato/protocol/openid-connect/token)
//   ERATO_USER          (default: christian)
//   ERATO_PASS          (default: erato)
//   ERATO_CLIENT_ID     (default: erato-web)

const API_URL = (process.env.ERATO_API_URL || "http://localhost:3001").replace(/\/+$/, "");
const TOKEN_URL =
  process.env.KEYCLOAK_TOKEN_URL ||
  "http://localhost:8085/realms/erato/protocol/openid-connect/token";
const USER = process.env.ERATO_USER || "christian";
const PASS = process.env.ERATO_PASS || "erato";
const CLIENT_ID = process.env.ERATO_CLIENT_ID || "erato-web";

// Token-Cache: { accessToken, expiresAtMs }
let tokenCache = null;
// Sicherheitspuffer (ms), bevor das Token wirklich ablaeuft -> rechtzeitig neu holen.
const EXPIRY_SKEW_MS = 15_000;

/**
 * Holt ein frisches Token von Keycloak (Resource Owner Password Credentials).
 * @returns {Promise<{accessToken: string, expiresAtMs: number}>}
 */
async function fetchToken() {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: "password",
    username: USER,
    password: PASS,
    scope: "openid",
  });

  let res;
  try {
    res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch (err) {
    throw new Error(
      `Token-Endpunkt nicht erreichbar (${TOKEN_URL}): ${err.message}`
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Token-Anfrage fehlgeschlagen (HTTP ${res.status}): ${text || res.statusText}`
    );
  }

  const json = await res.json();
  if (!json.access_token) {
    throw new Error("Token-Antwort enthielt kein access_token.");
  }
  const expiresInSec = Number(json.expires_in) || 300;
  return {
    accessToken: json.access_token,
    expiresAtMs: Date.now() + expiresInSec * 1000,
  };
}

/**
 * Liefert ein gueltiges Token (aus Cache oder frisch geholt).
 * @returns {Promise<string>}
 */
async function getToken() {
  if (tokenCache && tokenCache.expiresAtMs - EXPIRY_SKEW_MS > Date.now()) {
    return tokenCache.accessToken;
  }
  tokenCache = await fetchToken();
  return tokenCache.accessToken;
}

/**
 * Interner Request-Helfer mit Bearer-Auth.
 * Bei 401 wird das Token einmalig invalidiert und der Request wiederholt.
 *
 * @param {string} method
 * @param {string} path  z.B. "/v1/notebooks"
 * @param {object|undefined} jsonBody
 * @param {boolean} retryOn401
 * @returns {Promise<any>}  geparstes JSON (oder null bei leerem Body)
 */
async function request(method, path, jsonBody, retryOn401 = true) {
  const token = await getToken();
  const url = `${API_URL}${path}`;

  const headers = { Authorization: `Bearer ${token}` };
  let body;
  if (jsonBody !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(jsonBody);
  }

  let res;
  try {
    res = await fetch(url, { method, headers, body });
  } catch (err) {
    throw new Error(`Erato-API nicht erreichbar (${method} ${url}): ${err.message}`);
  }

  // Token abgelaufen/ungueltig -> einmal neu holen und wiederholen.
  if (res.status === 401 && retryOn401) {
    tokenCache = null;
    return request(method, path, jsonBody, false);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Erato-API Fehler (${method} ${path} -> HTTP ${res.status}): ${
        text || res.statusText
      }`
    );
  }

  // Manche Endpunkte (z.B. PUT) liefern evtl. leeren Body.
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// --- Oeffentliche API-Methoden (entsprechen den Erato-Routen) ---

export async function listNotebooks() {
  return request("GET", "/v1/notebooks");
}

export async function listPages(notebookId) {
  return request(
    "GET",
    `/v1/notebooks/${encodeURIComponent(notebookId)}/pages`
  );
}

export async function getPage(pageId) {
  return request("GET", `/v1/pages/${encodeURIComponent(pageId)}`);
}

export async function createPage({ notebookId, parentId, title }) {
  const payload = { notebookId };
  if (parentId) payload.parentId = parentId;
  if (title) payload.title = title;
  return request("POST", "/v1/pages", payload);
}

export async function updatePage(pageId, { title, contentMd } = {}) {
  const payload = {};
  if (title !== undefined) payload.title = title;
  if (contentMd !== undefined) payload.contentMd = contentMd;
  return request("PUT", `/v1/pages/${encodeURIComponent(pageId)}`, payload);
}

/**
 * Volltextsuche. Nutzt /v1/search/hybrid falls vorhanden, sonst /v1/search.
 * Das Vorhandensein von hybrid wird gecacht, um wiederholte 404 zu vermeiden.
 */
let hybridAvailable = null; // null = unbekannt, true/false = bekannt
export async function searchDocs(query) {
  const q = `?q=${encodeURIComponent(query)}`;

  if (hybridAvailable !== false) {
    try {
      const result = await request("GET", `/v1/search/hybrid${q}`);
      hybridAvailable = true;
      return result;
    } catch (err) {
      // Wenn hybrid nicht existiert (404), auf Volltext zurueckfallen.
      if (/HTTP 404/.test(err.message)) {
        hybridAvailable = false;
      } else {
        throw err;
      }
    }
  }
  return request("GET", `/v1/search${q}`);
}

export const config = { API_URL, TOKEN_URL, USER, CLIENT_ID };

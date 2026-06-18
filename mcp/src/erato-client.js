// Erato-API-Client für den MCP-Server. Unterstützt zwei Ziele (ERATO_TARGET):
//
//   web   (default) – Team-/Web-Instanz mit Keycloak. Holt ein OIDC-Token
//                     (Direct Grant) und cacht/erneuert es. Auth via Bearer.
//   local           – lokale Desktop-App (PGlite, kein Keycloak). Kein Token;
//                     die API-Basis (zufälliger Port) wird aus der Port-Datei
//                     gelesen, die die Desktop-App schreibt (erato-local.json).
//
// Konfiguration via Env-Vars:
//   ERATO_TARGET        web | local                       (default: web)
//   ERATO_NOTEBOOK      Default-Notizbuch (Titel oder id) für Scoping (optional)
//   ERATO_API_URL       API-Basis (web-Default bzw. local-Override)
//   ERATO_LOCAL_FILE    Pfad zur Port-Datei der Desktop-App (local; optional)
//   KEYCLOAK_TOKEN_URL  Token-Endpunkt (web)
//   ERATO_USER/ERATO_PASS/ERATO_CLIENT_ID  Credentials (web; default kai/erato/erato-web)

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const TARGET = (process.env.ERATO_TARGET || "web").toLowerCase();
const IS_LOCAL = TARGET === "local";

// Default-Notizbuch für Scoping (upsert/create greifen darauf zurück).
export const NOTEBOOK = process.env.ERATO_NOTEBOOK || null;

// --- web-Konfiguration ---
const WEB_API_URL = (process.env.ERATO_API_URL || "http://localhost:3001").replace(/\/+$/, "");
const TOKEN_URL =
  process.env.KEYCLOAK_TOKEN_URL ||
  "http://localhost:8085/realms/erato/protocol/openid-connect/token";
const USER = process.env.ERATO_USER || "kai";
const PASS = process.env.ERATO_PASS || "erato";
const CLIENT_ID = process.env.ERATO_CLIENT_ID || "erato-web";

// --- local-Konfiguration ---
const LOCAL_URL_OVERRIDE = process.env.ERATO_API_URL
  ? process.env.ERATO_API_URL.replace(/\/+$/, "")
  : null;

function defaultLocalFile() {
  if (process.platform === "win32") {
    return join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "Erato", "erato-local.json");
  }
  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "Erato", "erato-local.json");
  }
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "Erato", "erato-local.json");
}
const LOCAL_FILE = process.env.ERATO_LOCAL_FILE || defaultLocalFile();

let localBaseCache = null;
function readLocalBase() {
  if (LOCAL_URL_OVERRIDE) return LOCAL_URL_OVERRIDE;
  try {
    const data = JSON.parse(readFileSync(LOCAL_FILE, "utf8"));
    if (!data.apiBase) throw new Error("apiBase fehlt in der Port-Datei");
    return String(data.apiBase).replace(/\/+$/, "");
  } catch (err) {
    throw new Error(
      `Lokale Erato-Instanz nicht gefunden (${LOCAL_FILE}). Ist die Erato-Desktop-App geöffnet? (${err.message})`
    );
  }
}

async function getApiBase() {
  if (!IS_LOCAL) return WEB_API_URL;
  if (!localBaseCache) localBaseCache = readLocalBase();
  return localBaseCache;
}
function invalidateBase() {
  localBaseCache = null;
}

// --- Token (nur web) ---
let tokenCache = null;
const EXPIRY_SKEW_MS = 15_000;

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
    throw new Error(`Token-Endpunkt nicht erreichbar (${TOKEN_URL}): ${err.message}`);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Token-Anfrage fehlgeschlagen (HTTP ${res.status}): ${text || res.statusText}`);
  }
  const json = await res.json();
  if (!json.access_token) throw new Error("Token-Antwort enthielt kein access_token.");
  const expiresInSec = Number(json.expires_in) || 300;
  return { accessToken: json.access_token, expiresAtMs: Date.now() + expiresInSec * 1000 };
}

async function getToken() {
  if (tokenCache && tokenCache.expiresAtMs - EXPIRY_SKEW_MS > Date.now()) {
    return tokenCache.accessToken;
  }
  tokenCache = await fetchToken();
  return tokenCache.accessToken;
}

// --- Request-Helfer ---
async function request(method, path, jsonBody, retry = true) {
  const base = await getApiBase();
  const headers = {};
  if (!IS_LOCAL) headers.Authorization = `Bearer ${await getToken()}`;

  let body;
  if (jsonBody !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(jsonBody);
  }

  let res;
  try {
    res = await fetch(`${base}${path}`, { method, headers, body });
  } catch (err) {
    // local: Port evtl. veraltet (App neu gestartet) → Datei neu lesen, 1× retry.
    if (IS_LOCAL && retry) {
      invalidateBase();
      return request(method, path, jsonBody, false);
    }
    throw new Error(`Erato-API nicht erreichbar (${method} ${path}): ${err.message}`);
  }

  // web: Token abgelaufen → 1× neu holen.
  if (res.status === 401 && !IS_LOCAL && retry) {
    tokenCache = null;
    return request(method, path, jsonBody, false);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Erato-API Fehler (${method} ${path} -> HTTP ${res.status}): ${text || res.statusText}`);
  }

  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// --- API-Methoden ---
export async function listNotebooks() {
  return request("GET", "/v1/notebooks");
}
export async function listPages(notebookId) {
  return request("GET", `/v1/notebooks/${encodeURIComponent(notebookId)}/pages`);
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
export async function deletePage(pageId) {
  return request("DELETE", `/v1/pages/${encodeURIComponent(pageId)}`);
}
export async function createNotebook(title, icon) {
  return request("POST", "/v1/notebooks", icon ? { title, icon } : { title });
}

let hybridAvailable = null;
export async function searchDocs(query) {
  const q = `?q=${encodeURIComponent(query)}`;
  if (hybridAvailable !== false) {
    try {
      const result = await request("GET", `/v1/search/hybrid${q}`);
      hybridAvailable = true;
      return result;
    } catch (err) {
      if (/HTTP 404/.test(err.message)) hybridAvailable = false;
      else throw err;
    }
  }
  return request("GET", `/v1/search${q}`);
}

// --- Scoping / Upsert ---
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Notizbuch über Titel ODER id auflösen. Fällt auf ERATO_NOTEBOOK zurück.
// create=true legt es an, wenn ein Titel (keine id) angegeben ist und es fehlt.
export async function resolveNotebookId(nameOrId, { create = false } = {}) {
  const target = nameOrId || NOTEBOOK;
  if (!target) throw new Error("Kein Notizbuch angegeben (Argument oder ERATO_NOTEBOOK).");
  const list = (await listNotebooks()) || [];
  if (UUID_RE.test(target)) {
    const byId = list.find((n) => n.id === target);
    if (byId) return byId.id;
    throw new Error(`Notizbuch mit id ${target} nicht gefunden.`);
  }
  const byTitle = list.find((n) => (n.title || "").trim().toLowerCase() === target.trim().toLowerCase());
  if (byTitle) return byTitle.id;
  if (create) return (await createNotebook(target)).id;
  throw new Error(`Notizbuch „${target}" nicht gefunden.`);
}

function splitPath(path) {
  const parts = Array.isArray(path) ? path : String(path || "").split("/");
  return parts.map((s) => String(s).trim()).filter(Boolean);
}
function findChild(nodes, title) {
  const t = title.trim().toLowerCase();
  return (nodes || []).find((n) => (n.title || "").trim().toLowerCase() === t) || null;
}

// Idempotentes Anlegen/Aktualisieren einer Seite anhand eines Titel-Pfads
// (z.B. "Architektur/Datenbank"). Fehlende Zwischenseiten werden erstellt;
// die letzte Seite bekommt den Inhalt. Mehrfacher Aufruf → kein Duplikat.
export async function upsertByPath(notebook, path, { title, markdown } = {}) {
  const segs = splitPath(path);
  if (!segs.length) throw new Error("Pfad ist leer.");
  const notebookId = await resolveNotebookId(notebook, { create: true });
  const tree = (await listPages(notebookId)) || [];

  let created = false;
  let parentId = null;
  let node = null;
  for (const seg of segs) {
    const siblings = node ? node.children || [] : tree;
    let child = findChild(siblings, seg);
    if (!child) {
      const c = await createPage({ notebookId, parentId, title: seg });
      child = { id: c.id, title: seg, children: [] };
      created = true;
      if (node) (node.children = node.children || []).push(child);
      else tree.push(child);
    }
    parentId = child.id;
    node = child;
  }
  await updatePage(node.id, { title: title || segs[segs.length - 1], contentMd: markdown });
  return { notebookId, pageId: node.id, created, path: segs.join(" / ") };
}

// Alle Seiten-IDs eines Baums einsammeln (für Notizbuch-Scoping der Suche).
function flattenIds(nodes, acc = new Set()) {
  for (const n of nodes || []) {
    acc.add(n.id);
    flattenIds(n.children, acc);
  }
  return acc;
}

// „Gib mir alles zum Thema X": Hybrid-Suche + Volltext der Top-Treffer in einem
// Aufruf. Optional auf ein Notizbuch eingegrenzt (Default: ERATO_NOTEBOOK).
export async function researchTopic(query, { notebook, limit = 6, maxCharsPerPage = 8000 } = {}) {
  const q = String(query || "").trim();
  if (!q) throw new Error("Leere Suchanfrage.");

  let hits = (await searchDocs(q)) || [];
  let scopeTitle = null;

  // notebook === '*' erzwingt instanzweite Suche (auch wenn ERATO_NOTEBOOK gesetzt ist).
  const scope = notebook === "*" ? null : notebook || NOTEBOOK;
  if (scope) {
    try {
      const nbId = await resolveNotebookId(scope); // kein create
      const ids = flattenIds(await listPages(nbId));
      hits = hits.filter((h) => ids.has(h.pageId));
      const list = (await listNotebooks()) || [];
      scopeTitle = (list.find((n) => n.id === nbId) || {}).title || scope;
    } catch {
      // Notizbuch (noch) nicht vorhanden → keine Treffer im Scope.
      scopeTitle = scope;
      hits = [];
    }
  }

  const total = hits.length;
  const results = [];
  for (const h of hits.slice(0, limit)) {
    const page = await getPage(h.pageId);
    let content = page.contentMd || "";
    const truncated = content.length > maxCharsPerPage;
    if (truncated) content = content.slice(0, maxCharsPerPage);
    results.push({
      pageId: h.pageId,
      title: page.title,
      path: Array.isArray(h.notebookPath) ? h.notebookPath.join(" / ") : h.notebookPath || "",
      contentMd: content,
      truncated,
    });
  }
  return { query: q, scope: scopeTitle, total, returned: results.length, results };
}

export const config = { TARGET, API_URL: IS_LOCAL ? LOCAL_FILE : WEB_API_URL, NOTEBOOK, IS_LOCAL };

// Zentrale Konfiguration aus Umgebungsvariablen mit Dev-Defaults.
const env = process.env

export const config = {
  port: Number(env.PORT ?? 3001),
  host: env.HOST ?? '0.0.0.0',
  webOrigin: env.WEB_ORIGIN ?? 'http://localhost:5173',
  // Öffentliche Basis-URL der API (für Logo-Links, die der Browser lädt).
  apiPublicUrl: env.API_PUBLIC_URL ?? `http://localhost:${Number(env.PORT ?? 3001)}`,

  db: {
    host: env.PGHOST ?? 'localhost',
    port: Number(env.PGPORT ?? 5432),
    user: env.PGUSER ?? 'erato',
    password: env.PGPASSWORD ?? 'erato',
    database: env.PGDATABASE ?? 'erato',
  },

  minio: {
    endPoint: env.MINIO_HOST ?? 'localhost',
    port: Number(env.MINIO_PORT ?? 9000),
    useSSL: (env.MINIO_SSL ?? 'false') === 'true',
    accessKey: env.MINIO_ACCESS_KEY ?? 'minioadmin',
    secretKey: env.MINIO_SECRET_KEY ?? 'minioadmin123',
    bucket: env.MINIO_BRANDING_BUCKET ?? 'branding',
    // Öffentliche Basis-URL für ausgelieferte Assets (Dev: direkt MinIO).
    publicUrl: env.MINIO_PUBLIC_URL ?? 'http://localhost:9000',
  },

  // Ollama (lokale Embeddings). Im Container per Env gesetzt (http://ollama:11434),
  // Host-Default für lokale Tests.
  ollama: {
    url: env.OLLAMA_URL ?? 'http://localhost:11434',
    embedModel: env.EMBED_MODEL ?? 'nomic-embed-text',
    chatModel: env.CHAT_MODEL ?? 'llama3.2:3b',
    // Timeout für einen einzelnen Embedding-Request (ms).
    timeoutMs: Number(env.EMBED_TIMEOUT_MS ?? 30000),
    // Timeout für einen Chat/Generierungs-Request (ms).
    chatTimeoutMs: Number(env.CHAT_TIMEOUT_MS ?? 60000),
  },

  // Keycloak (für geschützte Routen; im P0 erst für Schreibzugriffe genutzt).
  oidc: {
    // issuer = der iss-Claim im Token (browser-seitige URL).
    issuer: env.OIDC_ISSUER ?? 'http://localhost:8085/realms/erato',
    // jwksUri kann abweichen, damit die API Keycloak intern erreicht
    // (im Container: http://keycloak:8080/...), während der issuer-Check gleich bleibt.
    jwksUri:
      env.OIDC_JWKS_URL ??
      `${env.OIDC_ISSUER ?? 'http://localhost:8085/realms/erato'}/protocol/openid-connect/certs`,
    audience: env.OIDC_AUDIENCE ?? 'account',
    adminRole: env.OIDC_ADMIN_ROLE ?? 'admin',
  },
}

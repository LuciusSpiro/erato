# erato-web — Produktions-Image. Mehrstufig: Workspaces bauen → mit nginx ausliefern.
# WICHTIG: Build-Context ist das REPO-ROOT (siehe docker-compose.prod.yml: build.context: .),
# damit die Workspace-Pakete (@erato/design-tokens, @erato/ui) auflösbar sind.

FROM node:22-alpine AS build
WORKDIR /app

# Manifeste zuerst (Layer-Caching für npm ci).
COPY package.json package-lock.json ./
COPY web/package.json ./web/package.json
COPY packages/design-tokens/package.json ./packages/design-tokens/package.json
COPY packages/ui/package.json ./packages/ui/package.json
RUN npm ci

# Quellen kopieren (nur was der Web-Build braucht).
COPY packages ./packages
COPY web ./web

# Build-Zeit-Konfiguration (Vite bäckt VITE_*-Variablen ein).
ARG VITE_API_URL=""
ARG VITE_OIDC_AUTHORITY
ARG VITE_OIDC_CLIENT=erato-web
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_OIDC_AUTHORITY=$VITE_OIDC_AUTHORITY
ENV VITE_OIDC_CLIENT=$VITE_OIDC_CLIENT
RUN npm run build --workspace web

# --- Auslieferung ---
FROM nginx:alpine
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web/dist /usr/share/nginx/html
EXPOSE 80

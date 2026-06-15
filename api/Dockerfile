FROM node:22-alpine
WORKDIR /app

# Nur Manifeste zuerst → besseres Layer-Caching beim Dependency-Install.
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

COPY src ./src

EXPOSE 3001
CMD ["node", "src/server.js"]

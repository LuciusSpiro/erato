# erato-mcp — MCP-Server (stdio/HTTP) für AI-Clients. Build-Context: ./mcp
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund
COPY src ./src
COPY README.md ./README.md
CMD ["node", "src/server.js"]

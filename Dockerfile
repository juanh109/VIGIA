FROM node:24-slim

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.js auth.js crear-usuario.js ./
COPY public ./public

# Cloud Run define PORT (8080); HOST=0.0.0.0 para aceptar tráfico fuera del contenedor
ENV HOST=0.0.0.0
CMD ["node", "server.js"]

# Imagen única: compila el frontend y lo sirve desde el backend Express.
FROM node:20-slim
WORKDIR /app

# 1) Frontend: instalar y compilar (genera frontend/dist)
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# 2) Backend: dependencias de producción
COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev
COPY backend/ ./backend/

ENV NODE_ENV=production
WORKDIR /app/backend

# Aplica migraciones, asegura áreas/etiquetas/admin y arranca el server.
CMD ["sh", "-c", "npm run migrate && npm run seed && node src/index.js"]

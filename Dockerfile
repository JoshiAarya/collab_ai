# Multi-service Dockerfile for CollabAI
# Runs both frontend and backend in a single container

FROM node:20-slim

# Install required tools
RUN apt-get update && apt-get install -y \
    bash \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy backend files
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci

COPY backend/ ./

# Copy frontend files
WORKDIR /app
COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
RUN npm ci

COPY frontend/ ./

# Build args for frontend URLs (overridable via docker-compose `build.args`)
ARG VITE_API_BASE_URL=https://collab-ai-j39n.onrender.com
ARG VITE_WS_BASE_URL=wss://collab-ai-j39n.onrender.com

# Promote to ENV so Vite (reads VITE_* from process.env) picks them up at build time
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_WS_BASE_URL=$VITE_WS_BASE_URL

# Build frontend
RUN npm run build

# Set environment to production
ENV NODE_ENV=production

# Go back to app root
WORKDIR /app

# Expose only backend port (it will serve frontend)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start backend server (serves frontend static files)
CMD ["node", "backend/src/server.js"]

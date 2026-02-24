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

# Build frontend
RUN npm run build

# Create startup script
WORKDIR /app
RUN echo '#!/bin/bash' > start.sh && \
    echo 'echo "Starting CollabAI..."' >> start.sh && \
    echo '' >> start.sh && \
    echo '# Start backend in background' >> start.sh && \
    echo 'echo "Starting backend on port 8080..."' >> start.sh && \
    echo 'cd /app/backend && node src/server.js &' >> start.sh && \
    echo 'BACKEND_PID=$!' >> start.sh && \
    echo '' >> start.sh && \
    echo '# Wait for backend to be ready' >> start.sh && \
    echo 'sleep 3' >> start.sh && \
    echo '' >> start.sh && \
    echo '# Start frontend' >> start.sh && \
    echo 'echo "Starting frontend on port 5173..."' >> start.sh && \
    echo 'cd /app/frontend && npm run preview -- --port 5173 --host 0.0.0.0 &' >> start.sh && \
    echo 'FRONTEND_PID=$!' >> start.sh && \
    echo '' >> start.sh && \
    echo 'echo ""' >> start.sh && \
    echo 'echo "✅ CollabAI is running!"' >> start.sh && \
    echo 'echo "   Frontend: http://localhost:5173"' >> start.sh && \
    echo 'echo "   Backend:  http://localhost:8080"' >> start.sh && \
    echo 'echo ""' >> start.sh && \
    echo '' >> start.sh && \
    echo '# Wait for both processes' >> start.sh && \
    echo 'wait $BACKEND_PID $FRONTEND_PID' >> start.sh && \
    chmod +x start.sh

# Expose ports
EXPOSE 5173 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8080/health && curl -f http://localhost:5173 || exit 1

# Start both services
CMD ["/bin/bash", "/app/start.sh"]

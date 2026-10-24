# Single-container deploy (backend + AI service) for free hosting.
# Express backend listens on $PORT (public); the lite FastAPI AI service runs
# inside the same container on 127.0.0.1:8000, which is where the backend
# already looks by default (AI_SERVICE_URL=http://localhost:8000).
FROM node:20-slim

# Python (AI service) + Chromium (PDF export)
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 python3-venv chromium fonts-liberation \
    && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# AI service deps (lite: no PyTorch, fits in 512 MB)
COPY ai-service/requirements-lite.txt ai-service/requirements-lite.txt
RUN python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir -r ai-service/requirements-lite.txt

# Backend deps
COPY backend/package*.json backend/
RUN cd backend && npm ci --omit=dev

COPY ai-service ai-service
COPY testing testing
COPY backend backend
RUN mkdir -p /app/uploads /app/generated_tdd

ENV AI_SERVICE_URL=http://127.0.0.1:8000
EXPOSE 3001
CMD ["sh", "-c", "(cd /app/ai-service && /opt/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000) & cd /app/backend && exec node server.js"]

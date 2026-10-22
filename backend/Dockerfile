FROM node:20-slim

# PDF export drives a headless browser (puppeteer). Install the distro
# Chromium and skip puppeteer's own download.
RUN apt-get update && apt-get install -y --no-install-recommends chromium fonts-liberation \
    && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p /app/uploads /app/generated_tdd

EXPOSE 3001
CMD ["node", "server.js"]

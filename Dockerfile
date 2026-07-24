FROM node:22-slim
WORKDIR /app

# Cài Chromium từ Debian repos (Puppeteer dùng Chrome này thay vì tự download)
RUN apt-get update && apt-get install -y \
    chromium \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Bắt buộc Puppeteer dùng Chromium hệ thống, không tự download
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Copy package files trước để tận dụng Docker layer cache
COPY package.json ./
RUN npm install

# Copy source + build
COPY . .
RUN npx prisma generate && npm run build

EXPOSE 8888
ENV NODE_ENV=production

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]

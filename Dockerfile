# Production Multi-Stage Dockerfile for Moonshot Clone
# High-performance AI Video Editor with LibASS Subtitle Burning & Word Alignment

FROM node:20-bullseye-slim

# Install system dependencies: FFmpeg (with libass enabled), Python3, python3-requests, Fontconfig, and standard fonts
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-requests \
    python-is-python3 \
    fonts-dejavu-core \
    fonts-liberation \
    fontconfig \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install production dependencies
RUN npm install --omit=dev

# Copy application source code
COPY . .

# Ensure storage directories exist and refresh font cache
RUN mkdir -p uploads exports data scratch && \
    fc-cache -fv

# Environment defaults
ENV NODE_ENV=production
ENV PYTHONIOENCODING=utf-8
ENV PYTHONUTF8=1

# Expose Render standard port (10000) and local port (3000)
EXPOSE 10000 3000

CMD ["node", "server.js"]

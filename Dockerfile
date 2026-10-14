# Production Multi-Stage Dockerfile for Moonshot Clone
# High-performance AI Video Editor with LibASS Subtitle Burning & Word Alignment

FROM node:20-bullseye-slim

# Install system dependencies: FFmpeg (with libass enabled), Python3, Fontconfig, and standard fonts
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-pip \
    python-is-python3 \
    fonts-dejavu-core \
    fonts-liberation \
    fontconfig \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python requirements for high-accuracy Groq speech recognition
RUN pip3 install --no-cache-dir requests

# Copy dependency manifests
COPY package*.json ./

# Install production dependencies
RUN npm install --production

# Copy application code
COPY . .

# Ensure storage directories exist and refresh font cache
RUN mkdir -p uploads exports data scratch && \
    fc-cache -fv

# Cloud hosting environment variables
ENV PORT=3000
ENV NODE_ENV=production
ENV PYTHONIOENCODING=utf-8
ENV PYTHONUTF8=1

EXPOSE 3000

# Healthcheck to ensure container is healthy
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${PORT}/ || exit 1

CMD ["node", "server.js"]

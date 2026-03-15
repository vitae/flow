FROM node:20-slim

RUN apt-get update && apt-get install -y ffmpeg python3 pip curl && \
    pip install --upgrade yt-dlp --break-system-packages && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY worker/package*.json ./
RUN npm install

# Install Playwright Chromium + its OS dependencies
RUN npx playwright install chromium --with-deps

COPY worker/ .
RUN npm run build

EXPOSE 3001
CMD ["npm", "start"]

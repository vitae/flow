FROM node:20-slim

RUN apt-get update && apt-get install -y ffmpeg python3 pip && \
    pip install yt-dlp --break-system-packages && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY worker/package*.json ./
RUN npm install
COPY worker/ .
RUN npm run build

EXPOSE 3001
CMD ["npm", "start"]

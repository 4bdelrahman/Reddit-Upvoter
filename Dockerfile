FROM mcr.microsoft.com/playwright:v1.52.0-jammy
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci
COPY backend/ .
RUN npm run build
CMD ["node", "dist/index.js"]

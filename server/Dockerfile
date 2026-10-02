# Packages the server so any host can run it the same way.
FROM node:22-slim

WORKDIR /app

# Install packages first, so Docker can reuse this step when only the code changes.
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 8000

# The host sets PORT. The server reads it (see src/config.js).
CMD ["node", "src/index.js"]

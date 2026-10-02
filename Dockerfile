FROM node:22-alpine

WORKDIR /usr/app

# Fix node module cache dir permissions
RUN mkdir -p /usr/app/node_modules && chown -R node:node /usr/app

# Copy the application code
COPY . .

# Install dependencies
RUN npm install

# Vite embeds these browser-facing addresses during the build.
ARG VITE_DASH_PLAYER_URL=http://localhost:5173
ARG VITE_DASH_PLAYER_ORIGIN=http://localhost:5173
ENV VITE_DASH_PLAYER_URL=$VITE_DASH_PLAYER_URL
ENV VITE_DASH_PLAYER_ORIGIN=$VITE_DASH_PLAYER_ORIGIN
RUN npm run build

# Set user to node
USER node

# Run the application
CMD ["node", "serve.js"]

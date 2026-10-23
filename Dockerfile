FROM node:22.23.4-alpine

WORKDIR /usr/app

# Fix node module cache dir permissions
RUN mkdir -p /usr/app/node_modules && chown -R node:node /usr/app

# Copy the application code
COPY . .

# Install dependencies
RUN npm install

RUN npm run build

# Set user to node
USER node

# Run the application
CMD ["node", "serve.js"]

FROM node:22.17.0-alpine as build

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build Tailwind CSS
RUN npm run tailwind:build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Install gettext for envsubst (to substitute env vars in config)
RUN apk add --no-cache gettext

# Copy built frontend files from build stage
COPY --from=build /app /usr/share/nginx/html

# Copy nginx config template (only server block, no events or http)
COPY nginx.conf.template /etc/nginx/conf.d/default.conf.template

# Expose HTTP port
EXPOSE 80

# Run envsubst on template and start nginx
CMD /bin/sh -c "envsubst '\$API_BASE_URL \$SERVER_PORT' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"
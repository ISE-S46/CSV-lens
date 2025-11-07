FROM node:22.17.0-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run tailwind:build

FROM nginx:alpine

RUN apk add --no-cache gettext

COPY --from=build /app/*.html /usr/share/nginx/html/
COPY --from=build /app/css /usr/share/nginx/html/css/
COPY --from=build /app/Script /usr/share/nginx/html/Script
COPY --from=build /app/config.js /usr/share/nginx/html/config.js

COPY nginx.conf.template /etc/nginx/conf.d/default.conf.template

EXPOSE 80

CMD ["/bin/sh", "-c", "envsubst '$API_BASE_URL $SERVER_PORT' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"]
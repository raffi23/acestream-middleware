FROM node:20-alpine AS base

RUN apk update
RUN apk add --no-cache libc6-compat

RUN corepack enable

WORKDIR /app

COPY package.json yarn.lock ./ 
RUN yarn   

COPY . .

RUN npx tsc

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 --ingroup nodejs nodejs-user \
    && mkdir -p /app/dist/src/public \
    && chown -R nodejs-user:nodejs ./dist/src/public \
    && chmod -R 755 ./dist/src/public

USER nodejs-user

CMD ["node", "./dist/src/index.js"] 

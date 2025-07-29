FROM node:20-alpine AS base

RUN apk update
RUN apk add --no-cache libc6-compat

RUN corepack enable

WORKDIR /app

COPY package.json yarn.lock ./ 
RUN yarn   

COPY . .

RUN npx tsc

RUN mkdir -p ./dist/src/public

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs-user

USER nodejs-user

CMD ["node", "./dist/src/index.js"] 

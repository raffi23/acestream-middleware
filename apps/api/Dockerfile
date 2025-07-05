FROM node:20-alpine AS base

RUN apk update
RUN apk add --no-cache libc6-compat

RUN corepack enable

WORKDIR /app

COPY package.json yarn.lock ./ 
RUN yarn   

COPY . .

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs-user

USER nodejs-user

CMD ["yarn", "start"] 

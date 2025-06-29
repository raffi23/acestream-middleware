FROM node:20-alpine AS base

RUN apk update
RUN apk add --no-cache libc6-compat
RUN corepack enable

RUN corepack enable

WORKDIR /app

COPY package.json yarn.lock ./ 
RUN yarn

COPY . .

RUN yarn build

EXPOSE 4001

CMD ["yarn", "start"] 

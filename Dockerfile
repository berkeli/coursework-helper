FROM node:18

ENV NODE_ENV=development
WORKDIR /app

COPY package.json ./
COPY yarn.lock ./

RUN yarn

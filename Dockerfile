FROM node:15-alpine

WORKDIR /app
COPY app/package.json ./
COPY app/yarn.lock ./

ENV YARN_CACHE_FOLDER /yarn
RUN mkdir -p $YARN_CACHE_FOLDER\
    && yarn install --production \
    && rm -rf /var/cache/apk/* \
    && rm -rf /usr/local/share/.cache/yarn/*

COPY app ./
EXPOSE 60000
CMD [ "node", "index.js" ]
FROM ubuntu:16.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update
RUN apt-get upgrade -y\
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        sudo \
        vim \
    && curl -sL https://deb.nodesource.com/setup_10.x | bash - \ 
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

COPY . /guppy
WORKDIR /guppy

RUN COMMIT=`git rev-parse HEAD` && echo "export const guppyCommit = \"${COMMIT}\";" >versions.js \
    && VERSION=`git describe --always --tags` && echo "export const guppyVersion =\"${VERSION}\";" >>versions.js \
    && /bin/rm -rf .git \
    && /bin/rm -rf node_modules \
    && npm ci

EXPOSE 3000

CMD npm start

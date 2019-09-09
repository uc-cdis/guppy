FROM ubuntu:16.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        sudo \
        vim \
    && curl -sL https://deb.nodesource.com/setup_10.x | bash - \ 
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

COPY . /guppy/
WORKDIR /guppy

RUN COMMIT=`git rev-parse HEAD` && echo "export const guppyCommit = \"${COMMIT}\";" >versions.js
RUN VERSION=`git describe --always --tags` && echo "export const guppyVersion =\"${VERSION}\";" >>versions.js
RUN /bin/rm -rf .git
RUN /bin/rm -rf node_modules

RUN useradd -d /guppy gen3 && chown -R gen3: /guppy
USER gen3
RUN npm ci --unsafe-perm
RUN npm run-script prepare

EXPOSE 3000

CMD node dist/server/server.js


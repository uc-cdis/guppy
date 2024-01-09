FROM quay.io/cdis/ubuntu:20.04

ENV DEBIAN_FRONTEND=noninteractive

# need libcap2-bin so we can do setcap later
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        sudo \
        vim \
        libcap2-bin \
    && curl -sL https://deb.nodesource.com/setup_16.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g npm@8

COPY . /guppy/
WORKDIR /guppy

RUN COMMIT=`git rev-parse HEAD` && echo "export const gitCommit = \"${COMMIT}\";" >src/server/version.js
RUN VERSION=`git describe --always --tags` && echo "export const gitVersion =\"${VERSION}\";" >>src/server/version.js
RUN /bin/rm -rf .git
RUN /bin/rm -rf node_modules

RUN useradd -d /guppy gen3 && chown -R gen3: /guppy
# see https://superuser.com/questions/710253/allow-non-root-process-to-bind-to-port-80-and-443
RUN setcap CAP_NET_BIND_SERVICE=+eip /usr/bin/node
USER gen3
RUN npm ci
RUN npm run-script prepare

EXPOSE 3000
EXPOSE 80

CMD bash ./startServer.sh

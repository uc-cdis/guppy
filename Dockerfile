FROM node_base

# nvm environment variables
# ENV NVM_DIR /usr/local/nvm
ENV NODE_VERSION 16

# Install nodejs 16 and npm 8
RUN source ~/.nvm/nvm.sh \
    && nvm install $NODE_VERSION \
    && nvm use $NODE_VERSION

# RUN source ~/.nvm/nvm.sh \
#     && NODE_PATH=$(nvm which node)

RUN source ~/.nvm/nvm.sh \
&& npm install -g npm@8


COPY . /guppy/
WORKDIR /guppy

RUN COMMIT=`git rev-parse HEAD` && echo "export const gitCommit = \"${COMMIT}\";" >src/server/version.js
RUN VERSION=`git describe --always --tags` && echo "export const gitVersion =\"${VERSION}\";" >>src/server/version.js
RUN /bin/rm -rf .git
RUN /bin/rm -rf node_modules

RUN chown -R gen3: /guppy
# see https://superuser.com/questions/710253/allow-non-root-process-to-bind-to-port-80-and-443
RUN source ~/.nvm/nvm.sh \
&& NODE_LOCATION=$(nvm which node) \
&& echo ${NODE_LOCATION} \
 && setcap CAP_NET_BIND_SERVICE=+eip "$NODE_LOCATION"
USER gen3
RUN source /root/.nvm/nvm.sh && npm ci
# RUN npm run-script prepare

EXPOSE 3000
EXPOSE 80

# CMD [ "bash", "./startServer.sh" ]

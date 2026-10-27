FROM 707767160287.dkr.ecr.us-east-1.amazonaws.com/gen3/amazonlinux-base:nodejs24-base

COPY . /guppy/
WORKDIR /guppy

RUN COMMIT=`git rev-parse HEAD` && echo "export const gitCommit = \"${COMMIT}\";" >src/server/version.js
RUN VERSION=`git describe --always --tags` && echo "export const gitVersion =\"${VERSION}\";" >>src/server/version.js
RUN /bin/rm -rf .git
RUN /bin/rm -rf node_modules

# OpenShift runs containers with an arbitrary UID in the root group (GID 0), so the
# app tree must be owned by GID 0 and group-writable. Building as gen3:0 with umask 002
# makes the files created by npm group-writable without a second chown/chmod layer.
# node lives under /home/gen3/.nvm, so that directory must be traversable by other UIDs.
RUN chown -R gen3:0 /guppy && chmod -R g=u /guppy && chmod 711 /home/gen3
USER gen3:0
RUN umask 002 && source $NVM_DIR/nvm.sh && npm ci
RUN umask 002 && npm run-script prepare

# Serve on an unprivileged port instead of 80: node no longer carries a
# cap_net_bind_service file capability (restricted SCCs drop all caps, so a
# setcap'd binary fails to exec). Override with GUPPY_PORT if needed.
ENV HOME=/tmp \
    GUPPY_PORT=8080
USER 1000:0

EXPOSE 8080

CMD [ "bash", "./startServer.sh" ]

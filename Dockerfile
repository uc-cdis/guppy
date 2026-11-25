ARG BASE_IMAGE=quay.io/cdis/amazonlinux-base:hardened

FROM ${BASE_IMAGE} AS builder

RUN dnf install -y --setopt=install_weak_deps=False --setopt=tsflags=nodocs \
        git nodejs24 nodejs24-npm \
    && dnf clean all \
    && mkdir /guppy \
    && chown gen3:gen3 /guppy

WORKDIR /guppy
COPY --chown=gen3:gen3 .git .git
COPY --chown=gen3:gen3 package.json package-lock.json .babelrc ./
COPY --chown=gen3:gen3 src ./src
USER gen3

RUN COMMIT="$(git rev-parse HEAD)" \
    && VERSION="$(git describe --always --tags)" \
    && printf 'export const gitCommit = "%s";\nexport const gitVersion = "%s";\n' \
        "$COMMIT" "$VERSION" > src/server/version.js \
    && npm ci \
    && npm prune --omit=dev --ignore-scripts

FROM ${BASE_IMAGE} AS runtime

# Keep runtime libraries and CA certificates while removing the shell and package tools.
RUN dnf swap -y openssl-fips-provider-latest openssl-fips-provider-certified \
        --setopt=install_weak_deps=False --setopt=tsflags=nodocs \
    && dnf install -y nodejs24 \
        --setopt=install_weak_deps=False --setopt=tsflags=nodocs \
    && dnf clean all \
    && /usr/sbin/setcap CAP_NET_BIND_SERVICE=+eip "$(readlink -f /usr/bin/node)" \
    && dnf remove -y --setopt=protected_packages= --setopt=clean_requirements_on_remove=False \
        dnf yum python3-dnf \
    && rpm -e --nodeps --noscripts bash python3 $(rpm -qa 'python3-*') curl-minimal rpm \
    && rm -f /usr/bin/dnf

WORKDIR /guppy
COPY --from=builder --chown=0:0 /guppy/dist ./dist
COPY --from=builder --chown=0:0 /guppy/node_modules ./node_modules
COPY --from=builder --chown=0:0 /guppy/package.json ./package.json
COPY --from=builder --chown=0:0 /guppy/package-lock.json ./package-lock.json

USER gen3
EXPOSE 3000
EXPOSE 80

# Node permission model:
CMD ["node", \
     "--permission", \
     "--allow-fs-read=/guppy/", \
     "--disallow-code-generation-from-strings", \
     "--max-http-header-size", "16000", \
     "dist/server/server.js"]

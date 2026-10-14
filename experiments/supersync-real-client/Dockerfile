FROM node:24.19.0-bookworm-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df AS build
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN git init && git remote add origin https://github.com/super-productivity/super-productivity.git && git fetch --depth=1 origin 173b3fa35f744bde46222a5bc141986a35bd5fb5 && git checkout --detach FETCH_HEAD && test "$(git rev-parse HEAD)" = 173b3fa35f744bde46222a5bc141986a35bd5fb5
RUN npm ci --ignore-scripts --no-audit --no-fund && node node_modules/electron/install.js
RUN node node_modules/ts-patch/bin/ts-patch.js install
RUN npm run buildFrontend:prod:es6 && SP_SKIP_WAYLAND_IDLE_HELPER_BUILD=1 npm run electron:build
RUN node --test electron/local-rest-api.test.cjs

FROM node:24.19.0-bookworm-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates xvfb x11vnc novnc websockify openbox dbus-x11 libgtk-3-0 libnss3 libasound2 libgbm1 libxss1 libatk-bridge2.0-0 libdrm2 libxkbcommon0 libx11-xcb1 libsecret-1-0 fonts-liberation util-linux && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app /app
# Keep Chromium's sandbox enabled. Hosts must support its sandbox requirements.
RUN chown root:root node_modules/electron/dist/chrome-sandbox && chmod 4755 node_modules/electron/dist/chrome-sandbox && mkdir -p /data && chown node:node /data
COPY proxy.cjs start.sh smoke-gui.cjs /opt/client/
RUN node --check /opt/client/proxy.cjs && sh -n /opt/client/start.sh
USER node
ENV NODE_ENV=PROD DISPLAY=:99 HOME=/data
EXPOSE 6080 3877
ENTRYPOINT ["/bin/sh", "/opt/client/start.sh"]

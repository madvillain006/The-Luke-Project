FROM node:24-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive DISPLAY=:99 MUGGZONE_DATA_ROOT=/workspace/muggzone-data
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium xvfb x11vnc novnc websockify openbox openssh-server \
    dbus-x11 tini ca-certificates procps \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --shell /bin/bash trader && passwd -d trader \
    && mkdir -p /run/sshd /opt/muggzone/deploy/muggzone
WORKDIR /opt/muggzone
COPY lib/kat-stage2 ./lib/kat-stage2
COPY lib/muggzone ./lib/muggzone
COPY scripts/muggzone-observe.js scripts/muggzone-replay.js ./scripts/
COPY config/muggzone.example.json ./config/muggzone.example.json
COPY deploy/muggzone ./deploy/muggzone
RUN cd deploy/muggzone && npm install --omit=dev --ignore-scripts \
    && chmod 755 entrypoint.sh start-desktop.sh start-observer.sh
EXPOSE 22
ENTRYPOINT ["/usr/bin/tini", "--", "/opt/muggzone/deploy/muggzone/entrypoint.sh"]

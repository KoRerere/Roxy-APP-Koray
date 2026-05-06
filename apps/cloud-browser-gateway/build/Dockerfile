FROM ghcr.io/m1k1o/neko/base:3.1.4

COPY --chmod=755 ./145/ /opt/roxychrome/

RUN chmod +x /opt/roxychrome/RoxyChrome \
    && chmod +x /opt/roxychrome/chromedriver \
    && chmod +x /opt/roxychrome/chrome_crashpad_handler

RUN apt-get update && apt-get install -y --no-install-recommends \
    xclip \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    gstreamer1.0-tools \
    gstreamer1.0-plugins-bad \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /etc/roxychrome/policies/managed

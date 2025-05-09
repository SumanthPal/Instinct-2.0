FROM python:3.11.8-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget unzip curl gnupg ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 \
    libatk1.0-0 libcups2 libdbus-1-3 libgdk-pixbuf2.0-0 libnspr4 libnss3 \
    libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 xdg-utils libu2f-udev libvulkan1 \
    supervisor \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Chrome for Testing (fixed version like Heroku's buildpack)
ENV CHROME_VERSION=122.0.6261.111

# Install Chrome
RUN wget -q https://edgedl.me.gvt1.com/edgedl/chrome/chrome-for-testing/${CHROME_VERSION}/linux64/chrome-linux64.zip -O /tmp/chrome.zip && \
    unzip -q /tmp/chrome.zip -d /opt && \
    mv /opt/chrome-linux64 /opt/chrome && \
    ln -s /opt/chrome/chrome /usr/bin/google-chrome && \
    rm /tmp/chrome.zip

# Install Chromedriver
RUN wget -q https://edgedl.me.gvt1.com/edgedl/chrome/chrome-for-testing/${CHROME_VERSION}/linux64/chromedriver-linux64.zip -O /tmp/chromedriver.zip && \
    unzip -q /tmp/chromedriver.zip -d /opt && \
    mv /opt/chromedriver-linux64/chromedriver /usr/bin/chromedriver && \
    chmod +x /usr/bin/chromedriver && \
    rm -rf /tmp/chromedriver.zip /opt/chromedriver-linux64

ENV CHROME_BIN=/usr/bin/google-chrome
ENV CHROMEDRIVER_PATH=/usr/bin/chromedriver

# Copy requirements files first for better caching
COPY requirements.txt ./

# Install Python dependencies in a single layer
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create a supervisor configuration
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Default command (supervisor will manage all processes)
CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
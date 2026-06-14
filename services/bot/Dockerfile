# Bot-runner image — fleshed out in M3/M4. Skeleton documents the required system packages.
# Base includes Chromium, FFmpeg, Xvfb, PulseAudio; Playwright drives a headful Chromium on :99.
FROM mcr.microsoft.com/playwright:v1.50.0-jammy AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    xvfb \
    pulseaudio \
    ffmpeg \
    tini \
  && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# M3: COPY workspace, pnpm install --filter @pmn/bot, build, generate overlay.y4m (with C420 fix),
# then ENTRYPOINT ["tini","--","node","dist/runner.js"].
CMD ["bash", "-lc", "echo 'bot-runner image — implement in M3' && exit 1"]

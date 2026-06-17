# Vexa bot patches

Local patches we apply to the pinned Vexa checkout (`infra/compose/vexa/upstream/`, gitignored) before
rebuilding the `vexaai/vexa-bot` image. Kept here so the changes survive re-clones and are reviewable.

## `gmeet-webgl-antidetect.patch`

Adds a **WebGL renderer spoof** to the Google Meet anti-detection init-script in
`services/vexa-bot/core/src/index.ts`. The bot runs headful under Xvfb with no GPU, so Chromium reports
`WEBGL_debug_renderer_info` = "Google SwiftShader" / "Google Inc." — a software rasterizer that exists on
zero real devices and is the strongest headless tell. reCAPTCHA Enterprise fuses it into a low score and
bounces the anonymous guest to `workspace.google.com`. The patch overrides `getParameter` to report a
plausible Linux/Mesa Intel ANGLE renderer, consistent with the Linux x86_64 Chrome UA.

**Status:** part of the no-login Google Meet attempt, which is **parked** — Meet's block is primarily
IP-reputation based (issue #444), so a datacenter VPS will block Meet regardless of fingerprint and needs a
residential proxy. Teams/Zoom are unaffected. This patch is the fingerprint half of the eventual
Meet-via-residential-proxy path; it does not help on its own from a datacenter IP.

### Apply + rebuild

```sh
cd infra/compose/vexa/upstream
git apply ../patches/gmeet-webgl-antidetect.patch      # or: ~/vexa-engine on the VPS
cd services/vexa-bot && docker build -t vexaai/vexa-bot:latest .   # then re-dispatch
```

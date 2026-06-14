# services/bot — Google Meet recording bot (built in M3/M4)

Linux-only ephemeral container. One per meeting, spawned by the `bot-manager` worker role via the
Docker socket, reaped on exit. **Never runs as host Node on Windows** — always a container.

## Internals (planned)

- `tini` (PID 1) supervises: `Xvfb :99` (virtual display), `pulseaudio` (null sink + monitor),
  Playwright-driven **headful** Chromium, and `ffmpeg` (x11grab + pulse → mp4).
- Branded virtual cam (M4): a looping `overlay.y4m` generated from a branded PNG at image-build time,
  fed via `--use-file-for-fake-video-capture`; camera turned **on** so the "recording in progress" tile
  broadcasts. Mandatory Y4M header fix: `C420mpeg2` → `C420`.

## Join state machine

`launching → page_loaded → name_set → camera_on → asked_to_join → in_lobby → admitted → in_call →
recording → ending → uploading → done`, side-exits `not_admitted | timed_out | error | stopped`.

## Env contract (set by bot-manager at spawn)

`MEET_URL`, `DISPLAY_NAME`, `MEETING_ID`, `BOT_SESSION_ID`, `JOIN_TOKEN`, `CALLBACK_BASE_URL`,
`OVERLAY_PATH`, `OUTPUT_BUCKET`, `OUTPUT_KEY`, scoped upload-only S3 creds, `MAX_DURATION_SECONDS`,
`JOIN_TIMEOUT_SECONDS`, `ALONE_GRACE_SECONDS`, `RESOLUTION`, `FRAMERATE`.

The bot receives **only** a one-time `JOIN_TOKEN` (for the internal status callback) and upload-only
storage creds — never DB credentials or the master key.

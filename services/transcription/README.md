# services/transcription — post-call STT (built in M5)

Python service. BullMQ consumer (via a small bridge or polling) that: downloads the recording mp4 from
object storage, extracts 16 kHz mono WAV with ffmpeg, runs **faster-whisper** (model size configurable,
int8 on CPU), optionally diarizes with WhisperX + pyannote (off by default in v1 — slow on CPU), writes
`transcripts` + `transcript_segments`, then enqueues the `summarize` job.

CPU-only by default; GPU optional later. Kept as a separate (Python) image; everything else is TypeScript.

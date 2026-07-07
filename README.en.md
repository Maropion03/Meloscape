<h1 align="center">MELOSCAPE</h1>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-orange" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/frontend-HTML%2FCSS%2FJS-brown" alt="Frontend">
  <img src="https://img.shields.io/badge/audio-Web%20Audio%20API-amber" alt="Web Audio API">
  <img src="https://img.shields.io/badge/server-Node.js-green" alt="Node.js">
</p>

<p align="center">
  <img src="meloscape-promo.png" alt="Meloscape promo screenshot" width="100%">
</p>

<p align="center">
  <a href="README.md">中文版本</a>
</p>

Meloscape is a real-time music visualizer inspired by pixel art aesthetics. Paste a NetEase Cloud Music / QQ Music / Kugou link, or upload a local audio file, and it will generate and switch dynamic soundscapes based on rhythm, mood, and song structure.

## Features

- **Multi-platform link parsing** — NetEase Cloud Music, QQ Music, Kugou
- **Real-time audio analysis** — BPM detection, mood estimation, section detection (intro / verse / chorus / bridge / outro)
- **5 reactive scenes that auto-switch**
  - neon · sunset pulse
  - golden · tidal glow
  - deepsea · evening breeze
  - fractal · pixel palms
  - ink · oak shadows
- **Local proxy server** — bypass CORS and proxy audio streams
- **Multiple input methods** — paste link, drag & drop, local upload

## Tech Stack

- Frontend: vanilla HTML5 + CSS3 + Canvas + Web Audio API
- Backend: Node.js local proxy server
- Metadata: third-party NetEase API with QQ Music search fallback

## Run Locally

```bash
# 1. Clone the repo
git clone https://github.com/Maropion03/audio-visualizer.git
cd audio-visualizer

# 2. Start the local server (includes API proxy)
./start.sh

# 3. Open in browser
# http://localhost:8765
```

Or run Node directly:

```bash
node server.js
```

## Usage

1. Open the page, click **Paste link** to paste a music URL, or drag in a local audio file
2. Wait 1–3 seconds; the soundscape will change automatically with the music
3. Press `SPACE` to play / pause

## Project Structure

```
audio-visualizer/
├── index.html           # Single-page app
├── server.js            # Node.js proxy server
├── start.sh             # One-click launcher
├── meloscape-promo.png  # Promo screenshot
└── README.en.md         # This file
```

> Note: the `assets/` folder is used for background images and the favicon. It is listed in `.gitignore` and will not be committed. Please prepare it yourself or download it from Releases before running.

## Notes

- For learning and experimentation only
- Some tracks may be unavailable due to copyright / VIP restrictions
- Platform APIs may change; if parsing fails, try another track

## License

MIT

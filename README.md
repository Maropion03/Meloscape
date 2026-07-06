# Meloscape

A real-time music visualization web app inspired by the clean, pixel-art aesthetic of [Mistral.ai](https://mistral.ai/). Paste a NetEase / QQ Music / Kugou link, and Meloscape generates a living landscape that reacts to rhythm, mood, and song structure.

## Features

- **Multi-platform link parsing** — NetEase Cloud Music, QQ Music, Kugou
- **Real-time audio analysis** — BPM detection, mood estimation, segment detection (intro / verse / chorus / bridge / outro)
- **5 reactive visual scenes** that switch automatically with the music
  - neon · sunset pulse
  - golden · tidal glow
  - deepsea · evening breeze
  - fractal · pixel palms
  - ink · oak shadows
- **Local proxy server** — bypasses CORS and proxies audio streams
- **Multiple inputs** — paste a link, drag-and-drop audio, or upload

## Tech Stack

- Frontend: vanilla HTML5 + CSS3 + Canvas + Web Audio API
- Backend: Node.js local proxy server
- Metadata: third-party NetEase API + QQ Music search fallback

## Local Run

```bash
# 1. Clone
git clone https://github.com/Maropion03/audio-visualizer.git
cd audio-visualizer

# 2. Start the local server (includes API proxy)
./start.sh

# 3. Open in browser
# http://localhost:8765
```

Or run directly with Node:

```bash
node server.js
```

## Usage

1. Open the page and click **Paste link** or press `SPACE` for the demo track
2. Paste a NetEase / QQ Music / Kugou link and click parse
3. Wait 1-3 seconds; the landscape reacts to the music automatically
4. You can also drag-and-drop a local audio file

## Project Structure

```
audio-visualizer/
├── assets/
│   └── pixel-beach-oak-palms.png   # default pixel-art backdrop
├── index.html                       # single-page app
├── server.js                        # Node.js proxy server
├── start.sh                         # one-click launcher
└── README.md
```

## Notes

- For learning and experimentation only
- Some tracks are blocked by copyright / VIP restrictions
- Platform APIs change frequently; if parsing fails, try a freely available track

## License

MIT

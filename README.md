# CLAUDE.GIS

AI-powered WebGIS. Draw on the map, let Copilot analyze it.

## Setup

```bash
npm install
npm start
```

`http://localhost:3000` → Enter your Claude API key → use the map.

## Tools

| | |
|---|---|
| `◉` | Point |
| `⬡` | Polygon — double-click to finish |
| `╱` | Line — double-click to finish |
| `⌖` | Measure distance |
| `⌫` | Clear all |

## Structure

```
backend/server.js   — Express + Claude API proxy
frontend/index.html — Layout
frontend/app.js     — Map & chat logic
assets/style.css    — Styles
```

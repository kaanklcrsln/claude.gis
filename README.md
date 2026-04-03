
Claude-integrated WebGIS. Draw on the map, let Copilot analyze it.

<img width="1420" height="839" alt="Screenshot 2026-04-03 at 16 03 01" src="https://github.com/user-attachments/assets/32e63c27-9c07-4ff6-bc14-81127d40e1b2" />

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

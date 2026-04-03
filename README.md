# CLAUDE.GIS

AI-powered WebGIS. Haritaya çizin, Copilot analiz etsin.

## Kurulum

```bash
npm install
npm start
```

`http://localhost:3000` → Claude API anahtarını girin → haritayı kullanın.

## Araçlar

| | |
|---|---|
| `◉` | Nokta |
| `⬡` | Poligon — çift tık ile bitir |
| `╱` | Çizgi — çift tık ile bitir |
| `⌖` | Mesafe ölçüm |
| `⌫` | Temizle |

## Yapı

```
backend/server.js   — Express + Claude API proxy
frontend/index.html — Layout
frontend/app.js     — Harita & chat mantığı
assets/style.css    — Stiller
```

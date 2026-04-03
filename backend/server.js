const express = require('express');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/assets', express.static(path.join(__dirname, '../assets')));

app.post('/api/chat', async (req, res) => {
  const { message, apiKey, context, history } = req.body;

  if (!apiKey) return res.status(400).json({ error: 'API key required' });
  if (!message) return res.status(400).json({ error: 'Message required' });

  const client = new Anthropic({ apiKey });

  const systemPrompt = `You are GeoAI Copilot inside CLAUDE.GIS. You are a GIS expert assistant.
Your role: analyze map geometries, perform coordinate conversions, calculate area/distance, explain buffer analysis.
Always respond in English, concisely and precisely. Be technical but clear.

Current map state:
- Total geometries: ${context?.geometryCount ?? 0}
- Recent geometries: ${JSON.stringify(context?.geometries ?? [], null, 2)}

Geometry reference:
• point → lat/lng coordinates
• polygon → area (m²/hectares) and coordinate list
• line → length (m/km) and coordinate list
• measurement → temporary measurement line`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const messages = [];

  if (Array.isArray(history)) {
    for (const h of history) {
      if (h.role && h.content) messages.push({ role: h.role, content: h.content });
    }
  }

  messages.push({ role: 'user', content: message });

  try {
    const stream = await client.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    const errMsg = err?.status === 401 ? 'Invalid API key.' : err.message;
    if (!res.headersSent) {
      res.status(500).json({ error: errMsg });
    } else {
      res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
      res.end();
    }
  }
});

app.listen(PORT, () => {
  console.log(`\n  CLAUDE.GIS → http://localhost:${PORT}\n`);
});

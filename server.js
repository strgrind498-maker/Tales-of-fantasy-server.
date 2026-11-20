'use strict';

const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = Number(process.env.PORT || 3000);
const MAX_PLAYERS = 10;
const MAX_NAME = 20;
const MAX_CHAT = 180;
const players = new Map();

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/health') {
    const body = JSON.stringify({
      ok: true,
      game: 'Tales of Fantasy',
      online: players.size,
      capacity: MAX_PLAYERS
    });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    return res.end(body);
  }
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

const wss = new WebSocketServer({ server, maxPayload: 16 * 1024 });

function send(ws, t, d) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ t, d }));
  }
}

function broadcast(t, d, except = null) {
  for (const ws of wss.clients) {
    if (ws !== except && ws.readyState === WebSocket.OPEN && ws.playerId) {
      send(ws, t, d);
    }
  }
}

function cleanText(value, max) {
  return String(value ?? '').replace(/[<>\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
}

function publicPlayer(p) {
  return {
    i: p.i,
    name: p.name,
    cls: p.cls,
    lv: p.lv,
    x: p.x,
    y: p.y,
    d: p.d
  };
}

function closeWith(ws, code, reason) {
  try { ws.close(code, reason); } catch { ws.terminate(); }
}

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.playerId = null;
  ws.messageTimes = [];

  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    // Limite simples contra spam: até 30 mensagens por segundo por conexão.
    const now = Date.now();
    ws.messageTimes = ws.messageTimes.filter((time) => now - time < 1000);
    ws.messageTimes.push(now);
    if (ws.messageTimes.length > 30) {
      return closeWith(ws, 1008, 'Muitas mensagens');
    }

    let packet;
    try { packet = JSON.parse(raw.toString()); } catch { return; }
    if (!packet || typeof packet.t !== 'string') return;

    // O cliente atual envia hello ao abrir o WebSocket.
    if (packet.t === 'hello') {
      if (ws.playerId) return;
      if (players.size >= MAX_PLAYERS) {
        send(ws, 'sys', { txt: 'Servidor cheio. Limite de 10 jogadores.' });
        return closeWith(ws, 1008, 'Servidor cheio');
      }

      const data = packet.d || {};
      const name = cleanText(data.name, MAX_NAME) || 'Aventureiro';
      const cls = cleanText(data.cls, 24) || 'unknown';
      const level = Number.isFinite(Number(data.lv)) ? Math.max(1, Math.min(999, Math.floor(Number(data.lv)))) : 1;
      const id = randomUUID();
      const player = { i: id, name, cls, lv: level, x: 24, y: 25, d: 2, lastPos: 0 };

      ws.playerId = id;
      players.set(id, player);

      const others = [...players.values()].filter((p) => p.i !== id).map(publicPlayer);
      send(ws, 'welcome', {
        name: player.name,
        server: 'Tales of Fantasy',
        online: players.size,
        players: others
      });
      broadcast('join', publicPlayer(player), ws);
      console.log(`[ENTROU] ${name} (${players.size}/${MAX_PLAYERS})`);
      return;
    }

    // Nenhuma outra mensagem é aceita antes do hello.
    if (!ws.playerId) return;
    const player = players.get(ws.playerId);
    if (!player) return;

    if (packet.t === 'pos') {
      const d = packet.d || {};
      const x = Number(d.x);
      const y = Number(d.y);
      const dir = Number(d.d);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(dir)) return;
      // Faixa ampla de segurança; os limites exatos do mapa serão ajustados depois.
      if (x < -100 || x > 150 || y < -100 || y > 150) return;
      if (Date.now() - player.lastPos < 50) return;
      player.lastPos = Date.now();
      player.x = x;
      player.y = y;
      player.d = Math.max(0, Math.min(7, Math.round(dir)));

      // O cliente existente espera uma LISTA de posições no evento pos.
      const snapshot = [...players.values()]
        .filter((p) => p.i !== player.i)
        .map((p) => ({ i: p.i, x: p.x, y: p.y, d: p.d }));
      send(ws, 'pos', snapshot);
      broadcast('pos', [{ i: player.i, x: player.x, y: player.y, d: player.d }], ws);
      return;
    }

    if (packet.t === 'chat') {
      const d = packet.d || {};
      const txt = cleanText(d.txt, MAX_CHAT);
      if (!txt) return;
      const ch = cleanText(d.ch, 12) || 'global';
      broadcast('chat', { ch, who: player.name, txt });
      return;
    }

    // 'attack' ainda não altera monstros/vida: o combate autoritativo será uma etapa posterior.
  });

  ws.on('close', () => {
    if (!ws.playerId) return;
    const player = players.get(ws.playerId);
    players.delete(ws.playerId);
    if (player) {
      broadcast('leave', { i: player.i });
      console.log(`[SAIU] ${player.name} (${players.size}/${MAX_PLAYERS})`);
    }
  });

  ws.on('error', (err) => console.error('[WEBSOCKET]', err.message));
});

// Verifica conexões periodicamente e remove clientes que caíram sem fechar corretamente.
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Tales of Fantasy online na porta ${PORT} (máximo ${MAX_PLAYERS} jogadores)`);
});

function shutdown() {
  clearInterval(heartbeat);
  for (const ws of wss.clients) ws.close(1001, 'Servidor reiniciando');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

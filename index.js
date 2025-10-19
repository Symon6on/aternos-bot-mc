const express = require('express');
const mineflayer = require('mineflayer');

const MC_HOST = process.env.MC_HOST;           // es. iporchiddi.aternos.me
const MC_PORT = Number(process.env.MC_PORT);   // es. 63307
const MC_USER = process.env.MC_USER || 'MandarinoAFKBot';
const MC_VERSION = process.env.MC_VERSION || '1.21.1'; // forziamo 1.21.1 (ViaVersion traduce a 1.21.8)
const HTTP_PORT = process.env.PORT || 3000;

if (!MC_HOST || !MC_PORT) {
  console.error('⚠️ Config mancante: imposta MC_HOST e MC_PORT nelle variabili ambiente.');
  process.exit(1);
}

// Web server per healthcheck/keep-alive
const app = express();
app.get('/', (req, res) => {
  res.send(`<h1>🤖 Bot Aternos attivo</h1>
  <p>Server: ${MC_HOST}:${MC_PORT}</p>
  <p>Uptime: ${Math.floor(process.uptime())}s</p>`);
});
app.listen(HTTP_PORT, () => console.log(`🌐 Web server attivo sulla porta ${HTTP_PORT}`));

let bot, reconnectT = null, afkInterval = null;

function startBot() {
  console.log('────────────────────────────────────');
  console.log(`🔄 Connessione a ${MC_HOST}:${MC_PORT} come ${MC_USER}...`);
  console.log('────────────────────────────────────');

  bot = mineflayer.createBot({
    host: MC_HOST,
    port: MC_PORT,
    username: MC_USER,
    auth: 'offline',             // server craccato
    version: MC_VERSION,         // forza client 1.21.1
    checkTimeoutInterval: 60000,
    connectTimeout: 30000
  });

  bot.once('login', () => console.log('✅ Login riuscito'));

  bot.on('spawn', () => {
    console.log('✨ Spawn eseguito - Anti-AFK ON');
    try { setTimeout(() => bot.chat('🤖 Bot attivo: manterrò il server online.'), 2000); } catch {}
    startAntiAfk();
  });

  bot.on('messagestr', (m) => console.log('[SERVER]', m));

  // Mostra eventuale motivo inviato dal server
  bot._client?.on('disconnect', (packet) => {
    try { console.log('📤 Disconnect packet:', JSON.stringify(packet)); }
    catch { console.log('📤 Disconnect packet ricevuto'); }
  });

  bot.on('kicked', (reason) => {
    console.log('❌ Kickato:', reason);
    scheduleReconnect(15000);
  });

  bot.on('error', (err) => {
    const msg = String(err?.message || err);
    console.log('⚠️ Errore:', msg);
    if (msg.includes('ENOTFOUND')) console.log('🔎 Host errato o server offline.');
    if (msg.includes('ECONNREFUSED')) console.log('🚫 Connessione rifiutata (server offline?).');
    if (msg.includes('ETIMEDOUT')) console.log('⏱️ Timeout (server ancora in avvio?).');
    if (msg.includes('ECONNRESET')) console.log('♻️ Connessione resettata dal server, ritento...');
    try { bot.end(); } catch {}
    scheduleReconnect(10000);
  });

  bot.on('end', (reason) => {
    console.log('🔌 Disconnesso:', reason || 'motivo sconosciuto');
    scheduleReconnect(10000);
  });
}

function startAntiAfk() {
  if (afkInterval) clearInterval(afkInterval);
  let i = 0;
  afkInterval = setInterval(() => {
    if (!bot || !bot.entity) return;
    try {
      switch (i % 4) {
        case 0: bot.setControlState('jump', true);
                setTimeout(() => bot.setControlState('jump', false), 400); break;
        case 1: bot.look(bot.entity.yaw + Math.PI / 4, 0, true); break;
        case 2: bot.setControlState('sneak', true);
                setTimeout(() => bot.setControlState('sneak', false), 800); break;
        case 3: bot.setControlState('forward', true);
                setTimeout(() => bot.setControlState('forward', false), 350); break;
      }
      i++;
    } catch (e) { console.log('⚠️ Anti-AFK error:', e.message); }
  }, 40000);
}

function scheduleReconnect(ms) {
  if (reconnectT) clearTimeout(reconnectT);
  if (afkInterval) { clearInterval(afkInterval); afkInterval = null; }
  console.log(`⏳ Riconnessione tra ${Math.floor(ms / 1000)}s...`);
  reconnectT = setTimeout(() => startBot(), ms);
}

startBot();

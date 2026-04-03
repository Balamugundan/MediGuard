// MediGuard Service Worker — background alarm engine
const CACHE = 'mediguard-v1';
const ASSETS = ['./index.html','./style.css','./app.js','./manifest.json'];

// ── Install & Cache ──────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch (offline support) ───────────────────────────────────
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});

// ── Background Alarm Check ───────────────────────────────────
// SW checks every minute using periodic sync or setInterval workaround
let alarmInterval = null;

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'START_ALARM_CHECK') {
    if (alarmInterval) clearInterval(alarmInterval);
    alarmInterval = setInterval(checkAlarms, 30000);
    checkAlarms(); // immediate check
  }
  if (e.data && e.data.type === 'STOP_ALARM_CHECK') {
    clearInterval(alarmInterval);
  }
  if (e.data && e.data.type === 'UPDATE_MEDICINES') {
    // Store medicines data in SW for background checking
    medicines_data = e.data.medicines || [];
    contacts_data  = e.data.contacts  || {};
    fired_keys     = new Set(e.data.firedKeys || []);
  }
});

let medicines_data = [];
let contacts_data  = {};
let fired_keys     = new Set();

async function checkAlarms() {
  if (!medicines_data.length) return;

  const now      = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const hh       = now.getHours().toString().padStart(2,'0');
  const mm       = now.getMinutes().toString().padStart(2,'0');
  const nowTime  = `${hh}:${mm}`;
  const todayDay = now.getDay();

  for (const m of medicines_data) {
    if (!m.active) continue;
    if (m.startDate > todayStr) continue;
    if (m.endDate && m.endDate < todayStr) continue;
    if (!m.days.includes(todayDay)) continue;

    for (const t of m.times) {
      const key = `${m.id}_${todayStr}_${t}`;
      if (fired_keys.has(key)) continue;
      if (t === nowTime) {
        fired_keys.add(key);
        await showAlarmNotification(m, t, key);
        // Wake up clients
        const clients = await self.clients.matchAll({ type: 'window' });
        clients.forEach(c => c.postMessage({ type: 'TRIGGER_REMINDER', medId: m.id, time: t, key }));
      }
    }
  }
}

async function showAlarmNotification(med, time, key) {
  const [h, mn] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const disp = `${h > 12 ? h - 12 : h || 12}:${String(mn).padStart(2,'0')} ${ampm}`;

  const opts = {
    body: `Time to take ${med.name} – ${disp}\nDosage: ${med.dosage || '—'}`,
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><text y="52" font-size="52">💊</text></svg>',
    badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><text y="26" font-size="26">💊</text></svg>',
    tag: key,
    renotify: true,
    requireInteraction: true,
    silent: false,
    vibrate: [500, 100, 500, 100, 500, 100, 500, 100, 800],
    actions: [
      { action: 'take',  title: '✅ Taking Now — Auto Record' },
      { action: 'skip',  title: '❌ Skip — Alert Sent' }
    ],
    data: { medId: med.id, time, key, medName: med.name }
  };

  try {
    await self.registration.showNotification(`⏰ MediGuard — Medicine Reminder`, opts);
  } catch(e) {
    console.log('Notification error:', e);
  }
}

// ── Notification Click ────────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const { action } = e;
  const data = e.notification.data || {};

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
      // Focus existing tab or open new one
      let client = clients.find(c => c.url.includes('index.html') || c.url.endsWith('/'));
      if (!client && clients.length > 0) client = clients[0];

      if (client) {
        await client.focus();
        client.postMessage({
          type: action === 'take' ? 'OPEN_CAMERA' : 'DISMISS_REMINDER',
          medId: data.medId, time: data.time, key: data.key, medName: data.medName
        });
      } else {
        const w = await self.clients.openWindow('./index.html');
        // slight delay for page to load
        setTimeout(() => {
          w && w.postMessage({
            type: action === 'take' ? 'OPEN_CAMERA' : 'DISMISS_REMINDER',
            medId: data.medId, time: data.time, key: data.key, medName: data.medName
          });
        }, 2000);
      }
    })
  );
});

// ── Push (future backend integration hook) ───────────────────
self.addEventListener('push', e => {
  if (!e.data) return;
  const d = e.data.json();
  e.waitUntil(
    self.registration.showNotification(d.title || '⏰ MediGuard', {
      body: d.body, icon: d.icon, tag: d.tag || 'mediguard', requireInteraction: true,
      vibrate: [300, 100, 300]
    })
  );
});

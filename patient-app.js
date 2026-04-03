// ═══════════════════════════════════════════════════════
//  MediGuard — patient-app.js
//  Patient device: receive reminders, confirm/skip doses,
//  trigger WhatsApp video call to guardian
// ═══════════════════════════════════════════════════════

// ── Shared localStorage keys (same as guardian) ───────
const KEY_MEDS     = 'mg_medicines';
const KEY_CONTACTS = 'mg_contacts';
const KEY_HISTORY  = 'mg_history';
const KEY_GUARDIAN = 'mg_guardian';

let medicines = [];
let contacts  = {};
let history   = [];

let reminderTimer     = null;
let reminderCountdown = 60;
let currentReminder   = null;
let audioCtx          = null;
let alarmNodes        = [];
let alarmLoop         = null;
let _alarmScheduled   = false;
let firedKeys         = new Set(JSON.parse(sessionStorage.getItem('mg_fired_pt') || '[]'));
let voiceSynth        = window.speechSynthesis || null;

// ── SW Registration ───────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(reg => {
    document.getElementById('swPatientStatus').textContent = '● Active — background alarms on';
    pushDataToSW();
  }).catch(() => {
    document.getElementById('swPatientStatus').textContent = '⚠️ Background alarm off';
  });

  navigator.serviceWorker.addEventListener('message', e => {
    const { type, medId, time, key, medName } = e.data || {};
    if (type === 'TRIGGER_REMINDER') {
      const med = medicines.find(m => m.id === medId);
      if (med) triggerReminder(med, time, key);
    }
    if (type === 'OPEN_CAMERA') {
      const med = medicines.find(m => m.id === medId);
      if (med) { currentReminder = { med, time, key }; patientTakingNow(); }
    }
    if (type === 'DISMISS_REMINDER') {
      if (!currentReminder) currentReminder = { med: { name: medName, id: medId }, time, key };
      dismissReminder('skip');
    }
  });
}

function pushDataToSW() {
  if (!navigator.serviceWorker.controller) return;
  navigator.serviceWorker.controller.postMessage({
    type: 'UPDATE_MEDICINES', medicines, contacts, firedKeys: [...firedKeys]
  });
  navigator.serviceWorker.controller.postMessage({ type: 'START_ALARM_CHECK' });
}

// ── Request notification permission ──────────────────
async function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') {
    const r = await Notification.requestPermission();
    if (r === 'granted') showToast('✅ Notifications enabled', 'success');
  }
}

// ── Clock ─────────────────────────────────────────────
function updateClock() {
  document.getElementById('clockDisplay').textContent =
    new Date().toLocaleTimeString('en-IN', { hour12: true });
}
setInterval(updateClock, 1000);
updateClock();

// ── Init ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadFromStorage();
  requestNotificationPermission();
  refreshPatientUI();
  startReminderChecker();
  if (voiceSynth) voiceSynth.getVoices();
  // Reload from storage every 10s in case guardian adds new medicines
  setInterval(() => { loadFromStorage(); refreshPatientUI(); }, 10000);
});

function loadFromStorage() {
  medicines = JSON.parse(localStorage.getItem(KEY_MEDS)     || '[]');
  contacts  = JSON.parse(localStorage.getItem(KEY_CONTACTS) || 'null') || {};
  history   = JSON.parse(localStorage.getItem(KEY_HISTORY)  || '[]');
}

// ── Patient UI ─────────────────────────────────────────
function refreshPatientUI() {
  const name = contacts.patientName || 'Patient';
  document.getElementById('patientHeroName').textContent = `Hi, ${name} 👋`;

  const now      = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const todayDay = now.getDay();
  const nowTime  = now.toTimeString().slice(0,5);
  const doses    = [];

  medicines.forEach(m => {
    if (!m.active || m.startDate > todayStr) return;
    if (m.endDate && m.endDate < todayStr) return;
    if (!m.days.includes(todayDay)) return;
    m.times.forEach(t => doses.push({ med:m, time:t, key:`${m.id}_${todayStr}_${t}` }));
  });
  doses.sort((a,b) => a.time.localeCompare(b.time));

  const takenK  = history.filter(h=>h.date===todayStr&&['taken','called','recorded'].includes(h.status)).map(h=>h.key);
  const missedK = history.filter(h=>h.date===todayStr&&['missed','skipped'].includes(h.status)).map(h=>h.key);
  const taken   = doses.filter(d=>takenK.includes(d.key)).length;
  const missed  = doses.filter(d=>missedK.includes(d.key)).length;
  const pending = Math.max(0, doses.length - taken - missed);

  document.getElementById('ptStatTaken').textContent   = taken;
  document.getElementById('ptStatPending').textContent = pending;
  document.getElementById('ptStatMissed').textContent  = missed;
  document.getElementById('ptTodayBadge').textContent  = `${doses.length} doses`;

  // Next dose
  const ndSection = document.getElementById('nextDoseSection');
  const upcoming  = doses.filter(d => d.time >= nowTime && !takenK.includes(d.key) && !missedK.includes(d.key));
  if (upcoming.length) {
    const nx = upcoming[0];
    ndSection.innerHTML = `<div class="next-dose-card">
      <div class="nd-label">⏰ Next medicine</div>
      <div class="nd-name">${nx.med.name}</div>
      <div class="nd-time">${fmt12(nx.time)}</div>
      <div class="nd-dosage">${nx.med.dosage||''}</div>
      ${nx.med.instructions?`<div class="nd-instr">📌 ${nx.med.instructions}</div>`:''}
    </div>`;
  } else if (doses.length > 0) {
    ndSection.innerHTML = `<div class="next-dose-card"><div class="nd-done">✅ All done for today!</div></div>`;
  } else {
    ndSection.innerHTML = '';
  }

  // Today list
  const todayList = document.getElementById('ptTodayList');
  const noMeds    = document.getElementById('noMedsNotice');
  if (!medicines.length) {
    todayList.innerHTML = '';
    noMeds.style.display = 'block';
    return;
  }
  noMeds.style.display = 'none';
  if (!doses.length) {
    todayList.innerHTML = '<div class="empty-state">No medicines scheduled for today</div>';
    return;
  }
  todayList.innerHTML = doses.map(d => {
    let sc='status-pending', sl='Pending';
    if (takenK.includes(d.key))  { sc='status-taken';  sl='✅ Taken'; }
    if (missedK.includes(d.key)) { sc='status-missed'; sl='⚠️ Missed'; }
    return `<div class="today-item">
      <div class="today-item-img">${d.med.image?`<img src="${d.med.image}" alt=""/>`:'💊'}</div>
      <div class="today-item-info">
        <div class="today-item-name">${d.med.name}</div>
        <div class="today-item-time">⏰ ${fmt12(d.time)} · ${d.med.dosage||'—'}</div>
      </div>
      <span class="today-item-status ${sc}">${sl}</span>
    </div>`;
  }).join('');
}

// ── Reminder Checker (runs every 30s) ─────────────────
function startReminderChecker() {
  checkMedicines();
  setInterval(checkMedicines, 30000);
}

function checkMedicines() {
  loadFromStorage(); // always re-read — guardian may have changed schedule
  const now      = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const hh       = now.getHours().toString().padStart(2,'0');
  const mm       = now.getMinutes().toString().padStart(2,'0');
  const nowTime  = `${hh}:${mm}`;
  const todayDay = now.getDay();

  for (const m of medicines) {
    if (!m.active) continue;
    if (m.startDate > todayStr) continue;
    if (m.endDate && m.endDate < todayStr) continue;
    if (!m.days.includes(todayDay)) continue;
    for (const t of m.times) {
      const key = `${m.id}_${todayStr}_${t}`;
      if (firedKeys.has(key)) continue;
      const done = history.some(h => h.key === key && ['taken','missed','skipped','called','recorded'].includes(h.status));
      if (done) { firedKeys.add(key); continue; }
      if (t === nowTime) {
        firedKeys.add(key);
        sessionStorage.setItem('mg_fired_pt', JSON.stringify([...firedKeys]));
        triggerReminder(m, t, key);
        return;
      }
    }
  }
}

// ── Reminder Modal ─────────────────────────────────────
function triggerReminder(med, time, key) {
  if (document.getElementById('reminderModal').classList.contains('show')) return;
  currentReminder = { med, time, key };
  playAlarm();
  speakReminder(med, time);

  const imgDiv = document.getElementById('reminderMedImage');
  imgDiv.innerHTML = med.image ? `<img src="${med.image}" alt="${med.name}"/>` : '💊';
  document.getElementById('reminderMedDetails').innerHTML = `
    <div class="med-name">${med.name}</div>
    <div class="med-dosage">${med.dosage||''}</div>
    <div class="med-time">${fmt12(time)}</div>`;
  document.getElementById('reminderInstructions').textContent = med.instructions||'';

  const gcInfo = document.getElementById('guardianCallInfo');
  if (gcInfo) {
    gcInfo.textContent = contacts.guardianName
      ? `📹 Taking Now → WhatsApp video call to ${contacts.guardianName}`
      : '✅ Taking Now → Confirm taken';
  }

  document.getElementById('reminderModal').classList.add('show');
  reminderCountdown = 60;
  document.getElementById('reminderTimerCount').textContent = 60;
  clearInterval(reminderTimer);
  reminderTimer = setInterval(() => {
    reminderCountdown--;
    document.getElementById('reminderTimerCount').textContent = reminderCountdown;
    if (reminderCountdown === 40 || reminderCountdown === 20) speakReminder(med, time);
    if (reminderCountdown <= 0) { clearInterval(reminderTimer); dismissReminder('no_response'); }
  }, 1000);
}

// ── "Taking Now" ──────────────────────────────────────
// Patient confirms → mark taken + WhatsApp video call to guardian
function patientTakingNow() {
  clearInterval(reminderTimer);
  stopAlarm();
  stopVoice();
  document.getElementById('reminderModal').classList.remove('show');

  const { med, time, key } = currentReminder || {};
  if (!med) return;
  const today = new Date().toISOString().split('T')[0];

  if (contacts.guardianPhone) {
    // Mark as TAKEN and immediately call guardian
    addHistory(key, med.name, today, time, 'taken', '✅ Confirmed + WhatsApp video call initiated to guardian');
    showToast('✅ Marked taken! 📹 Calling guardian on WhatsApp…', 'success');
    openWhatsAppVideoCall(contacts.guardianPhone);
  } else {
    addHistory(key, med.name, today, time, 'taken', 'Self-confirmed — no guardian number saved');
    showToast('✅ Medicine marked as taken!', 'success');
  }

  currentReminder = null;
  refreshPatientUI();
  pushDataToSW();
}

// ── Skip / No-response ────────────────────────────────
function dismissReminder(reason) {
  clearInterval(reminderTimer);
  stopAlarm();
  stopVoice();
  document.getElementById('reminderModal').classList.remove('show');
  if (!currentReminder) return;
  const { med, time, key } = currentReminder;
  const today = new Date().toISOString().split('T')[0];

  if (reason === 'skip') {
    addHistory(key, med.name, today, time, 'skipped', 'Patient chose to skip');
    autoAlertBoth(med, time, 'SKIPPED',
      `⚠️ ${contacts.patientName||'Patient'} SKIPPED ${med.name} at ${fmt12(time)}. Please check on the patient.`);
    showToast('🚨 Skip alert sent to guardian & doctor!','warning');
  } else if (reason === 'no_response') {
    addHistory(key, med.name, today, time, 'missed', 'No response to 60s reminder');
    autoAlertBoth(med, time, 'NO RESPONSE — MISSED',
      `🚨 ${contacts.patientName||'Patient'} did NOT respond to the ${med.name} reminder at ${fmt12(time)}. Immediate attention required!`);
    showToast('🚨 No response — alert sent!','error');
  }
  currentReminder = null;
  refreshPatientUI();
  pushDataToSW();
}

// ── Auto alert both guardian + doctor ────────────────
function autoAlertBoth(med, time, type, bodyMsg) {
  const patient = contacts.patientName || 'Patient';
  const date    = new Date().toLocaleDateString('en-IN');
  const guardianMsg =
`🚨 *MEDIGUARD ALERT — ${type}*
👤 *Patient:* ${patient}
💊 *Medicine:* ${med.name}
⏰ *Scheduled:* ${fmt12(time)}
📅 *Date:* ${date}

${bodyMsg}

⚕️ _Please check on the patient immediately._
— MediGuard`;

  const doctorMsg =
`🚨 *MEDIGUARD MEDICAL ALERT — ${type}*
👤 *Patient:* ${patient}
💊 *Medicine:* ${med.name}
⏰ *Scheduled:* ${fmt12(time)}
📅 *Date:* ${date}

${bodyMsg}

⚕️ _Automated alert. Please follow up._
— MediGuard`;

  if (contacts.guardianPhone) setTimeout(() => openWhatsAppMsg(contacts.guardianPhone, guardianMsg), 100);
  if (contacts.doctorPhone)   setTimeout(() => openWhatsAppMsg(contacts.doctorPhone,   doctorMsg),   900);
}

// ── WhatsApp ──────────────────────────────────────────
function openWhatsAppVideoCall(phone) {
  const cleaned = phone.replace(/[^\d+]/g,'');
  window.open(`https://wa.me/${cleaned}?action=call`, '_blank');
}
function openWhatsAppMsg(phone, msg) {
  const cleaned = phone.replace(/[^\d+]/g,'');
  window.open(`https://wa.me/${cleaned}?text=${encodeURIComponent(msg)}`, '_blank');
}

// ── History helpers ───────────────────────────────────
function addHistory(key, medName, date, time, status, note) {
  history = history.filter(h => h.key !== key || h.status === 'recorded');
  history.push({ key, medName, date, time, status, note });
  saveHistoryToStorage();
}
function saveHistoryToStorage() {
  localStorage.setItem(KEY_HISTORY, JSON.stringify(history));
}

// ── Loud alarm (Web Audio) ────────────────────────────
function playAlarm() {
  stopAlarm();
  _initAudioCtx();
  if (!audioCtx) return;
  _alarmScheduled = true;
  _scheduleAlarmBurst();
}

function stopAlarm() {
  _alarmScheduled = false;
  clearTimeout(alarmLoop); alarmLoop = null;
  alarmNodes.forEach(n => { try { n.stop(); n.disconnect(); } catch(e){} });
  alarmNodes = [];
}

function _initAudioCtx() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){ return; }
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function _scheduleAlarmBurst() {
  if (!_alarmScheduled) return;
  if (!audioCtx || audioCtx.state === 'closed') _initAudioCtx();
  const now   = audioCtx.currentTime;
  const beeps = [
    { freq:1046, t:0.00, dur:0.14 },
    { freq:1318, t:0.18, dur:0.14 },
    { freq:1568, t:0.36, dur:0.14 },
    { freq:1318, t:0.54, dur:0.14 },
    { freq:1046, t:0.72, dur:0.14 },
    { freq: 784, t:0.90, dur:0.22 },
  ];
  beeps.forEach(({ freq, t, dur }) => {
    try {
      const osc  = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const comp = audioCtx.createDynamicsCompressor();
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.001, now + t);
      gain.gain.linearRampToValueAtTime(1.0, now + t + 0.01);
      gain.gain.setValueAtTime(1.0, now + t + dur - 0.02);
      gain.gain.linearRampToValueAtTime(0.001, now + t + dur);
      comp.threshold.value = -24; comp.knee.value = 4;
      comp.ratio.value = 20; comp.attack.value = 0.001; comp.release.value = 0.1;
      osc.connect(gain); gain.connect(comp); comp.connect(audioCtx.destination);
      osc.start(now + t); osc.stop(now + t + dur + 0.05);
      alarmNodes.push(osc);
    } catch(e){}
  });
  alarmLoop = setTimeout(() => { if (_alarmScheduled) _scheduleAlarmBurst(); }, 1800);
}

// ── Voice assistant ───────────────────────────────────
function speakReminder(med, time) {
  if (!voiceSynth) return;
  stopVoice();
  const name = contacts.patientName || 'Patient';
  const callTo = contacts.guardianName
    ? `Press Taking Now to start a video call with ${contacts.guardianName}.`
    : 'Press Taking Now to confirm.';
  const text =
    `Attention ${name}! Medicine reminder. Time to take ${med.name}. ` +
    `${med.dosage ? 'Dosage: ' + med.dosage + '. ' : ''}` +
    `${med.instructions ? med.instructions + '. ' : ''}` + callTo;
  const utter    = new SpeechSynthesisUtterance(text);
  utter.lang     = 'en-IN';
  utter.rate     = 0.88;
  utter.pitch    = 1.05;
  utter.volume   = 1.0;
  const voices   = voiceSynth.getVoices();
  const preferred = voices.find(v=>v.lang==='en-IN') || voices.find(v=>v.lang.startsWith('en')) || voices[0];
  if (preferred) utter.voice = preferred;
  voiceSynth.speak(utter);
}

function stopVoice() {
  if (voiceSynth) voiceSynth.cancel();
}

// ── Helpers ───────────────────────────────────────────
function fmt12(t) {
  if (!t) return '--';
  const [h,m] = t.split(':').map(Number);
  return `${h>12?h-12:h||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;
}

function showToast(msg, type='info') {
  const icons = {success:'✅',error:'❌',warning:'⚠️',info:'ℹ️'};
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
  document.getElementById('toastContainer').appendChild(t);
  setTimeout(()=>{
    t.style.opacity='0'; t.style.transform='translateX(40px)';
    t.style.transition='all .3s'; setTimeout(()=>t.remove(),350);
  }, 4000);
}

function showAlert(icon,title,msg) {
  document.getElementById('alertIcon').textContent    = icon;
  document.getElementById('alertTitle').textContent   = title;
  document.getElementById('alertMessage').textContent = msg;
  document.getElementById('alertModal').classList.add('show');
}
function closeAlert() { document.getElementById('alertModal').classList.remove('show'); }

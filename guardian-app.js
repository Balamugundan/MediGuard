// ═══════════════════════════════════════════════════════
//  MediGuard — guardian-app.js
//  Guardian device: add medicines, view patient status,
//  receive alerts, manage contacts & history
// ═══════════════════════════════════════════════════════

// ── Shared localStorage keys (same as patient) ────────
const KEY_MEDS     = 'mg_medicines';
const KEY_CONTACTS = 'mg_contacts';
const KEY_HISTORY  = 'mg_history';
const KEY_GUARDIAN = 'mg_guardian';

let medicines = JSON.parse(localStorage.getItem(KEY_MEDS)     || '[]');
let contacts  = JSON.parse(localStorage.getItem(KEY_CONTACTS) || 'null') || {};
let history   = JSON.parse(localStorage.getItem(KEY_HISTORY)  || '[]');
let guardianMonitorOn = JSON.parse(localStorage.getItem(KEY_GUARDIAN) || 'true');

// ── Clock ─────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  document.getElementById('clockDisplay').textContent =
    now.toLocaleTimeString('en-IN', { hour12: true });
  document.getElementById('dateDisplay').textContent =
    now.toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short' });
}
setInterval(updateClock, 1000);
updateClock();

// ── Init ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('startDate').value = new Date().toISOString().split('T')[0];
  document.querySelectorAll('.day-btn').forEach(b =>
    b.addEventListener('click', () => b.classList.toggle('active'))
  );
  if (contacts.patientName)
    document.getElementById('patientNameDisplay').textContent = contacts.patientName;
  refreshDashboard();
  loadContacts();
  syncFrequencyToTimes();

  // Guardian always enables monitoring
  localStorage.setItem(KEY_GUARDIAN, 'true');

  // Poll for patient history changes (patient device writes to localStorage)
  setInterval(pollPatientUpdates, 5000);
});

// ── Poll patient updates ──────────────────────────────
// Guardian device refreshes every 5 seconds to catch patient actions
function pollPatientUpdates() {
  const freshHistory = JSON.parse(localStorage.getItem(KEY_HISTORY) || '[]');
  if (JSON.stringify(freshHistory) !== JSON.stringify(history)) {
    history = freshHistory;
    refreshDashboard();
    checkForMissedDoses(freshHistory);
  }
}

function checkForMissedDoses(hist) {
  const today = new Date().toISOString().split('T')[0];
  const missedToday = hist.filter(h => h.date === today && ['missed','skipped'].includes(h.status));
  const banner = document.getElementById('missedBanner');
  if (missedToday.length > 0) {
    const last = missedToday[missedToday.length - 1];
    document.getElementById('missedBannerText').textContent =
      `⚠️ Patient ${last.status === 'skipped' ? 'SKIPPED' : 'MISSED'} ${last.medName} at ${fmt12(last.time)}`;
    banner.classList.add('show');
  } else {
    banner.classList.remove('show');
  }
}

// ── Navigation ────────────────────────────────────────
function showPage(id, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  if (el) el.classList.add('active');
  const titles = {
    dashboard:'Dashboard','add-medicine':'Add Medicine',
    schedule:'Schedule',contacts:'Contacts',history:'History'
  };
  document.getElementById('pageTitle').textContent = titles[id] || id;
  if (window.innerWidth < 768) document.getElementById('sidebar').classList.remove('open');
  if (id === 'dashboard') refreshDashboard();
  if (id === 'schedule')  renderSchedule();
  if (id === 'contacts')  loadContacts();
  if (id === 'history')   renderHistory();
}

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const mc = document.querySelector('.main-content');
  if (window.innerWidth < 768) sb.classList.toggle('open');
  else { sb.classList.toggle('collapsed'); mc.classList.toggle('expanded'); }
}

// ── Frequency sync ────────────────────────────────────
const FREQ_DEFAULTS = {
  '1':['08:00'],'2':['08:00','20:00'],
  '3':['08:00','14:00','21:00'],'4':['07:00','12:00','17:00','22:00'],'custom':null
};
const FREQ_LABELS = {
  '1':'1 reminder/day','2':'2 reminders/day','3':'3 reminders/day',
  '4':'4 reminders/day','custom':'Custom'
};

function syncFrequencyToTimes() {
  const freq = document.getElementById('medFrequency').value;
  const bannerText = document.getElementById('freqInfoText');
  if (bannerText) bannerText.textContent = FREQ_LABELS[freq] || '';
  if (freq === 'custom') return;
  const times = FREQ_DEFAULTS[freq]; if (!times) return;
  document.getElementById('timeInputs').innerHTML = times.map(t => `
    <div class="time-input-row">
      <input type="time" class="time-input input-field" value="${t}"/>
      <button class="btn-icon" onclick="removeTimeInput(this)">✕</button>
    </div>`).join('');
}

function addTimeInput() {
  const d = document.createElement('div'); d.className = 'time-input-row';
  d.innerHTML = `<input type="time" class="time-input input-field" value="12:00"/>
                 <button class="btn-icon" onclick="removeTimeInput(this)">✕</button>`;
  document.getElementById('timeInputs').appendChild(d);
  document.getElementById('medFrequency').value = 'custom';
  document.getElementById('freqInfoText').textContent = FREQ_LABELS['custom'];
}

function removeTimeInput(btn) {
  if (document.querySelectorAll('.time-input-row').length <= 1) {
    showToast('At least one time required','warning'); return;
  }
  btn.closest('.time-input-row').remove();
}

// ── Image ──────────────────────────────────────────────
function previewImage(e) {
  const file = e.target.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = ev => {
    document.getElementById('imagePreview').src = ev.target.result;
    document.getElementById('imagePreview').classList.remove('hidden');
    document.getElementById('uploadPlaceholder').classList.add('hidden');
    document.getElementById('removeImgBtn').classList.remove('hidden');
  };
  r.readAsDataURL(file);
}
function removeImage() {
  document.getElementById('medImage').value = '';
  document.getElementById('imagePreview').src = '';
  document.getElementById('imagePreview').classList.add('hidden');
  document.getElementById('uploadPlaceholder').classList.remove('hidden');
  document.getElementById('removeImgBtn').classList.add('hidden');
}

// ── Save Medicine ─────────────────────────────────────
// Guardian saves medicine → patient device auto-picks up via localStorage
function saveMedicine() {
  const name  = document.getElementById('medName').value.trim();
  const dosage= document.getElementById('medDosage').value.trim();
  const freq  = document.getElementById('medFrequency').value;
  const instr = document.getElementById('medInstructions').value.trim();
  const start = document.getElementById('startDate').value;
  const end   = document.getElementById('endDate').value;
  const img   = document.getElementById('imagePreview').src;
  if (!name)  { showToast('Please enter medicine name','error'); return; }
  if (!start) { showToast('Please select a start date','error'); return; }
  const times = Array.from(document.querySelectorAll('.time-input')).map(i=>i.value).filter(Boolean);
  if (!times.length) { showToast('Add at least one reminder time','error'); return; }
  const days = Array.from(document.querySelectorAll('.day-btn.active')).map(b=>parseInt(b.dataset.day));
  if (!days.length) { showToast('Select at least one day','error'); return; }
  medicines.push({
    id: Date.now().toString(), name, dosage, frequency: freq,
    instructions: instr, startDate: start, endDate: end, times, days,
    image: img && img.length > 50 && !img.endsWith('guardian.html') ? img : null, active: true
  });
  saveData();
  showToast(`✅ ${name} saved! Patient device will receive reminder.`, 'success');
  clearForm();
  showPage('schedule', document.querySelector('[data-page="schedule"]'));
}

function clearForm() {
  ['medName','medDosage','medInstructions','endDate'].forEach(id =>
    document.getElementById(id).value = '');
  document.getElementById('medFrequency').value = '1';
  syncFrequencyToTimes(); removeImage();
  document.querySelectorAll('.day-btn').forEach(b => b.classList.add('active'));
}

// ── Schedule ──────────────────────────────────────────
function renderSchedule() {
  const list = document.getElementById('medicinesList');
  if (!medicines.length) {
    list.innerHTML = '<div class="empty-state">No medicines added yet.<br>Use "Add Medicine" to set the patient\'s schedule.</div>';
    return;
  }
  const DN = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  list.innerHTML = medicines.map(m => `
    <div class="medicine-card">
      <div class="medicine-card-img">${m.image ? `<img src="${m.image}" alt="${m.name}"/>` : '💊'}</div>
      <div class="medicine-card-info">
        <div class="medicine-card-name">${m.name}</div>
        <div class="medicine-card-times">⏰ ${m.times.join(' · ')}</div>
        <div class="medicine-card-dosage">${m.dosage||'—'} &nbsp;|&nbsp; 📅 ${m.startDate}${m.endDate?' → '+m.endDate:''}</div>
        ${m.instructions?`<div style="font-size:11px;color:var(--text3);margin-top:3px">📌 ${m.instructions}</div>`:''}
        <div class="medicine-card-days">
          ${DN.map((d,i)=>`<div class="day-dot ${m.days.includes(i)?'active':''}">${d[0]}</div>`).join('')}
        </div>
      </div>
      <div class="medicine-card-actions">
        <button class="btn-edit"   onclick='editMedicine("${m.id}")'>✏️ Edit</button>
        <button class="btn-delete" onclick='deleteMedicine("${m.id}")'>🗑️ Delete</button>
      </div>
    </div>`).join('');
}

function deleteMedicine(id) {
  if (!confirm('Delete this medicine?')) return;
  medicines = medicines.filter(m => m.id !== id);
  saveData(); renderSchedule(); refreshDashboard();
  showToast('Deleted','info');
}

function editMedicine(id) {
  const m = medicines.find(x=>x.id===id); if (!m) return;
  document.getElementById('medName').value         = m.name;
  document.getElementById('medDosage').value       = m.dosage||'';
  document.getElementById('medFrequency').value    = m.frequency;
  document.getElementById('medInstructions').value = m.instructions||'';
  document.getElementById('startDate').value       = m.startDate;
  document.getElementById('endDate').value         = m.endDate||'';
  if (m.image) {
    document.getElementById('imagePreview').src = m.image;
    document.getElementById('imagePreview').classList.remove('hidden');
    document.getElementById('uploadPlaceholder').classList.add('hidden');
    document.getElementById('removeImgBtn').classList.remove('hidden');
  }
  document.getElementById('timeInputs').innerHTML = m.times.map(t=>`
    <div class="time-input-row">
      <input type="time" class="time-input input-field" value="${t}"/>
      <button class="btn-icon" onclick="removeTimeInput(this)">✕</button>
    </div>`).join('');
  document.getElementById('freqInfoText').textContent = FREQ_LABELS[m.frequency]||'';
  document.querySelectorAll('.day-btn').forEach(b =>
    b.classList.toggle('active', m.days.includes(parseInt(b.dataset.day))));
  medicines = medicines.filter(x=>x.id!==id);
  saveData();
  showPage('add-medicine', document.querySelector('[data-page="add-medicine"]'));
}

// ── Dashboard ──────────────────────────────────────────
function refreshDashboard() {
  // Always reload from localStorage (patient may have updated history)
  medicines = JSON.parse(localStorage.getItem(KEY_MEDS)    || '[]');
  history   = JSON.parse(localStorage.getItem(KEY_HISTORY) || '[]');
  contacts  = JSON.parse(localStorage.getItem(KEY_CONTACTS)|| 'null') || {};
  if (contacts.patientName)
    document.getElementById('patientNameDisplay').textContent = contacts.patientName;

  const now      = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const todayDay = now.getDay();
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

  document.getElementById('statTaken').textContent   = taken;
  document.getElementById('statPending').textContent = Math.max(0, doses.length-taken-missed);
  document.getElementById('statMissed').textContent  = missed;
  document.getElementById('todayBadge').textContent  = `${doses.length} doses`;

  const todayList = document.getElementById('todayList');
  if (!doses.length) {
    todayList.innerHTML = '<div class="empty-state">No medicines scheduled today</div>';
  } else {
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

  const nowTime  = now.toTimeString().slice(0,5);
  const upcoming = doses.filter(d => d.time>=nowTime && !takenK.includes(d.key) && !missedK.includes(d.key));
  const nrDiv    = document.getElementById('nextReminder');
  if (upcoming.length) {
    const nx = upcoming[0];
    nrDiv.innerHTML = `<div class="next-rem-card">
      <div class="next-rem-name">💊 ${nx.med.name}</div>
      <div class="next-rem-time">${fmt12(nx.time)}</div>
      <div style="font-size:12px;color:var(--text2)">${nx.med.dosage||''}</div>
    </div>`;
  } else {
    nrDiv.innerHTML = '<div class="no-reminder">✅ All done for today!</div>';
  }

  checkForMissedDoses(history);
}

// ── Contacts ──────────────────────────────────────────
function saveContacts() {
  contacts = {
    patientName:  document.getElementById('patientName').value.trim(),
    guardianName: document.getElementById('guardianName').value.trim(),
    guardianPhone:cleanPhone(document.getElementById('guardianPhone').value),
    doctorName:   document.getElementById('doctorName').value.trim(),
    doctorPhone:  cleanPhone(document.getElementById('doctorPhone').value),
  };
  localStorage.setItem(KEY_CONTACTS, JSON.stringify(contacts));
  document.getElementById('patientNameDisplay').textContent = contacts.patientName||'Patient';
  showToast('Contacts saved! Patient device will use these.','success');
  renderContacts();
}

function cleanPhone(p) { return (p||'').replace(/[\s\-\(\)]/g,''); }

function loadContacts() {
  if (!contacts.patientName) return;
  document.getElementById('patientName').value   = contacts.patientName   ||'';
  document.getElementById('guardianName').value  = contacts.guardianName  ||'';
  document.getElementById('guardianPhone').value = contacts.guardianPhone ||'';
  document.getElementById('doctorName').value    = contacts.doctorName    ||'';
  document.getElementById('doctorPhone').value   = contacts.doctorPhone   ||'';
  renderContacts();
}

function renderContacts() {
  const div = document.getElementById('contactsDisplay');
  let html = '';
  if (contacts.guardianName) html += `
    <div class="contact-item">
      <div class="contact-avatar">👁️</div>
      <div><div class="contact-role">Guardian (You)</div>
        <div class="contact-name">${contacts.guardianName}</div>
        <div class="contact-detail">📱 ${contacts.guardianPhone||'—'}</div></div></div>`;
  if (contacts.doctorName) html += `
    <div class="contact-item">
      <div class="contact-avatar">🩺</div>
      <div><div class="contact-role">Doctor</div>
        <div class="contact-name">${contacts.doctorName}</div>
        <div class="contact-detail">📱 ${contacts.doctorPhone||'—'}</div></div></div>`;
  div.innerHTML = html || '<div class="empty-state">No contacts saved</div>';
}

function testWhatsApp() {
  if (!contacts.guardianPhone) { showToast('Save a guardian phone number first','warning'); return; }
  const msg = `👋 Hi ${contacts.guardianName||'Guardian'}! This is a MediGuard test alert for *${contacts.patientName||'Patient'}*. WhatsApp alerts are working correctly! ✅`;
  openWhatsAppMsg(contacts.guardianPhone, msg);
}

// ── History ───────────────────────────────────────────
function renderHistory() {
  history = JSON.parse(localStorage.getItem(KEY_HISTORY) || '[]');
  const div = document.getElementById('historyList');
  if (!history.length) { div.innerHTML='<div class="empty-state">No history yet</div>'; return; }
  const icons  = { taken:'✅', missed:'⚠️', skipped:'⏭️', called:'📹', recorded:'🎥' };
  const colors = { taken:'var(--green)', missed:'var(--red)', skipped:'var(--orange)', called:'var(--green)', recorded:'var(--blue)' };
  const labels = { taken:'TAKEN', missed:'MISSED', skipped:'SKIPPED', called:'TAKEN + VIDEO CALL', recorded:'RECORDED' };
  div.innerHTML = [...history].reverse().map(h => `
    <div class="history-item">
      <div class="history-icon">${icons[h.status]||'📋'}</div>
      <div class="history-info">
        <div class="history-name">${h.medName}</div>
        <div class="history-time">${h.date} at ${fmt12(h.time)}</div>
        ${h.note?`<div style="font-size:11px;color:var(--text3)">${h.note}</div>`:''}
      </div>
      <div class="history-status" style="color:${colors[h.status]||'var(--text2)'};font-size:11px;font-weight:700">${labels[h.status]||(h.status||'').toUpperCase()}</div>
    </div>`).join('');
}

function clearHistory() {
  if (!confirm('Clear all history?')) return;
  history = []; saveData(); renderHistory();
}

// ── WhatsApp ──────────────────────────────────────────
function openWhatsAppMsg(phone, msg) {
  const cleaned = phone.replace(/[^\d+]/g,'');
  window.open(`https://wa.me/${cleaned}?text=${encodeURIComponent(msg)}`, '_blank');
}

// ── Save Data (shared localStorage) ──────────────────
function saveData() {
  localStorage.setItem(KEY_MEDS,     JSON.stringify(medicines));
  localStorage.setItem(KEY_CONTACTS, JSON.stringify(contacts));
  localStorage.setItem(KEY_HISTORY,  JSON.stringify(history));
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
  t.className=`toast ${type}`;
  t.innerHTML=`<span>${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
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

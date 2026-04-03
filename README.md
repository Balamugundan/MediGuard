# 💊 MediGuard — Smart Medicine Reminder System

> A dual-device Progressive Web App (PWA) for medicine reminders with live guardian monitoring via WhatsApp video call. No server. No subscription. Just two phones and Wi-Fi.

---

## 🖼️ Preview

| Guardian Device | Patient Device |
|---|---|
| Manages schedule, monitors compliance | Receives alarms, confirms intake |
| `localhost:8080/guardian.html` | `localhost:8080/patient.html` |

---

## ✨ Features

- 🔔 **Loud alarm + voice reminder** at scheduled medicine times
- 📹 **Live WhatsApp video call** to guardian when patient confirms intake
- 🚨 **Auto WhatsApp alert** to guardian & doctor if patient skips or misses
- 👁️ **Guardian dashboard** shows real-time patient compliance status
- 📅 **Flexible scheduling** — set times, days, dosage, instructions per medicine
- 🌐 **Works offline** — Service Worker caches all assets
- 📲 **Installable PWA** — add to home screen on any phone
- 🔄 **Zero-server sync** — both devices share data via `localStorage`

---

## 📁 File Structure

```
mediguard/
├── guardian.html       # Guardian device — schedule & monitor
├── guardian-app.js     # Guardian logic — add medicines, contacts, history
├── patient.html        # Patient device — reminders & confirmations
├── patient-app.js      # Patient logic — alarm, video call, alert
├── style.css           # Shared styles (dark theme)
├── sw.js               # Service Worker — background alarms
├── manifest.json       # PWA manifest
└── README.md
```

---

## 🚀 How to Run Locally

### Step 1 — Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/mediguard.git
cd mediguard
```

### Step 2 — Start a local server

**Option A — Python (recommended)**
```bash
python3 -m http.server 8080
```

**Option B — Node.js**
```bash
npx serve .
```

**Option C — VS Code**
Install "Live Server" extension → right-click `guardian.html` → Open with Live Server

### Step 3 — Open both devices

| Device | URL |
|---|---|
| Guardian (PC / tablet) | http://localhost:8080/guardian.html |
| Patient (phone) | http://localhost:8080/patient.html |

> ⚠️ Both devices must be on the **same Wi-Fi network** and open the same `localhost:8080` URL for data sharing to work.

---

## 📱 How It Works

```
Guardian adds medicine schedule
        ↓
  Saved to localStorage
        ↓
Patient device reads schedule (every 10s)
        ↓
At reminder time → Loud alarm + Voice reminder
        ↓
    Patient presses "Taking Now"
    ↙                         ↘
WhatsApp VIDEO CALL         Status = TAKEN
to Guardian                 Dashboard updates
(Guardian watches live)

    Patient presses "Skip" or ignores 60s
        ↓
WhatsApp TEXT ALERT → Guardian + Doctor
Status = MISSED / SKIPPED
```

---

## 🛠️ Hardware & Software Requirements

### Hardware
- 2 × Smartphone or tablet (any OS)
- Same Wi-Fi network
- WhatsApp installed on both devices

### Software
- Modern browser (Chrome recommended for full PWA + notifications)
- Python 3 or Node.js (to run local server)
- No backend, no database, no cloud

---

## ⚔️ Challenges & Solutions

| Challenge | Solution |
|---|---|
| **Time delay** (SW checks every 30s) | In-page checker runs in parallel, max 30s drift acceptable for medicine reminders |
| **Fake tablet taken** | "Taking Now" immediately opens a live WhatsApp video call — guardian watches patient swallow tablet in real time |
| **Two-device sync without server** | Both pages share `localStorage` on same `localhost:8080` origin — guardian writes, patient reads every 10s |
| **Background alarms** | Service Worker fires OS push notifications even when browser tab is closed |
| **No internet needed** | All app logic is offline-first; only WhatsApp calls need internet |

---

## 🏗️ System Architecture

```
┌─────────────────────┐         ┌─────────────────────┐
│   Guardian Device   │         │   Patient Device    │
│  guardian.html      │         │  patient.html       │
│                     │         │                     │
│  • Add medicines    │         │  • Loud alarm       │
│  • View dashboard   │         │  • Voice reminder   │
│  • Manage contacts  │         │  • Taking Now btn   │
│  • See history      │         │  • Skip → alert     │
└────────┬────────────┘         └──────────┬──────────┘
         │                                 │
         └──────────┬──────────────────────┘
                    │
          ┌─────────▼──────────┐
          │  Shared localStorage│
          │  (same origin)     │
          │  mg_medicines      │
          │  mg_history        │
          │  mg_contacts       │
          └─────────┬──────────┘
                    │
          ┌─────────▼──────────┐
          │   Service Worker   │
          │  Background alarms │
          │  Push notifications│
          └─────────┬──────────┘
                    │
          ┌─────────▼──────────┐
          │  WhatsApp (extern) │
          │  Video call        │
          │  Text alerts       │
          └────────────────────┘
```

---

## 📊 Impact & Benefits

- ✅ **Zero cost** — no server, no subscription, runs on any two smartphones
- 👴 **Elderly-friendly** — voice reminders in local language, large buttons
- 👨‍👩‍👧 **Family peace of mind** — guardian sees patient take medicine live on video
- 🏥 **Doctor alerts** — missed dose WhatsApp message within 60 seconds
- 📶 **Works on slow networks** — app is fully cached offline
- 🔒 **Privacy first** — no data leaves the device; WhatsApp handles calls directly

---

## ⚙️ Configuration

### Setting up contacts (Guardian device)
1. Open `guardian.html` → **Contacts** page
2. Enter Patient name, Guardian phone, Doctor phone
3. Use international format: `+91XXXXXXXXXX` for India
4. Click **Save Contacts**

### Adding medicines (Guardian device)
1. Open **Add Medicine** page
2. Fill in name, dosage, frequency, times, days
3. Click **Save Medicine** — patient device picks it up within 10 seconds

### Enable notifications (Patient device)
- Open `patient.html` in Chrome
- Allow notifications when prompted
- Service Worker will handle background alarms

---

## 🤝 Contributing

Pull requests are welcome!

1. Fork the repo
2. Create a branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -m "Add your feature"`
4. Push: `git push origin feature/your-feature`
5. Open a Pull Request

---

## 📄 License

MIT License — free to use, modify, and distribute.

---

## 👨‍💻 Author

Built with ❤️ for elderly care and family health monitoring.

> MediGuard — *because every tablet matters.*

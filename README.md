<div align="center">

<img src="https://img.shields.io/badge/💊-MediGuard-00d4aa?style=for-the-badge&labelColor=0a0f1e&color=00d4aa" alt="MediGuard"/>

# MediGuard — Smart Medicine Reminder System

### A dual-device PWA for medicine reminders with live WhatsApp guardian monitoring

[![PWA](https://img.shields.io/badge/PWA-Ready-00d4aa?style=flat-square&logo=googlechrome&logoColor=white)](https://github.com/Balamugundan/MediGuard)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-Alerts-25d366?style=flat-square&logo=whatsapp&logoColor=white)](https://github.com/Balamugundan/MediGuard)
[![No Server](https://img.shields.io/badge/Server-None%20Required-blue?style=flat-square&logo=javascript&logoColor=white)](https://github.com/Balamugundan/MediGuard)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)
[![Made with](https://img.shields.io/badge/Made%20with-HTML%20%7C%20CSS%20%7C%20JS-orange?style=flat-square)](https://github.com/Balamugundan/MediGuard)

<br/>

> 💡 **No server. No subscription. No database.**
> Just two phones, one Wi-Fi, and zero missed doses.

<br/>

[🚀 Live Demo](https://Balamugundan.github.io/MediGuard/guardian.html) &nbsp;·&nbsp;
[👁️ Guardian View](https://Balamugundan.github.io/MediGuard/guardian.html) &nbsp;·&nbsp;
[👤 Patient View](https://Balamugundan.github.io/MediGuard/patient.html)

</div>

---

## 📌 Table of Contents

- [Problem Statement](#-problem-statement)
- [Features](#-features)
- [How It Works](#-how-it-works)
- [Two-Device System](#-two-device-system)
- [File Structure](#-file-structure)
- [Quick Start](#-quick-start)
- [System Architecture](#-system-architecture)
- [Challenges & Solutions](#-challenges--solutions)
- [Hardware & Software](#-hardware--software)
- [Impact & Benefits](#-impact--benefits)
- [Configuration](#-configuration)
- [License](#-license)

---

## 🎯 Problem Statement

Elderly and chronically ill patients frequently **forget or skip medications**, especially when living alone. Caregivers have no reliable, real-time way to verify medicine intake without being physically present.

**MediGuard solves this** by combining scheduled alarms, voice reminders, and a live WhatsApp video call — so the guardian can watch the patient take the tablet in real time, from anywhere.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔔 **Loud Alarm** | Continuous Web Audio alarm at scheduled times |
| 🗣️ **Voice Reminder** | Speaks medicine name, dosage & instructions aloud |
| 📹 **Live Video Call** | Opens WhatsApp video call to guardian on confirmation |
| 🚨 **Auto Alerts** | WhatsApp text alert to guardian + doctor if skipped/missed |
| 👁️ **Guardian Dashboard** | Real-time patient compliance — taken / pending / missed |
| 📅 **Flexible Schedule** | Set times, days, dosage, instructions per medicine |
| 🌐 **Works Offline** | Service Worker caches all assets for offline use |
| 📲 **Installable PWA** | Add to home screen on any Android or iOS device |
| 🔄 **Zero-Server Sync** | Both devices share data via `localStorage` — no backend |

---

## 📱 How It Works

```
Guardian sets medicine schedule
            │
            ▼
    Saved to localStorage
            │
            ▼
Patient device reads schedule (every 10s auto-refresh)
            │
            ▼
   ┌─── Reminder time arrives ───┐
   │  Loud alarm + Voice speaks  │
   └─────────────────────────────┘
            │
     ┌──────┴──────┐
     ▼             ▼
 Taking Now       Skip / No response (60s)
     │                    │
     ▼                    ▼
📹 WhatsApp          🚨 WhatsApp TEXT ALERT
 Video Call     →   sent to Guardian + Doctor
to Guardian          automatically
     │
     ▼
Guardian watches patient
take tablet LIVE on video
✅ Status = TAKEN
```

---

## 📲 Two-Device System

<table>
<tr>
<th>👁️ Guardian Device</th>
<th>👤 Patient Device</th>
</tr>
<tr>
<td>

- Add & manage medicines
- Set schedule (time, days, dosage)
- Save guardian & doctor contacts
- Monitor patient dashboard live
- View full history
- Receive WhatsApp video call

</td>
<td>

- Receive loud alarm at medicine time
- Hear voice reminder in local language
- Press **Taking Now** → video call opens
- Press **Skip** → auto alert sent
- View today's status (taken/pending/missed)
- No settings — guardian controls everything

</td>
</tr>
<tr>
<td><code>localhost:8080/guardian.html</code></td>
<td><code>localhost:8080/patient.html</code></td>
</tr>
</table>

---

## 📁 File Structure

```
MediGuard/
│
├── 📄 guardian.html       ← Guardian device UI
├── 📄 patient.html        ← Patient device UI
│
├── ⚙️  guardian-app.js    ← Guardian logic (schedule, contacts, dashboard)
├── ⚙️  patient-app.js     ← Patient logic (alarm, video call, alerts)
│
├── 🎨 style.css           ← Shared dark theme styles
├── 🔧 sw.js               ← Service Worker (background alarms)
├── 📋 manifest.json       ← PWA manifest (installable)
│
└── 📖 README.md
```

---

## 🚀 Quick Start

### 1 — Download or Clone

```bash
git clone https://github.com/Balamugundan/MediGuard.git
cd MediGuard
```

Or click **Code → Download ZIP** and extract.

### 2 — Start a Local Server

**Python** (recommended — comes pre-installed on most systems)
```bash
python3 -m http.server 8080
```

**Node.js**
```bash
npx serve .
```

**VS Code** — Install *Live Server* extension → right-click `guardian.html` → *Open with Live Server*

### 3 — Open Both Devices

| Device | Open This URL |
|---|---|
| 💻 Guardian (PC / tablet) | `http://localhost:8080/guardian.html` |
| 📱 Patient (phone) | `http://localhost:8080/patient.html` |

> ⚠️ Both devices must be on the **same Wi-Fi network** and same `localhost:8080` for data sharing to work.

### 4 — First-Time Setup (Guardian device)

1. Go to **Contacts** → enter patient name, guardian phone, doctor phone
2. Go to **Add Medicine** → fill in name, dosage, time, days → Save
3. Patient device picks up the schedule **automatically within 10 seconds** ✅

---

## 🏗️ System Architecture

```
┌──────────────────────────┐        ┌──────────────────────────┐
│     GUARDIAN DEVICE      │        │      PATIENT DEVICE      │
│   guardian.html          │        │    patient.html          │
│                          │        │                          │
│  ➕ Add medicines         │        │  🔔 Loud alarm            │
│  📊 Live dashboard        │        │  🗣️  Voice reminder        │
│  👥 Manage contacts       │        │  📹 Taking Now button     │
│  📋 View history          │        │  ❌ Skip → auto alert     │
│  🚨 Receive alerts        │        │  📅 Today's status        │
└──────────┬───────────────┘        └──────────────┬───────────┘
           │   writes                               │  reads
           │                                        │
           └──────────────┬─────────────────────────┘
                          │
              ┌───────────▼────────────┐
              │   Shared localStorage  │
              │   (same origin)        │
              │                        │
              │   mg_medicines         │
              │   mg_history           │
              │   mg_contacts          │
              └───────────┬────────────┘
                          │
              ┌───────────▼────────────┐
              │    Service Worker      │
              │                        │
              │  • Background check    │
              │    every 30 seconds    │
              │  • OS push             │
              │    notifications       │
              └───────────┬────────────┘
                          │
              ┌───────────▼────────────┐
              │   WhatsApp (external)  │
              │                        │
              │  📹 Video call on       │
              │     "Taking Now"       │
              │  📨 Text alert on       │
              │     skip / missed      │
              └────────────────────────┘
```

---

## ⚔️ Challenges & Solutions

| # | Challenge | Problem | Solution |
|---|---|---|---|
| 1 | ⏱️ **Time Delay** | Service Worker checks every 30s → up to 30s alarm drift | In-page checker runs in parallel every 30s (offset), both combined reduce effective gap |
| 2 | 🎭 **Fake Tablet Taken** | Patient presses "Taking Now" without actually taking the tablet | Immediately opens **live WhatsApp video call** — guardian watches patient swallow tablet in real time. No way to fake it |
| 3 | 🔄 **Two-Device Sync** | Both devices need the same data without a backend server | Both pages share `localStorage` on same `localhost:8080` origin — guardian writes, patient reads every 10s automatically |
| 4 | 📵 **Background Alarms** | Browser tab may be closed on patient phone | Service Worker runs independently and fires **OS-level push notifications** even when browser is closed |
| 5 | 📶 **No Internet Needed** | App must work on local network only | All logic is fully offline-first; only WhatsApp calls need internet |

---

## 🛠️ Hardware & Software

### Hardware Required
- ✅ 2 × Smartphone / tablet / PC (any OS)
- ✅ Same Wi-Fi network
- ✅ WhatsApp installed on both devices

### Software Stack

| Technology | Purpose |
|---|---|
| HTML5 / CSS3 / JavaScript | Core app — no framework |
| Web Audio API | Continuous loud alarm sound |
| Web Speech API | Voice reminders in local language |
| Service Worker | Background alarm check & offline cache |
| Push Notifications API | OS-level alerts when browser is closed |
| localStorage | Shared database between both devices |
| WhatsApp Deep Links | Video call + text alert delivery |

---

## 📊 Impact & Benefits

- ✅ **Zero cost** — no server, no subscription, runs on any two smartphones
- 👴 **Elderly-friendly** — voice reminders, large buttons, simple UI
- 👨‍👩‍👧 **Family peace of mind** — guardian sees patient take tablet live on video
- 🏥 **Doctor notified** — missed dose WhatsApp message within 60 seconds
- 📶 **Works on slow networks** — app is fully cached offline after first load
- 🔒 **Privacy first** — no data leaves the device; WhatsApp handles all calls
- 📲 **No app install** — runs in browser, or install as PWA with one tap

---

## ⚙️ Configuration

### Contacts Setup (Guardian device)
1. Open **Contacts** page
2. Enter patient name, guardian phone `+91XXXXXXXXXX`, doctor phone
3. Click **Save Contacts**

### Adding Medicines (Guardian device)
1. Open **Add Medicine** page
2. Enter name, dosage, frequency, reminder times, days of week
3. Click **Save Medicine** — patient device picks it up in ≤10 seconds

### Enable Notifications (Patient device)
1. Open `patient.html` in **Chrome**
2. Click **Allow** when notification permission is requested
3. Service Worker activates — background alarms will work even when screen is off

---

## 📄 License

```
MIT License — free to use, modify, and distribute.
```

---

<div align="center">

Made with ❤️ for elderly care and family health monitoring

**MediGuard** — *because every tablet matters*

[![GitHub](https://img.shields.io/badge/GitHub-Balamugundan-181717?style=flat-square&logo=github)](https://github.com/Balamugundan/MediGuard)

</div>

# 💰 AI Revenue Recovery Agent

> **Detect revenue that's slipping away — and win it back, automatically.**

[![License: MIT](https://img.shields.io/badge/License-MIT-teal.svg)](LICENSE)
[![HTML](https://img.shields.io/badge/Built%20with-HTML%2FJS-blue)](index.html)
[![No Dependencies](https://img.shields.io/badge/Backend-None%20Required-green)]()
[![Demo Ready](https://img.shields.io/badge/Status-Demo%20Ready-brightgreen)]()

---

## 🧠 What This Is

Revenue loss rarely happens in one clean step. A payment degrades. A checkout gets abandoned. A subscription fails. An invoice goes overdue.

**ReviveAI** is an agentic recovery system that closes the loop — from **detecting** the problem, to **diagnosing** its root cause, to **choosing** the right intervention, to **executing** a bounded recovery workflow — and **measuring** exactly how much money it won back.

---

## 🎯 Features

| Feature | Description |
|---|---|
| **5 Recovery Workflows** | Payment failure · Checkout abandonment · Subscription dunning · B2B receivables · NACH mandate retry |
| **Risk Scoring** | Every record scored 0–100 based on overdue age, amount, tier, and failure type |
| **AI Agent Engine** | Selects right workflow per record with decision rationale logged |
| **Stopping Rules** | DNC compliance, max-retry limits, low-ROI thresholds — all enforced |
| **Escalation Logic** | High-value failures escalate to human or legal automatically |
| **Live Dashboard** | Real-time recovery progress, charts, and cumulative recovery curve |
| **Full Audit Trail** | Every action with timestamp, channel, outcome, agent rationale |
| **Export** | Audit trail as CSV or JSON for compliance |
| **Pause / Stop** | Full batch execution control |

---

## 🚀 Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/ai-revenue-recovery.git
cd ai-revenue-recovery

# 2. Open in browser (no server needed for Chrome/Edge)
# Option A: Just open index.html in Chrome/Edge
# Option B: Use a simple local server (recommended for module imports)
npx serve .
# or
python -m http.server 8080
# Then visit http://localhost:8080
```

> **Note:** Because the app uses ES modules (`type="module"`), you need to serve it from a local server rather than opening the file directly.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    REVENUE RECOVERY AGENT                        │
│                                                                  │
│  ┌──────────┐    ┌────────────┐    ┌──────────────────────────┐ │
│  │  data.js │───▶│  agent.js  │───▶│      workflows.js         │ │
│  │          │    │            │    │                          │ │
│  │ Generates│    │ Risk-scores│    │  💳 Payment Failure      │ │
│  │ 50 at-   │    │ records,   │    │  🛒 Checkout Abandoned   │ │
│  │ risk     │    │ selects    │    │  🔄 Subscription Dunning │ │
│  │ records  │    │ workflow,  │    │  📋 B2B Receivables      │ │
│  │          │    │ enforces   │    │  🏦 Mandate Retry         │ │
│  └──────────┘    │ stop rules │    └──────────────────────────┘ │
│                  └─────┬──────┘                                  │
│                        │                                         │
│                  ┌─────▼──────┐    ┌──────────────────────────┐ │
│                  │  audit.js  │    │       charts.js           │ │
│                  │            │    │                          │ │
│                  │ Logs every │    │  Donut · Bar · Curve     │ │
│                  │ action w/  │    │  Real-time Chart.js      │ │
│                  │ rationale  │    │  rendering               │ │
│                  └────────────┘    └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📂 File Structure

```
ai-revenue-recovery/
├── index.html              # Single-page app with 3 tabs
├── styles/
│   └── main.css            # Dark glassmorphism design system
├── js/
│   ├── app.js              # App controller, UI, event handlers
│   ├── data.js             # Batch generator (50 realistic records)
│   ├── agent.js            # AI Recovery Agent core
│   ├── workflows.js        # 5 recovery workflow engines
│   ├── audit.js            # Audit trail logger + CSV/JSON export
│   └── charts.js           # Chart.js rendering (donut, bar, curve)
├── README.md
├── .gitignore
└── LICENSE
```

---

## 🔄 Recovery Workflows

### 💳 Payment Failure
```
Root cause analysis → Silent retry (alt gateway) → Fresh payment link → Escalate if high-value
```

### 🛒 Checkout Abandonment
```
Cart recovery email → 5% discount SMS nudge → Stop (anti-spam)
```

### 🔄 Subscription Dunning
```
Day-1 silent retry → Dunning email + update link → Plan downgrade offer → Final notice → Suspend
```

### 📋 B2B Receivables
```
Polite reminder → CC finance manager → Phone call → Payment plan → Legal escalation
```

### 🏦 NACH Mandate Retry
```
Immediate retry → 48h window → Salary-day window → Re-registration link
```

---

## 🛑 Stopping Rules

| Rule | Trigger | Action |
|---|---|---|
| **DNC Compliance** | Customer on Do-Not-Contact list | Skip all outreach |
| **Max Retries** | Attempt count ≥ limit per type | Stop workflow |
| **Low ROI** | Amount < ₹100 after first attempt | Mark unrecovered |
| **Legal Escalation** | High-value B2B, all soft measures failed | Flag for legal |
| **Churn Prevention** | Subscription, offer downgrade before cancel | Retain > immediate revenue |

---

## 📊 Metrics Tracked

- **Total at Risk** — sum of all record amounts
- **Total Recovered** — sum of `recoveredAmount` across all records
- **Recovery Rate** — `recovered / atRisk × 100`
- **By Channel** — recovery breakdown per failure type
- **Cumulative Curve** — recovery over batch execution order
- **Escalation Count** — records handed to human/legal
- **DNC Count** — compliance stops enforced

---

## 🔍 Audit Trail

Every agent action is logged with:
- Timestamp
- Record ID
- Customer name
- Action taken
- Channel used (email, SMS, phone, gateway, legal)
- Outcome (success / failed / escalated / skipped / stopped)
- **Agent decision rationale** (why this action was chosen)

Export as **CSV** or **JSON** from the Audit Trail tab.

---

## 🎬 Demo Video Script (5 min)

1. **(0:00–0:30)** Intro — the problem of silent revenue leakage
2. **(0:30–1:00)** Dashboard walkthrough — 4 metric cards, progress bar
3. **(1:00–1:30)** Click "Run Batch" — watch live agent log fire up
4. **(1:30–2:30)** Records tab — filter by status, click "View" on a recovered record
5. **(2:30–3:30)** Audit Trail tab — show agent decision rationale, export CSV
6. **(3:30–4:15)** Charts — donut breakdown, channel bar, recovery curve
7. **(4:15–4:45)** Architecture walkthrough — code structure
8. **(4:45–5:00)** Stopping rules & compliance summary

---

## 🛠️ Tech Stack

| Layer | Tech |
|---|---|
| Frontend | HTML5, Vanilla CSS, ES Modules |
| Logic | Pure JavaScript (no framework) |
| Charts | [Chart.js 4.4](https://www.chartjs.org/) |
| Fonts | [Google Inter](https://fonts.google.com/specimen/Inter) |
| Server | None required (or `npx serve`) |

---

## 📜 License

MIT — free to use, extend, and build on.

---

## 🙋 Author

Built for the **AI Revenue Recovery** track.  
Goal: Show measured money recovered across a batch, with compliant escalation, stopping rules, and a full audit trail.

---

*"Don't just identify the problem. Close the loop."*

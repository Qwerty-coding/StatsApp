# VibeCheck

**Your group chat, turned into a story.**

![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38BDF8?style=flat-square&logo=tailwindcss&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)
![Open Source](https://img.shields.io/badge/Open-Source-orange?style=flat-square)
![Privacy First](https://img.shields.io/badge/Privacy-First-purple?style=flat-square)

VibeCheck is a **privacy-first, fully client-side** WhatsApp chat analyzer. Upload your `.txt` chat export and get a Spotify Wrapped–style analytics dashboard — rich stats, interactive charts, and a shareable 1080×1920 poster — all without a single byte of your data leaving your device.

---

## Features

### Analytics Dashboard
- **Top Talker** — Who dominated the group and by how much (message count + percentage share)
- **Pure Chaos** — The busiest day of the week, backed by real frequency data
- **Response Time** — Group-wide average gap between messages
- **Longest Silence** — The maximum time the chat went completely quiet
- **Busiest Date** — The single highest-volume day in the chat's history
- **Peak Hour** — The time of day your group is most active
- **Leaderboard** — Full ranked list of all members by message volume, with visual progress bars
- **Activity by Hour** — Interactive bar chart showing message distribution across all 24 hours

### Export
- One-click **"Export Wrapped"** generates a high-resolution **1080×1920 PNG poster** — styled for Instagram Stories, WhatsApp Status, or Twitter — entirely client-side via `html-to-image`.

### Privacy by Architecture
- **Zero server involvement.** Parsing runs inside a Web Worker in your browser.
- No accounts. No uploads. No tracking. No cloud storage. Ever.

### Format Support
VibeCheck auto-detects and parses all major WhatsApp export formats:

| Format | Example |
|---|---|
| iOS (12-hour) | `[12/31/2024, 3:45:22 PM] Alice: hey` |
| Android (24-hour, dot) | `31.12.2024, 15:45:22 - Bob: yo` |
| Android (24-hour, slash) | `31/12/2024, 15:45:22 - Charlie: sup` |
| India short date | `31/12/24, 15:45 - Dave: bhai` |
| Android (12-hour short) | `12/31/24, 3:45 PM - Eve: lol` |
| Month abbreviation | `31/Dec/24, 15:45 - Frank: ok` |

---

## The Privacy Guarantee

> **Your chat data never leaves your browser. Not even once.**

Here is exactly what happens when you upload a file:

1. Your browser reads the `.txt` file from local disk — **no network request is made**.
2. The raw text is handed off to a **Web Worker** — a sandboxed background thread that has no access to the DOM, network, or any external API.
3. The Worker parses every line using RegEx, aggregates all statistics in memory, and posts the result back to the UI thread.
4. Your dashboard renders entirely from that in-memory result object.
5. When you close or refresh the tab, everything is gone.

There is no backend. There is no database. There is no analytics pipeline collecting your group members' names or message counts. The app is a static Next.js build served over a CDN — it has no server-side runtime at all.

**You can verify this yourself:** Open your browser's Network tab before uploading. You will see zero outbound requests triggered by your file.

---

## How to Use

### Step 1 — Export your WhatsApp chat

**On iPhone:**
1. Open the group chat in WhatsApp.
2. Tap the group name at the top → **Export Chat**.
3. Select **Without Media**.
4. Share the `.txt` file to yourself (via Files, Notes, email, etc.).

**On Android:**
1. Open the group chat in WhatsApp.
2. Tap the three-dot menu (⋮) → **More** → **Export chat**.
3. Select **Without Media**.
4. Save or share the `.txt` file.

### Step 2 — Drop it into VibeCheck

1. Go to **[stats-app-ecru.vercel.app](https://stats-app-ecru.vercel.app)**.
2. Drag and drop your `.txt` file onto the upload zone, or click **Browse** to select it.
3. Your dashboard loads instantly — no sign-in, no waiting.

### Step 3 — Export your Wrapped poster

1. Click **Export Wrapped** in the top-right corner of the dashboard.
2. A `vibecheck-export.png` (1080×1920) will download directly to your device.
3. Share it on Instagram Stories, WhatsApp Status, or anywhere you like.

---

## Getting Started (For Developers)

### Prerequisites
- Node.js 18+
- npm, yarn, or pnpm

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Qwerty-coding/StatsApp.git
cd StatsApp

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm start
```

### Project Structure

```
StatsApp/
├── app/                  # Next.js App Router pages and layouts
├── public/               # Static assets
├── types.ts              # Shared TypeScript types
├── next.config.ts        # Next.js configuration
└── tailwind.config.*     # Tailwind CSS configuration
```

### Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| UI | React 18 + Tailwind CSS |
| Charts | Recharts |
| Icons | Lucide React |
| Export | html-to-image |
| Parsing | Web Workers + RegEx |
| Deployment | Vercel |

---

## Roadmap

- [x] Multi-format WhatsApp export parsing
- [x] Activity dashboard (8 stats)
- [x] Leaderboard with progress bars
- [x] Activity by Hour chart
- [x] 1080×1920 PNG export
- [x] Dark / Light mode
- [ ] Word Cloud (English + Hinglish stop-words)
- [ ] Telegram export support
- [ ] Network graph (who replies to whom)
- [ ] Hinglish sentiment analysis

---

## Contributing

Contributions are welcome. Please open an issue before submitting a pull request for significant changes.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## Disclaimer

VibeCheck is an independent, open-source tool built by a third-party developer. It is **not affiliated with, authorized by, maintained by, sponsored by, or endorsed by WhatsApp LLC or Meta Platforms, Inc.** in any way.

"WhatsApp" is a registered trademark of WhatsApp LLC. VibeCheck only processes `.txt` files that users have voluntarily exported from WhatsApp using WhatsApp's own built-in export functionality. No WhatsApp API is accessed, and no WhatsApp servers are contacted at any point.

Users are solely responsible for obtaining appropriate consent from all group members before uploading and analyzing a group chat export.

---

## License

[MIT](LICENSE) © 2026 VibeCheck Contributors

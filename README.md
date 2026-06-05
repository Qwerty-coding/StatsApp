# VibeCheck

**Your group chat, turned into a story.**

![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38BDF8?style=flat-square&logo=tailwindcss&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)
![Open Source](https://img.shields.io/badge/Open-Source-orange?style=flat-square)
![Privacy First](https://img.shields.io/badge/Privacy-First-purple?style=flat-square)

VibeCheck is a **privacy-first, fully client-side** WhatsApp and Telegram chat analyzer. Upload your export and get a Spotify Wrapped–style analytics dashboard — rich stats, interactive charts, Hall of Fame achievements, a Word Cloud, and a shareable 1080×1920 poster — all without a single byte of your data leaving your device.

---

## Features

### Analytics Dashboard

- **Total Messages** — Full message count with per-member average
- **Busiest Date** — The single highest-volume day in the chat's history, with message count
- **Speed Demon** — The member with the fastest average reply time (minimum 5 qualifying replies)
- **Avg Response Time** — Group-wide average gap between consecutive messages
- **Longest Silence** — The maximum time the chat went completely quiet

### Leaderboard

Full ranked list of all members by message volume, with two views:

- **List view** — Progress bars showing each member's share relative to the top talker
- **Chart view** — Interactive donut chart of the top 5 contributors + an aggregated "Others" slice, with hover tooltips

### Chat Rhythm

Interactive bar chart with a **3-way toggle**:

- **24 Hours** — Message distribution across all hours of the day
- **Days** — Activity broken down by day of the week
- **Months** — Month-by-month message volume across the chat's lifetime

Peak bars are highlighted in blue; all others are rendered as low-opacity fills.

### Group Vocabulary (Word Cloud)

Extracts your group's most authentic vocabulary with aggressive noise reduction:

- Strips invisible Unicode characters and zero-width spaces
- Built-in English and Hinglish stop-word list (`bhai`, `yaar`, `kya`, `hai`, `lol`, etc.)
- Real-time custom exclusion filter — type any word to remove it from the cloud on the fly
- Weighted by frequency; color-coded by rank

### Hall of Fame

Six lifetime achievement cards, each driven by real behavioral data:

| Award | Criteria |
|---|---|
| **Top Talker** | Highest total message count |
| **The Observer** | Lowest total message count |
| **The Icebreaker** | Most messages sent after 6+ hours of silence |
| **The Monologuer** | Longest unbroken streak of consecutive messages |
| **Dynamic Duo** | Pair with the most rapid back-and-forth exchanges under 5 minutes |
| **Left on Read** | Person whose messages most often preceded 2+ hours of silence |

### Time Filter

Filter the entire dashboard — all stats, charts, leaderboard, Word Cloud, and Hall of Fame — by:

- All-time
- A specific year
- A specific calendar month

### Export

One-click **"Export Wrapped"** generates a high-resolution **1080×1920 PNG poster** — styled for Instagram Stories, WhatsApp Status, or Twitter — entirely client-side via `html-to-image`. The poster includes total messages, busiest date, and all four main Hall of Fame awards.

### Privacy by Architecture

- **Zero server involvement.** Parsing runs in a Web Worker (a sandboxed background thread with no network or DOM access) in your browser.
- No accounts. No uploads. No tracking. No cloud storage. Ever.
- Closing or refreshing the tab permanently clears all data from memory.

---

## Format Support

VibeCheck auto-detects and parses all major WhatsApp export formats, plus Telegram JSON exports.

### WhatsApp

| Format | Example |
|---|---|
| iOS (12-hour) | `[12/31/2024, 3:45:22 PM] Alice: hey` |
| Android (24-hour, dot) | `31.12.2024, 15:45:22 - Bob: yo` |
| Android (24-hour, slash) | `31/12/2024, 15:45:22 - Charlie: sup` |
| India short date | `31/12/24, 15:45 - Dave: bhai` |
| Android (12-hour short) | `12/31/24, 3:45 PM - Eve: lol` |
| Month abbreviation | `31/Dec/24, 15:45 - Frank: ok` |

### Telegram

Export your chat as **JSON** from Telegram Desktop (Settings → Export Chat History → Format: JSON). VibeCheck parses all message types including rich-text segments.

---

## The Privacy Guarantee

> **Your chat data never leaves your browser. Not even once.**

Here is exactly what happens when you upload a file:

1. Your browser reads the `.txt` or `.json` file from local disk — **no network request is made**.
2. The raw text is passed to a **Web Worker** — a sandboxed background thread with no access to the DOM, network, or any external API.
3. The Worker parses every line using RegEx, aggregates all statistics in memory, and posts the result back to the UI thread.
4. Your dashboard renders entirely from that in-memory result object.
5. When you close or refresh the tab, everything is gone.

There is no backend. There is no database. There is no analytics pipeline. The app is a static Next.js build served over a CDN — it has no server-side runtime at all.

**You can verify this yourself:** Open your browser's Network tab before uploading. You will see zero outbound requests triggered by your file.

---

## How to Use

### Step 1 — Export your chat

**WhatsApp on iPhone:**
1. Open the group chat → tap the group name → **Export Chat**.
2. Select **Without Media**.
3. Share the `.txt` file to yourself.

**WhatsApp on Android:**
1. Open the group chat → tap ⋮ → **More** → **Export chat**.
2. Select **Without Media**.
3. Save or share the `.txt` file.

**Telegram Desktop:**
1. Open the chat → click ⋮ → **Export Chat History**.
2. Uncheck all media types, set Format to **JSON**.
3. Save the exported folder; you need the `result.json` file inside it.

### Step 2 — Drop it into VibeCheck

1. Go to **[stats-app-ecru.vercel.app](https://stats-app-ecru.vercel.app)**.
2. Drag and drop your `.txt` or `.json` file onto the upload zone, or click **Browse**.
3. Your dashboard loads instantly — no sign-in, no waiting.

### Step 3 — Explore and export

- Use the **time filter** (top-right dropdown) to slice stats by year or month.
- Toggle the **Leaderboard** between List and Chart views.
- Switch the **Chat Rhythm** chart between Hours, Days, and Months.
- Type into the **Word Cloud** filter to remove any word in real time.
- Click **Export Wrapped** to download your 1080×1920 poster.

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
│   ├── page.tsx          # Upload landing page
│   ├── Dashboard.tsx     # Main analytics dashboard
│   └── ActivityChart.tsx # Chat Rhythm chart component
├── components/
│   └── WordCloud.tsx     # Word Cloud component
├── lib/                  # Core parsing logic and text extraction utilities
├── public/
│   └── parser.worker.js  # Web Worker: WhatsApp + Telegram parser
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

- [x] Multi-format WhatsApp export parsing (6 formats)
- [x] Telegram JSON export parsing
- [x] Core stats dashboard (Total Messages, Busiest Date, Speed Demon, Avg Response Time, Longest Silence)
- [x] Leaderboard — List view with progress bars
- [x] Leaderboard — Donut chart view
- [x] Chat Rhythm — Hourly, Daily, and Monthly activity charts
- [x] Hall of Fame (Top Talker, Observer, Icebreaker, Monologuer, Dynamic Duo, Left on Read)
- [x] Group Vocabulary Word Cloud (English + Hinglish stop-words + custom exclusion filter)
- [x] 1080×1920 PNG export poster
- [x] Dark / Light mode
- [x] Time filter (All-time, by year, by month)
- [ ] Modular export switcher (selectable poster layouts)
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

VibeCheck is an independent, open-source tool built by a third-party developer. It is **not affiliated with, authorized by, maintained by, sponsored by, or endorsed by WhatsApp LLC, Meta Platforms, Inc., or Telegram FZ-LLC** in any way.

"WhatsApp" is a registered trademark of WhatsApp LLC. VibeCheck only processes `.txt` files that users have voluntarily exported from WhatsApp using WhatsApp's own built-in export functionality. No WhatsApp API is accessed, and no WhatsApp servers are contacted at any point.

Users are solely responsible for obtaining appropriate consent from all group members before uploading and analyzing a group chat export.

---

## License

[MIT](LICENSE) © 2026 VibeCheck Contributors

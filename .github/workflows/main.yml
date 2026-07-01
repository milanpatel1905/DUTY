# WhatsApp Duty Scheduler – Windows Desktop App

Offline Electron desktop app for Milan Patel (MDP). Auto-extracts duties from WhatsApp chats & PDFs.

### Features
- Multi-PDF drag & drop
- Date range filter (Start / End)
- Day-wise schedule
- Local SQLite DB – no internet needed
- Ban-safe: WhatsApp Export ZIP / Watch Folder only

### Run in dev (Windows)
```bash
npm install
npx prisma db push
npm run electron:dev
```
This starts Next.js at http://localhost:3000 and opens the Electron window.

### Build Windows installer
On a Windows machine (or via GitHub Actions):
```bash
npm install
npm run dist:win
```
Output: `dist/WhatsApp Duty Scheduler Setup 1.0.0.exe`

The installer creates Desktop + Start Menu shortcuts. DB lives in `%APPDATA%\whatsapp-duty-scheduler\duties.db`

### Config
Edit `%APPDATA%\whatsapp-duty-scheduler\.env` or set env var before first run:
```
WATCH_NAMES=Milan Patel,MDP,milan,patel
```

### WhatsApp – NO BAN RISK
Use only:
1. WhatsApp Export ZIP upload
2. Watch Folder (`watch_inbox/`)
3. WhatsApp Cloud API

Do NOT use whatsapp-web.js with your personal number.

---
Web version: `npm run dev` → http://localhost:3000

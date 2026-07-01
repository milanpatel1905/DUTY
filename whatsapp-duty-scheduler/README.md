# WhatsApp Duty Scheduler

Full-stack app that watches a WhatsApp chat/group, extracts duties assigned to YOU from text messages and PDF attachments, and builds a day-wise duty schedule.

Built with Next.js 14, Prisma + SQLite, Tailwind.

### Features
1. **Ingest WhatsApp Export**: Upload your `_chat.txt` export + media ZIP. Auto-parses.
2. **PDF Duty Extraction**: Parses all PDFs sent in chat. OCR-ready hook included.
3. **Name Alias Matching**: Matches your full name, short name, initials. Configurable in `.env`
4. **Duty extraction**: Regex + date NLP for:
   - `24/07`, `24-07-2025`, `July 24`, `tomorrow`, etc.
   - Keywords: duty, shift, call, posting, roster
   - Lines containing your alias
5. **Day-wise Calendar**: React Big Calendar view + list view
6. **3 Ingestion Modes**:
   - A. **Export Upload** - Works TODAY, 100% reliable. Export from WhatsApp: Group Info > Export Chat > With Media
   - B. **WhatsApp Cloud API Webhook** - `/api/webhook/whatsapp` - for WhatsApp Business numbers
   - C. **Watch Folder** - `npm run worker` - Drop new PDFs/chats into `/watch_inbox`, auto-parsed
7. **Deduplication**: SHA256 hash of messages/files

---

### Quick Start

1. `npm install`
2. Copy `.env.example` to `.env` and set your names:
```
WATCH_NAMES="Dr. Sharma,Amit,AS,dr amit"
```
3. `npx prisma db push`
4. `npm run dev`

Open http://localhost:3000

**First ingest:** Click "Upload WhatsApp Export" and drop your exported ZIP from WhatsApp.

### WhatsApp Export How-To
Android/iPhone: Open the Group/Chat > ⋮ > More > Export chat > Include Media > Share to your computer. Upload that .zip here.

### Live auto-ingest options
1. **WhatsApp Cloud API (official)**: Set `WHATSAPP_VERIFY_TOKEN` and `WHATSAPP_ACCESS_TOKEN` in .env, point your Meta webhook to `https://yourdomain.com/api/webhook/whatsapp`
2. **whatsapp-web.js bridge**: I included `scripts/wa-bridge.js` - run with a spare number. It forwards any message containing your alias to the ingest API.
3. **Watch Folder**: `npm run worker` - any PDF/txt dropped in `watch_inbox/` gets parsed instantly.

### Project Structure
- `app/page.tsx` - Calendar dashboard
- `app/api/ingest/route.ts` - Main ingest API
- `lib/extractor.ts` - Duty extraction engine - EDIT THIS to tune for your roster format
- `prisma/schema.prisma` - Duty, SourceMessage, File models

You are a senior engineer - tune `lib/extractor.ts` for your hospital/department roster PDF format. I've added 3 generic parsers: Table roster, List roster, and free text.

MIT Licensed.

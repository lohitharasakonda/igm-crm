# IGM CRM – Lightweight Field Sales CRM (PWA)

IGM CRM is a lightweight CRM-style Progressive Web App built for a real field sales workflow (my dad’s day-to-day sales tracking).

The goal was simple:  
**log visits fast, remember last conversations, and never miss follow-ups** — without paying for heavy CRM tools.

The app runs as an installable web app (PWA), stores data locally on the device, and uses iPhone Calendar reminders for reliable notifications.

---

## Features

- Clients list with search  
- Client detail view with:
  - last meeting summary  
  - visit history  
  - open follow-ups  
- Log visits with typed notes  
- Follow-ups dashboard:
  - overdue  
  - today  
  - next 7 days  
- CSV import for clients and visits (from Google Sheets / Excel exports)  
- Add follow-ups to iPhone Calendar via `.ics` export  
- Installable on iPhone as a home-screen app (PWA)  

---

## Tech Stack

- React + Vite  
- Tailwind CSS  
- IndexedDB (local persistence, no backend)  
- iCalendar (.ics) export for reminders  
- Deployed on Vercel  

---

## Why this approach

- **No backend**: avoids cloud cost and complexity for a single-user workflow  
- **Local storage**: data stays on the user’s phone  
- **Calendar reminders**: more reliable than free web push notifications on iOS  
- **PWA**: app-like experience without App Store fees  

---

## Run locally

```bash
npm install
npm run dev
```

---

## CSV Import Format

### Clients CSV
```
Client, City, State, Contact, Phone, Email, Segment, Status, Notes
```

### Visits CSV
```
Date, Client, Touch Type, Outcome, Products, Signal, Next Action, Follow-up Date, Priority
```

---

## Limitations

- Data is stored per device (IndexedDB)  
- No cloud sync or multi-user support yet  
- Calendar reminders require manual “Add to Calendar” action  

---

## Planned improvements (after real usage feedback)

- Better import validation and deduplication  
- Export / backup data  
- Optional cloud sync  
- Smart summaries and follow-up suggestions (ML)  

---

## Status

Actively used in real sales workflow.  
Next steps depend on feedback after extended usage.

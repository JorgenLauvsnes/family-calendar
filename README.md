# Family Calendar

A self-hosted family calendar designed to run on a wall-mounted tablet. Shows a 7-day overview with events, schedules, and live weather from Yr.no. Built with Next.js 14, SQLite, and Tailwind CSS.

---

## Pages & URLs

| URL | Description |
|-----|-------------|
| `http://localhost:3000/` | Redirects to `/display` |
| `http://localhost:3000/display` | Main calendar view — intended for the wall tablet |
| `http://localhost:3000/login` | Admin login |
| `http://localhost:3000/admin/members` | Manage family members (name, color, role) |
| `http://localhost:3000/admin/events` | Add and manage calendar events |
| `http://localhost:3000/admin/settings` | App settings (family name, weather location, vacation mode, password) |
| `http://localhost:3000/admin/google` | Connect/disconnect Google Calendar accounts per member |

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or newer
- npm (comes with Node)

---

## Installation

```bash
git clone https://github.com/JorgenLauvsnes/family-calendar.git
cd family-calendar
npm install
```

---

## Configuration

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

### Generate secrets

Run these two commands and paste the output into `.env.local`:

```bash
# SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Full `.env.local` reference

```env
# Google Calendar OAuth2 (see Google Calendar Setup below)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google/callback

# Public app URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Session signing secret (generate above)
SESSION_SECRET=

# Encryption key for stored Google tokens (generate above)
ENCRYPTION_KEY=

# Default admin password on first run (you can change it later in /admin/settings)
INITIAL_ADMIN_PASSWORD=familie
```

---

## Running the app

```bash
# Development
npm run dev

# Production build
npm run build
npm start
```

The app will be available at `http://localhost:3000`.

The SQLite database is created automatically at `data/calendar.db` on first run. Default family members (Jørgen, Kine, Markus, Jorunn Lovise, Vilde, Victor) are seeded if the members table is empty.

---

## Default admin login

- **URL:** `http://localhost:3000/login`
- **Password:** `familie` (or whatever you set as `INITIAL_ADMIN_PASSWORD`)

Change the password after first login at `/admin/settings`.

---

## Google Calendar Setup

Connecting a family member's Google Calendar requires an OAuth2 app in Google Cloud.

### 1 — Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click **New Project**, give it a name (e.g. `family-calendar`), click **Create**
3. Make sure the new project is selected in the top dropdown

### 2 — Enable APIs

1. Go to **APIs & Services → Library**
2. Search for and enable **Google Calendar API**

### 3 — Create OAuth2 credentials

1. Go to **APIs & Services → Credentials**
2. Click **+ Create Credentials → OAuth client ID**
3. If prompted, configure the consent screen first:
   - Choose **External**
   - Fill in app name and email fields
   - Add scopes: `calendar.readonly` and `userinfo.email`
   - Add your Google account as a **test user**
4. Back on Create Credentials → OAuth client ID:
   - Application type: **Web application**
   - Under **Authorized redirect URIs** add: `http://localhost:3000/api/google/callback`
5. Click **Create** — copy the **Client ID** and **Client Secret** into `.env.local`

### 4 — Connect an account

1. Restart the app after updating `.env.local`
2. Go to `http://localhost:3000/admin/google`
3. Click **Koble til Google** next to an adult family member
4. Sign in with Google and approve permissions

> Only members with role `adult` can be connected to Google Calendar.
> Sync runs automatically every 30 minutes. You can also trigger it manually from the Google page.

---

## Weather

Weather is fetched from [Yr.no](https://www.yr.no) (Norwegian Meteorological Institute). The default location is Ranheim, Trondheim. You can change the coordinates in `/admin/settings`.

To find coordinates: go to [yr.no](https://www.yr.no), right-click on the map and choose **Copy coordinates**.

### Vacation mode

Enable vacation mode in `/admin/settings` to show weather for a different location (e.g. while on holiday). The calendar display will use the vacation location's weather until you turn it off.

---

## Tech stack

| | |
|---|---|
| Framework | Next.js 14 (App Router) |
| Database | SQLite via better-sqlite3 |
| Auth | iron-session (cookie-based) |
| Calendar sync | Google Calendar API v3 |
| Weather | Yr.no / MET Norway API |
| Styling | Tailwind CSS |
| Language | Norwegian (bokmål) |

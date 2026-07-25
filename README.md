# WebOS
# Webtop

Webtop is a full-screen, macOS-inspired desktop simulator built with Vite, React, Zustand, react-rnd, framer-motion, cmdk, and Supabase.

## Features

- Full-screen gradient desktop with no document scrolling
- Translucent menu bar with focused app title and live clock
- macOS-style dock with hover magnification and open-app dots
- Draggable, resizable, minimizable, maximizable windows
- Cmd/Ctrl+K Spotlight palette for apps and files
- Supabase email/password auth with local demo fallback
- Finder, Notes, Editor, and Settings apps
- User preferences for wallpaper and light/dark theme
- Debounced note and window-session persistence

## Local development

```bash
npm install
npm run dev
```

For Supabase-backed auth/data, copy `.env.example` to `.env` and fill in your project values.

## Supabase setup

Run `src/schema.sql` in your Supabase SQL editor before using the hosted data mode.

## Render deploy

Use a Render Static Site:

- Build command: `npm install && npm run build`
- Publish directory: `dist`
- Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

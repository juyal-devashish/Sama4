# Self-hosted fonts

Poppins (400, 500, 600, 700) and Roboto (variable, 400–500), downloaded from Google Fonts
(fonts.gstatic.com) on 2026-11-12: the same `latin` and `latin-ext` woff2 files Google serves.
They are loaded with `next/font/local` in `src/app/layout.tsx`, so builds never fetch fonts.

Licences: Poppins https://fonts.google.com/specimen/Poppins/license,
Roboto https://fonts.google.com/specimen/Roboto/license (both open font licences).

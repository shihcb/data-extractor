# toolbox

Quick tools that run entirely in the browser — nothing is uploaded.

- **case converter** — lowercase, UPPERCASE, Title Case, Sentence case, camelCase, snake_case, kebab-case, tidy spaces; live character / word / line count
- **image converter** — PNG, JPG, WEBP or PDF; resize by % or width; quality; several images at once (zip or one multi-page PDF); copy to clipboard
- **pdf tools** — merge, split, reorder, rotate, delete pages, pages to PNG
- **pdf editor** — change text by covering it and retyping it in a matching standard font
- **qr code** — make (PNG / SVG) and scan (image or camera)
- **text diff** — compare by lines, words or characters

Shift+1…6 switch tabs, `?` lists the shortcuts. Light/dark follows the device. Installable and works offline (the service worker is generated at build time from `sw.template.js`).

## Motion

All animation uses one timing, ported from instagram-follower-checker: **450ms, `cubic-bezier(0.4, 0, 0.2, 1)`** (`src/motion.js`, and `--motion-duration` / `--motion-easing` in CSS). Pop-ups and toasts come in from 14px down at 95% scale; list rows slide in and out with the rows around them shifting (`MotionList`); tab switches are the sideways push (`TabPanes`); counters count (`Count`).

## Develop

```sh
npm install
npm run dev     # local server
npm run lint
npm run build   # into dist/
```

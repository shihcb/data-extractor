# Notes for Claude

## Always push to `main`

When a change is done, commit it and push it straight to `main`. Don't leave
work only on a side branch or ask first.

## The motion — names to use

Every animation uses one timing, ported from instagram-follower-checker:
**450ms, `cubic-bezier(0.4, 0, 0.2, 1)`** (`MOTION` in `src/motion.js`,
`--motion-duration` / `--motion-easing` in CSS). Moving things run on the
motion engine (`src/engine.js`, a port of the source repo's row engine):
each change adds a piece of motion on top of what's already moving instead
of restarting it. When the user names one of these, this is what they mean:

| Name | What it does | Where |
| --- | --- | --- |
| **the slide** | the shared 450ms curve itself ("same timing as everything") | `motion.js` |
| **the word slide** | words that come and go inside a line ease their width open/shut while fading, so the rest of the line slides over ("per page", "· 2 selected") | `SlideText` |
| **the word swap** | the word slide's swap form: one word changing to another inside a line ("%" ↔ "px wide") — both share one spot, the old fading out as the new fades in, while the space eases from one word's width to the other's | `SlideSwap` |
| **the text swap** | text that changes: the old words fade out exactly where they were while the new ones fade in (the source repo's empty-text fade) | `FadeText` |
| **the box ease** | a box whose content changes size eases to its new height; nested boxes: only the outermost moves | `AutoHeight`, `heightMotion.js` |
| **the bottom bar** | every tab's "what's open" actions, the instagram repo's bulk bar (count outlined, plain buttons, delete red, a switched-on one outlined), floating at the bottom of the screen (18px up), centered; it pops in like the pages while its tab is showing and there's something to act on. The button that ends it — **clear** or **close** — is always last, on the right. Case converter: clear. Image converter: count · select all ("all" ↔ "none" the word swap, "select" staying) · delete · clear. PDF tools: count · select all · save (the selection) · delete · clear. PDF editor: undo · redo · add text · find · close. QR make: clear (scan has none). Text diff: swap · clear. Toasts sit above it (`body.has-bar`); the page keeps room under its end for it | `ActionBar`, `BulkBar` |
| **the panel open** | a panel opens from nothing / closes to nothing: height eases, content fades in from 10px up at 96% (the quality slider, image options) | `Collapse` |
| **the row slide** | a list row slides in from under the row above / out under it, the rows around it shifting (the source repo's list 3 rows / username boxes); grid items (the PDF pages, the image cards) pop instead | `MotionList` |
| **the button glide** | a row of buttons/controls never snaps: a button whose label changes eases its width, the others slide along | `FlipRow` |
| **the count** | numbers count to their new value (and up from 0 when they appear), their width easing | `Count` |
| **the tab push** | switching tabs: the old pane slides out sideways as the new one slides in, the area easing to the new height; the tab outline slides along | `TabPanes`, `TabSwitcher` |
| **the pop** | pop-ups and toasts come in from 14px down at 95% scale and leave the same way; so do the PDF pages, the image cards, the bulk bar, the QR code and the camera picture | `Modal`, `Toast`, `MotionList`, `usePop` |
| **the glide to top** | a box easing shut: the page's bottom follows the content's bottom frame by frame, so no blank room opens below (a sudden shrink glides up instead); when everything fits on screen again it glides back to the top and stops scrolling until it needs to | `App.jsx` |
| **the clear** | the last PDF pages / images leaving (or the PDF editor closing its PDF): they pop out in place while the box's content holds its height, then the box goes back to empty | `PdfTools.jsx`, `ImageConverter.jsx`, `PdfEditor.jsx` |

PDF tools and the image converter are the same layout (and the PDF editor
shares their box, its pages popping in and out the same way): one box size (the
screen minus `--box-room`, ~410px, which leaves room for the floating bar) that scrolls inside so the page stays still,
the same cards (picture, label row, small buttons; tap to select, several at
once), the same buttons, and the same bulk bar. Keep them matching. Each has
its description above the box (always the same words) and a stats line right
under it that's always there, label first so only the numbers change, counting
up from 0 ("pages 0 · files 0 · selected 0"; sizes always in KB).

The PDF editor finds text at any angle and on rotated pages (only vertical
writing is left out) and writes edits back turned the same way. Its box zooms
(buttons ease on the shared curve; pinch / ctrl + scroll follow the fingers)
around the spot being zoomed, scrolling both ways inside the box; pages are
redrawn sharper once a zoom settles. While zooming, easing boxes inside don't
ease (`_heightMotion` on the scroller). New words use the PDF's own font when
it has every letter (pdf.js opened with `fontExtraProperties`; saved with
fontkit, mapped back to real letters for copy/search), else the closest
standard font squeezed to the original's width (`src/pdfFonts.js`).
Words that are pictures (an email's From/Subject/Date/To header printed by
Mail) are found as wide, short images with no text on them; tapping one reads
it with Tesseract (`src/ocr.js`, files served from `/ocr/`, fetched only on
first use, not precached) and the new words are drawn over a cover in the
picture's background colour. A picture is read as a block of lines
(`readBlock`): one holding several (a From value that ran onto a second
line) becomes one item per line, each covering its own band of the
picture, and the line under the tap is the one that opens. The picture is redrawn from the PDF just for the
read (letters ~100px tall, alone on a white margin) so tiny text reads too, and
its colours are taken from that sharp copy, not the blurry page on screen.

Editing in the PDF editor:
- pdf.js's pieces of a line (each word placed alone, a ligature alone) in the
  same font, size and baseline, less than 0.6em apart, are one line to change
  (`linesOf`).
- Saving takes the old words out of the page itself (`src/pdfText.js`: the
  page's text commands followed with their fonts' widths; each run wholly on
  a changed line swapped for a blank move of the same length), so copy and
  search find only the new words and what's drawn behind stays. A line that
  can't come out whole (standard fonts with no widths in the file, text in a
  form, a run reaching past the line) gets the old patch instead.
- Tab / Shift + Tab move to the next / previous line, saving; Ctrl + Z /
  Ctrl + Shift + Z undo / redo; Ctrl + F (or the button) opens find and
  replace (the panel open; matches tinted on the pages; replace all is one
  undo; open, it reads the pictures of text too).
- A change appears and goes through a blank (`TextItem`): the patch fades in
  over the old words, then the new words fade in on it (reversed as it
  goes) — never old and new words at once (a cross-fade, or the patch's
  colour easing alone, jumbled them on undo / replace all). Browser
  animations, not the engine (it clears a settled element's transform).
  The patch reaches 0.06em past its box; its colour is the most common in
  the whole box (the edge alone was a table cell's border).
- Find and replace matches case unless "Aa" is switched off; its count is
  "· matches N" sliding into the stats line while it's open.
- Double-click an empty spot (or tap one with "add text" on) to add a line,
  in the size and font of the nearest line; left empty, it goes again.
- Scanned / photographed pages (one picture over most of the page, no text
  of its own) are read in the background once open (`readPage` in
  `src/ocr.js`): drawn ~5000px on the long side, made black on white
  (`src/inkWorker.js`, local threshold, off the page's thread), read whole;
  lines split at gaps of ~5 letters (columns), junk dropped (words Tesseract
  isn't sure of unless long letter/number runs), and pieces whose words
  span several close rows re-found from the ink and re-read line by line.
  Each becomes a line to change, turned with the scan's tilt, in Courier
  when its letters all take the same room. The ink colour everywhere is a
  solid stroke's (75% of the way to the darkest inked pixel), not the
  darkest speck. Lines Tesseract wasn't sure of (mean confidence < 90) are
  then read twice more as close-ups (the page as drawn, and black on white)
  and the reading most of the three agree on is kept (`rereadLine`,
  `agreedReading`), updating the line in place unless it's being changed.
  A read line lying on the page's own text (a searchable scan) isn't added.
  Bold print is found by stroke thickness for its height against the page's
  usual (`strokeOf`); Courier only when word widths fit fixed-width letters
  better than proportional ones (a few plain words passed by letter count).
- Searchable scans' invisible words (`3 Tr`) are cut on save but the line
  keeps its patch: the picture's words are still there.
- Letter-spaced words that pdf.js reads as "T r a c k e d" are joined; a
  space placed on its own carries the line on (wide word spacing).
- Right-to-left lines (Hebrew) are written in drawn order (`visualOrder`),
  keeping their right end; Arabic needs shaping and isn't handled.

Every stats line in the app is label first ("characters 3 · words 1", "added 2 ·
removed 1") so only the numbers change, counting.

The engine's "too small to move" cut-off is per kind of value: half a pixel for
sizes and slides, 0.002 for scale and opacity (a half-unit cut-off skipped
every 95% ↔ 100% scale).

Buttons are always `--button-gap` (6px, the instagram repo's) apart: button
rows, the settings row, the bulk bar, card buttons, the zoom controls.

Rules that keep it smooth (each was a real bug):
- A row/box measures positions against itself (`position: relative`), never
  against something that moves with the boxes above it.
- Nothing is measured while hidden (a closed panel measures 0px).
- A leaving copy is hidden before its motion styles are dropped.
- Heavy work (encoding an image) never runs on the page's thread while
  something moves (the size estimate runs in `estimateWorker.js`).
- Text being clipped while it resizes must not change its baseline.
- Nothing in a list is moved in the page while it moves on screen: the
  browser restarts a moved element's CSS animations and drops its
  transitions (PDF pages' pictures flickered on every reorder). `MotionList`
  places items with CSS `order` and fixes the page's order once still; a
  picture that fades in when loaded does it from script, once.
- A hint centred over a box that eases is centred in the outer box, not
  the inner one that changes size at once (the QR hint jumped 24px).
- A button lets go of focus only after a pointer click (`if (e.detail)
  e.currentTarget.blur()`): blurring on a keyboard press threw keyboard
  users back to the top. Never in a key handler (Enter in the PDF editor's
  text box blurs to save, unconditionally).
- A motion's target that can change while it runs is followed (a tab
  push's height, a word slide's width, via a ResizeObserver while moving);
  a ghost fades out from the opacity it's drawn at, never from 1.
- Every motion that can change again mid-way adds a piece on top (the
  engine; the count and the editor's zoom buttons do the same): restarted
  from where it's drawn, it stalls at zero speed, then rushes.
- Heavy work on the page's thread (a thumbnail, a picture's colours) waits
  for `whenStill()` (engine.js) so it can't stall a frame mid-motion; a
  list measures everything before it moves anything.
- Keyboard focus always shows (`:focus-visible`, 2px outline); text fields
  show theirs with their border.
- The PDF editor's zoom keeps the point under the fingers on the same spot
  of the same page (the space between pages doesn't scale); only pages near
  the view are redrawn sharper; a new PDF opens at the top, at 100%.

Files out and updates:
- PDF tools: every page of one file → that file rearranged in place (forms,
  outline stay); otherwise each file's pages copied in one go (shared fonts
  and pictures once). Pages left out are never kept in the file.
- The service worker serves /assets/ (hashed) from its cache first, never
  lets a 404 or a web page replace a good copy, keeps the previous build's
  cache for open tabs, and keeps cmaps / OCR files in `toolbox-runtime`.
  `loadLibrary` reloads only when the app really changed (never offline,
  never while saving).

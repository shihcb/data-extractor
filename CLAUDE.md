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
| **the bottom bar** | the instagram repo's bulk bar (plain buttons), floating at the bottom of the screen (18px up), centered; it pops in like the pages while its tab is showing and there's something to act on. Only text diff has one now (swap); every other tab's actions are in **the box row** or the buttons under it. Toasts sit above it (`body.has-bar`); the page keeps room under its end for it only while it shows (the room eases open / shut) | `ActionBar` |
| **the box row** | the row right under every tab's box (QR make: under its text box): **undo · redo** on the left (icons; `history` from `useHistory`), the tab's stats line in the middle (QR make: none; a fixed share of the row, never sized to its words, so a text swap there fades in place and the row doesn't re-centre), and the **trash** on the right (red icon), with the tab's own buttons sliding in just left of it (`end`: the metadata editor's **reset**, there only while the selected photo has something to put back — the word slide, as "px wide"; it brings its own gap) — clear and delete in one: the tabs with cards delete the selection, or everything when nothing is selected (an undoable step; with everything gone, Ctrl + Z still takes it back); the metadata editor the selected photo; the text tabs clear (and end the history); the PDF editor closes its PDF. Always there, dimmed with nothing to act on; a button turned off under the keys hands focus to the tab's first live button. One size in every tab: 37px tall (two lines of stats; some tabs' stats wrap on a phone and some don't), every button in it 26px, centred | `BoxRow` |
| **the panel open** | a panel opens from nothing / closes to nothing: height eases, content fades in from 10px up at 96% (the quality slider, image options) | `Collapse` |
| **the row slide** | a list row slides in from under the row above / out under it, the rows around it shifting (the source repo's list 3 rows / username boxes); grid items (the PDF pages, the image cards) pop instead | `MotionList` |
| **the button glide** | a row of buttons/controls never snaps: a button whose label changes eases its width, the others slide along | `FlipRow` |
| **the count** | numbers count to their new value (and up from 0 when they appear), their width easing | `Count` |
| **the tab push** | switching tabs: the old pane slides out sideways as the new one slides in (always 450ms, an interrupted slide too), the area easing to the new height; the tab outline slides along | `TabPanes`, `TabSwitcher` |
| **the pop** | pop-ups and toasts come in from 14px down at 95% scale and leave the same way; so do the PDF pages, the image cards, the bottom bar, the QR code and the camera picture | `Modal`, `Toast`, `MotionList`, `usePop` |
| **the glide to top** | a box easing shut: the page's bottom follows the content's bottom frame by frame, so no blank room opens below (a sudden shrink glides up instead); when everything fits on screen again it glides back to the top and stops scrolling until it needs to | `App.jsx` |
| **the clear** | the last PDF pages / images leaving (or the PDF editor closing its PDF, or the metadata editor its photo): they pop out in place while the box's content holds its height, then the box goes back to empty | `PdfTools.jsx`, `ImageConverter.jsx`, `PdfEditor.jsx` |

The image converter holds two tools under its own small switcher (like the QR
tab's make / scan, the tab push): **converter** and **metadata editor**. The
metadata editor changes a photo's details (EXIF) in the file itself
(`src/exif.js`, JPG / PNG / WEBP): the picture's bytes are copied untouched,
and every tag is kept as its raw bytes, so whatever isn't changed goes back
exactly as it was (Apple's maker notes, tags it doesn't know, the preview).
Nothing of ours is ever stamped in (no Software tag, no new dates): a photo
from an iPhone still says that iPhone took it. Fields shown: the usual ones
always (ready to fill in), the rest only when the photo has them; emptied
means removed; XMP / IPTC can be dropped whole. The converter carries the
original's details into its JPG / PNG / WEBP copies ("keep details", on by
default; redrawn, a copy had none and looked saved from the web), the turn
reset to upright, the size the new one, the old preview left out. Under the
switcher the converter's box leaves 466px (`--box-room` on `.image-panes`).
The metadata editor uses the converter's box, grid and cards (several
photos; picture, label row, ‹ › ×), popping in and out and clearing the same
way. One photo is selected at a time (tap its card): the details below are
its own, kept per photo while you switch: the whole details box (border and
all, each with its own scroller) is one item in a `MotionList`, so it swaps
the way the cards do (the old box pops out in place as the new pops in; a
fade alone snapped and flashed). The last photo gone, the details do the clear:
the box pops out in place while its space holds (its height remembered from
the last frame it was there: by then the list measures nothing), then the
panel eases shut, and only then is the space let go (shut at once it cut the
box off, 309px to 20 in a frame; let go as it started, it jumped first). Their ids carry the
photo's id (both are on screen mid-swap). Save
writes every photo with its own changes (one as itself, several in a zip);
one that can't be saved is selected and named. Its add / save buttons sit under the details,
as in the converter; the details are one fixed-size box that scrolls inside
(`.meta-fields-inner`), so opening it slides the buttons a box's height (a
page of rows threw them ~1000px in 450ms). Its thumbnails wait for `whenStill()`. A row's
remove button shows only while its box has something in it: it slides open as
you type and shut when the box empties (the word slide, `SlideText`, with its
own 6px gap so an empty box reaches the row's end); reset puts values back.

PDF tools and the image converter are the same layout (and the PDF editor
shares their box, its pages popping in and out the same way): one box size (the
screen minus `--box-room`, ~410px) that scrolls inside so the page stays still,
the same cards (picture, label row, small buttons; tap to select, several at
once), the same buttons, and the same box row. Keep them matching. Each has
its description above the box (always the same words) and a stats line right
under it (the middle of the box row) that's always there, label first so only the numbers change, counting
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
  goes; each step the full 450ms, not halves) — never old and new words at once (a cross-fade, or the patch's
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
  (`src/inkWorker.js`, Sauvola's local threshold — the average and spread
  around each pixel, window ~1% of the page — off the page's thread; the old
  "darker than the average by 10" turned a noisy page's paper into specks:
  58% of words read on test scans, now 99.5%), read whole;
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
  A read line's colours come from the sharp scan it was read from, not the
  page on screen (small print's ink came out grey); a line already changed
  isn't re-worded by a later re-read. Letters and numbers mixed up inside a
  word are put right by the rest of it (`tidy`: "1O5" → "105", "C0MPANY"
  → "COMPANY").
  Fixed-width print (Courier) is told from one letter to the next
  (`monoByPitch`: in a fixed-width font the step between letters' middles
  never changes; in a proportional one it follows the letters' Helvetica
  widths), falling back to word widths when the letters can't tell (most
  capitals). A read line is sized by its font's capital height
  (`capHeightOf`; fixed-width also by its length, 0.6em a letter). A
  stand-in narrower than the original by over 6% is letter-spaced, not
  stretched (`fitWidth`: CSS `letter-spacing`, PDF `Tc`) — stretched, a
  letter-spaced typed name went fat and squat.
  Bold print is found by stroke thickness for its height against the page's
  usual (`strokeOf`); Courier only when word widths fit fixed-width letters
  better than proportional ones (a few plain words passed by letter count).
- Searchable scans' invisible words (`3 Tr`) are cut on save but the line
  keeps its patch: the picture's words are still there.
- Letter-spaced words that pdf.js reads as "T r a c k e d" are joined; a
  space placed on its own carries the line on (wide word spacing).
- Right-to-left lines (Hebrew) are written in drawn order (`visualOrder`),
  keeping their right end; Arabic needs shaping and isn't handled.

Undo / redo, the same in every tab (`src/useHistory.js`): the tab's state
kept as whole snapshots; typing in one box is one step per burst (same
group within 1s); Ctrl + Z / Ctrl + Shift + Z (or Ctrl + Y) while the tab is
open (`useUndoKeys`; text tabs take them in their boxes too, the browser's
own undo broke on text set by a conversion). What an undo can bring back
(an image, a page's file and picture) is let go only once no undo or redo
can reach it. PDF tools
keeps page pictures apart from the pages (id → url), so a snapshot taken
before a picture was drawn still shows it.

Which buttons go where:
- Under the box: getting things in and the result out (add / paste, save,
  copy, convert), always there (dimmed with nothing to act on), acting on
  the whole tab (or the first item when none is picked). No button is
  filled (no black "main" button anywhere): all are the same plain button,
  outlined only while switched on. Order: the input button first, then
  what changes things (split), then the saves, then copy: case converter
  and text diff paste; QR make paste (above the error level), and under
  the code save PNG · save SVG · copy; image converter add · save PNG (its
  format, the word swap) · copy; metadata editor add · save photos; PDF
  tools add · split · save PDF ("save merged PDF" with several files) ·
  save PNG; PDF editor add text · find text, then open · save PDF; QR scan
  choose image · use camera. The case converter's buttons are fixed rows,
  the same on every screen (`.button-rows`): paste · lowercase · UPPERCASE /
  Title Case · Sentence case / camelCase · snake_case / kebab-case · tidy
  spaces.
- A button gone green (done: copied, saved) stays green under the pointer
  (no black hover border), and nothing else flashes with it (the case
  converter's box no longer gets the black outline flash).
- The box row, right under the box: undo · redo | the stats | the trash
  (see the box row above).
- No select all: tap cards to select; the trash takes the selection (or
  everything). Tools switched on and off are buttons under the box,
  outlined while on ("keep details"; the PDF editor's add text · find text,
  a row of their own above open · save PDF). The bottom bar is only text
  diff's swap.
- Settings that change the result (format, size, quality, the QR error
  level, text diff's lines / words) sit in the tab's options panel (the
  panel open, opening once there's something in the box), above the buttons.
- A picture's own controls stay on it as symbols: the card buttons
  (‹ › ⟲ ⟳ ×) and the PDF editor's zoom − / +.
- A button is either words or one icon, never both; the getting-file verb
  is always "save" (never "download"). Icons only where the symbol is
  universal: the input buttons (paste, add images / photos / PDFs, open a
  PDF, choose image), copy, undo / redo, the trash, text diff's swap (⇄),
  and the corner keyboard-shortcuts button; each has a title and
  aria-label. Everything else is words (save, split, reset, add text, find
  text, use camera, the cases). Every save button is "save" and what
  it saves, never "save as": file types in capitals (save PDF, save PNG,
  save SVG, save JPG), else the thing (save photos).

Text diff's description ("paste two texts to compare")
sits above its boxes like every tab's; its stats line is always there
("added 0 · removed 0").

A tab switch starts one glide of the page on the curve from its first
frame (`tabGlide` in App.jsx), to where the page belongs once the new tab's
height lands; followed frame by frame from the resizes, it jittered on
iPhone and seemed to scroll up before the tabs moved.

The selected outline is the instagram repo's selected row: 1px border and
a 1px ring in the text colour (pure white in the dark), easing in and out
over 450ms.

Every stats line in the app is label first ("characters 3 · words 1", "added 2 ·
removed 1") so only the numbers change, counting.

The engine's "too small to move" cut-off is per kind of value: half a pixel for
sizes and slides, 0.002 for scale and opacity (a half-unit cut-off skipped
every 95% ↔ 100% scale).

Buttons are always `--button-gap` (6px, the instagram repo's) apart: button
rows, the settings row, the box row, the bottom bar, card buttons, the zoom controls.

Spacing down a tab, the same everywhere (measured in every tab):
- 6px: between buttons, and between rows of one group (the case
  converter's rows, the PDF editor's add text · find text over open · save
  PDF, the rows inside an options panel, find and replace).
- 10px: under a box to what belongs to it (the box row, the box below
  it in text diff), and the description to its box; a text line under
  controls (the QR level's hint).
- 20px: between groups (the box row to the buttons or an options panel,
  the panel to the buttons, the buttons to a result box). Never fix a
  gap with margins on a panel that opens: they only count while it's
  drawn, so everything under it jumped 4px as find opened / shut (a panel
  clips only while it moves, so it needs no room for focus rings).

On a phone every tab fits the screen empty, without scrolling (checked
at 375 × 667, 390 × 844 and 430 × 932): the page ends 24px under its last
button (it kept 140px for a bottom bar on every tab and scrolled for it);
text boxes take what the screen has left (the case converter's
`calc(100dvh - 340px)`, text diff's two `clamp(120px, 25dvh, 200px)`, QR
make's 112px, its code `--qr-size`). Only what opens below (results,
details, options) scrolls. The case converter never scrolls the page
(`html.no-scroll` while it's open, on screens 480px+ tall: a phone on its
side still scrolls to reach the buttons); its text scrolls inside its box,
which goes down to 120px to fit.

Rules that keep it smooth (each was a real bug):
- The page coming back into view (another app, the tab switcher) draws with
  transitions off for two frames, and so does a light / dark change (the
  inline script in `index.html`): iOS flips the scheme to snapshot the app,
  and every colour eased back as you returned — a flash. Fonts are served
  from the service worker's cache first (a reloaded page drew the stand-in
  font, then swapped).
- The metadata editor's rows are all one size: its value boxes are drawn by
  us (`appearance: none`), not iPhone's own date / choice boxes, and an
  empty box has no remove button at all (it slides in as you type). No example
  placeholders (grey "Apple" read as the photo's own value).
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
- The camera, stopped, keeps its last frame while it pops out (paused);
  its tracks stop once it's gone (stopped at once, it went black and
  seemed to snap away before the box eased shut).
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

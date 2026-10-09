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
| **the box row** | the row right under every tab's box (QR make: under its text box): **undo · redo** on the left, the tab's **input and action icons** in the middle, centred under the box (`actions`: paste / add / open, then copy, split, add text, find), and the **trash** on the right (red icon), with the tab's own buttons sliding in just left of it (`end`: the metadata editor's **reset**, there only while the selected photo has something to put back — the word slide, as "px wide"; it brings its own gap) — clear and delete in one: the tabs with cards delete the selection, or everything when nothing is selected (an undoable step; with everything gone, Ctrl + Z still takes it back); the metadata editor the selected photo; the text tabs clear (and end the history); the PDF editor deletes the selected line (the last one tapped, outlined once it's not being typed in: a new line goes, the PDF's own words are covered — one undo step; a tap on the page itself selects nothing), and with no line selected closes its PDF. The selected line also has its own delete button, a small red trash just above its start (`LineDelete`, the pop; pressing it keeps the keys in the line's box, so it goes in one step, not saved first). The stats line goes under the row (`children`), 10px below it. Empty (`empty`: nothing uploaded / typed yet; not the case converter, which stays as it is): only the input button shows — undo · redo and the trash fade out in place (back once there's something; emptied — the last image deleted — it looks as it did at first, and Ctrl + Z still brings it all back), the action icons slide shut beside it (the word slide), the stats fade out in place, keeping their line (opacity only: opened as a panel — height eased, text scaled, numbers counting — they stuttered on a phone as the first document came in), the saves close up (the panel open) (and QR make's copy / saves until there's a code). The input button shows its word with its icon while the box is empty ("add images", "add photos", "add PDFs", "open PDF", "paste"; `btn-grow`; the case converter's "paste" keeps its word always), and the word slides shut into the 40px icon with the first upload / letter (the word slide), opening again when it empties. Always there, dimmed with nothing to act on; a button turned off under the keys hands focus to the tab's first live button. Every button in it one size (36px; icons 40px wide so three fit between the sides on a phone); both sides as wide, so the middle is the box's middle; 10px under the box | `BoxRow` |
| **the panel open** | a panel opens from nothing / closes to nothing: height eases, content fades in from 10px up at 96% (the quality slider, image options) | `Collapse` |
| **the row slide** | a list row slides in from under the row above / out under it, the rows around it shifting (the source repo's list 3 rows / username boxes); grid items (the PDF pages, the image cards) pop instead | `MotionList` |
| **the button glide** | a row of buttons/controls never snaps: a button whose label changes eases its width, the others slide along | `FlipRow` |
| **the count** | numbers count to their new value (and up from 0 when they appear), their width easing | `Count` |
| **the tab push** | switching tabs: the old pane slides out sideways as the new one slides in (always 450ms, an interrupted slide too), the area easing to the new height; the tab outline slides along | `TabPanes`, `TabSwitcher` |
| **the pop** | pop-ups and toasts come in from 14px down at 95% scale and leave the same way; so do the PDF pages, the image cards, the QR code and the camera picture | `Modal`, `Toast`, `MotionList`, `usePop` |
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
writes every photo with its own changes (each as itself, never a zip);
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
its colours are taken from that sharp copy, not the blurry page on screen. A
picture's line Tesseract isn't sure of (< 90) is read again as close-ups
(48, 32 and 72px letters as drawn, 48px black on white) and the readings
vote letter by letter (`votedReading`: lined up against the one most agree
with); then a header label one letter off is put right (`headerLabel`:
"Ta:" → "To:"). On test headers of 8 / 9 / 10px text this took the letters
read right from 90 / 93 / 98% to 93 / 95 / 100% (the address exact at
10px). Drawing the picture smaller (60 or 40px) read worse.

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
- Find and replace never minds case (no "Aa": "google" marked only the one
  lowercase address on a Google receipt), nor accents, ligatures, curly
  quotes, dashes or odd / extra spaces; in words read off a picture or a
  scan, not Tesseract's mix-ups either (0 / O, 1 / l / I / |, rn / m, vv /
  w, dropped spaces). `src/findText.js`: each folded letter keeps where it
  came from, so replace all swaps exactly the matched stretch; its count is
  "· matches N" sliding into the stats line while it's open.
- Double-click an empty spot (or tap one with "add text" on) to add a line,
  in the size and font of the nearest line; left empty, it goes again.
- "add text" opens its own panel (the panel open; one panel at a time with
  find: the open one shuts first, then the other opens, `openPanel`, Ctrl + F
  too): one row of the font menu · match · bold · italic. The font menu is
  the instagram repo's import files menu (`FontMenu`): a button naming the
  font with a chevron that turns over, and a card popping in under it (the
  pop) listing every font in itself, grouped sans / serif / mono — auto (the
  nearby line's), the three standard PDF fonts, and free ones kept in
  /fonts/ (`src/textFonts.js`: Arial (Arimo), Inter, Roboto, Open Sans,
  Lato, Montserrat, Poppins, Georgia (Gelasio), Merriweather, Lora,
  Playfair, Garamond, Roboto Mono, Source Code; cut to Latin, ~25KB a
  style, fetched the first time they're shown, kept by the service worker,
  never precached). A font's file is loaded before a line takes it (never
  measured in the stand-in); saved, it's written into the PDF (fontkit,
  just the letters used). A tap anywhere else or Escape shuts the menu;
  picked by a tap, the keys stay in the line being typed. Match, bold and
  italic are icons (match a
  pipette, switched on and off, outlined while on: the line takes
  the look of the page's own line nearest where it is — font, size, bold /
  italic, ink — and covers what's under it in the colour around it, so it
  sits in like the PDF's words; `style.match` with the nearby line's look
  in `style.like`), size (− box +,
  taken on Enter / leaving it) and move (← ↑ ↓ →, Shift 10pt; held, an
  arrow keeps moving the line — after 0.4s, faster the longer it's held —
  shown as a drag is and one undo step once let go; or drag the line on
  the page, or arrow keys on it). It works on the new line being
  typed, or the last one added / tapped (outlined); with none, it sets the
  look the next new line starts with (and each new line starts in the look
  last chosen). The look is the line's `style` in its change
  ({ font, bold, italic, size, move: [right, up] }), drawn through
  `styled()` on screen and in the save alike, so they can't disagree; a
  change of look is one undo step (a drag one step, once let go), kept with
  the words while typing. Its buttons don't take the keys from the line being
  typed (desktop); a new line that lost them to the panel while empty isn't
  dropped. New lines cover nothing unless matched, on screen as in the PDF
  (moved, a patch showed as a box). A font other than the nearby one's, or bold / italic it
  hasn't, is a standard font (Times-Bold and so on).
- Pictures open too (the open button and dropping / pasting take any image
  the browser can show: JPG, PNG, WEBP, HEIC…): made a one-page PDF the
  picture's shape, A4's long side, drawn upright (`pictureToPdf`), then
  read as a scanned page.
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
  then read again as close-ups (the page as drawn at 48, 32 and 72px
  letters, and black on white at 48) and the five readings vote letter by
  letter (`rereadLine`, `votedReading`, as for pictures), updating the line
  in place unless it's being changed. On a blurred, tilted, grey photo of a
  receipt this took the lines read exactly from 6 of 9 (the best whole
  reading kept "Cappuccing", "4.235", "JIE" for 1.18) to 9 of 9.
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
  space placed on its own carries the line on (wide word spacing) — not one
  over 1.5em wide: that's pdf.js spanning a column's gap (a table's label
  to its value), and carried over it, label and value were one line.
- A line's ink is the PDF's own fill colour, not the drawn page's pixels
  (`picturesOf` follows the page's text commands — where each run starts,
  moved on by its letters' widths — and each line takes the colour of the
  run starting at it: small print sampled paler). The background is still
  read from the page.
- An address read off a picture or a scan is put back together
  (`tidyAddress` in ocr.js): a known mail host a letter or two off
  ("gmall", "gaagle") before something read as "com" (" cam") becomes
  "@host.com", the "@" replacing what was read in its place ("gi", "fi",
  "id"; none added where nothing was), "noreply" put right. On the test
  headers the letters read right went from 91 / 93 / 99% to 98 / 98 / 100%
  (8 / 9 / 10px).
- Words in annotations are lines to change too (`annotItems`): a filled-in
  form field, a text box added in Preview / iPhone Markup — pdf.js leaves
  them out of the page's text (a receipt's number and memo, typed into its
  fields, couldn't be tapped). Their lines, start and size come from
  pdf.js's `textContent` / `textPosition` / `defaultAppearanceData`; saved
  changed, the annotation comes off the page (`dropAnnot`; a field's only
  box takes the field with it) and the words are written in its place, its
  unchanged lines written back as they were.
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
  copy, convert); with nothing in the box only the input button (paste /
  add / open) is there, the rest comes in with the first upload, acting on
  the whole tab (or the first item when none is picked). No button is
  filled (no black "main" button anywhere): all are the same plain button,
  outlined only while switched on. The input and the action icons sit in
  the box row's middle (input first); the saves (words) are their own row
  under the stats (and any options panel). Image converter add · copy, then
  save PNG (its format, the word swap); metadata editor add, then save photo
  ("s" slides in from the second photo, the button easing wider); PDF tools
  add · split (scissors), then save PDF ("save merged PDF" with several
  files) · save PNG; PDF editor open · add text · find (switched on and
  off, outlined while on), then save PDF; QR make paste, and under the code
  copy / save PNG · save SVG; case converter paste; QR scan
  (no box row) choose image · use camera. The case converter's buttons are fixed rows,
  the same on every screen (`.button-rows`): lowercase · UPPERCASE /
  Title Case · Sentence case / camelCase · snake_case / kebab-case · tidy
  spaces.
- A button gone green (done: copied, saved) stays green under the pointer
  (no black hover border), and nothing else flashes with it (the case
  converter's box no longer gets the black outline flash).
- The box row, right under the box: undo · redo | the input and action
  icons | the trash, the stats under it (see the box row above).
- No select all: tap cards to select; the trash takes the selection (or
  everything). Tools switched on and off are buttons under the box,
  outlined while on ("keep details"; the PDF editor's add text and find). There's no bottom bar
  (text diff, the last tab with one, was removed).
- Settings that change the result (format, size, quality, the QR error
  level) sit in the tab's options panel (the
  panel open, opening once there's something in the box), above the buttons.
- A picture's own controls stay on it as symbols: the card buttons
  (‹ › ⟲ ⟳ ×), the PDF editor's zoom − / + and the trash over its selected line.
- A button is either words or one icon, never both (except the input button
  while its box is empty: icon and word, shutting to the icon); the getting-file verb
  is always "save" (never "download"). Icons only where the symbol is
  universal: the input buttons (paste, add images / photos / PDFs, open a
  PDF, choose image), copy, undo / redo, the trash,
  split (scissors), the PDF editor's add text and find (magnifier), its
  panel's match (pipette) · bold · italic, and the
  corner keyboard-shortcuts button; each has a title and aria-label.
  Everything else is words (the saves, reset, use camera, the cases). Every save button is "save" and what
  it saves, never "save as": file types in capitals (save PDF, save PNG,
  save SVG, save JPG), else the thing (save photos).

A tab switch starts one glide of the page on the curve from its first
frame (`tabGlide` in App.jsx), to where the page belongs once the new tab's
height lands; followed frame by frame from the resizes, it jittered on
iPhone and seemed to scroll up before the tabs moved.

The selected outline is the instagram repo's selected row: 1px border and
a 1px ring in the text colour (pure white in the dark), easing in and out
over 450ms.

Every stats line in the app is label first ("characters 3 · words 1", "pages 0 ·
files 0") so only the numbers change, counting.

The engine's "too small to move" cut-off is per kind of value: half a pixel for
sizes and slides, 0.002 for scale and opacity (a half-unit cut-off skipped
every 95% ↔ 100% scale).

Buttons are always `--button-gap` (6px, the instagram repo's) apart: button
rows, the settings row, the box row, card buttons, the zoom controls.

Spacing down a tab, the same everywhere (measured in every tab):
- 6px: between buttons, and between rows of one group (the case
  converter's rows, the icon row over the save row, the rows inside an options panel, find and replace).
- 10px: under a box to what belongs to it (the box row), and the description to its box; a text line under
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
`calc(100dvh - 360px)`, QR
make's 112px, its code `--qr-size`). Only what opens below (results,
details, options) scrolls. The case converter never scrolls the page
(`html.no-scroll` while it's open, on screens 480px+ tall: a phone on its
side still scrolls to reach the buttons); its text scrolls inside its box,
which goes down to 120px to fit.

Rules that keep it smooth (each was a real bug):
- A motion's clock starts on the first frame it's drawn in (the engine's
  pieces start at `null`, set by its next frame), not when it's asked for:
  the change that asks for it (cards added, a tab's buttons coming in) makes
  that frame slow, and timed from the ask the motion had run a quarter of
  its way by the first frame shown — it jumped, then eased. Motion asked
  for later in a frame the engine already stepped (a ResizeObserver: a
  row's button glide) starts on that same frame (`frameTime`): a frame
  behind the word sliding beside it, the centred row wobbled.
- Nothing scans a row's whole insides per frame: "is anything in here
  easing its width?" asks the engine's few moving things (`widthMovingIn`);
  `querySelectorAll('*')` on every button every frame took ~90ms of a slide
  on a phone. A row watching itself rewrap reads its buttons' spots in a
  ResizeObserver (after layout, free), not each frame after the engine
  wrote styles (a forced layout per frame); `FlipRow` toggles inline widths
  to measure only when one is set.
- No heavy drawing on every keystroke: QR make's code is drawn on screen at
  4px a square (scaled up crisp), the 1024px PNG only made to save / copy
  (drawn at 1024px per letter, it took most of a frame as buttons slid in).
- `prefersReducedMotion` keeps one media query (asked anew every motion).
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
- Focus handed on (a button gone under the keys: the trash emptying the
  box) goes to the first live button that isn't hidden away (`[inert]`,
  `aria-hidden`): sent to undo as it faded out, it was dropped to the page.
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
- Heavy work on the page's thread (a thumbnail, a picture's colours, the
  PDF editor's sharper redraw and scan reading) waits for `whenStill()`
  (engine.js) so it can't stall a frame mid-motion; it first looks a frame
  on (asked at once, the cards just set to come in hadn't started, and a
  PDF's first page was drawn as its card popped in). A list measures
  everything before it moves anything. The PDF editor decodes its first
  pages' pictures before showing them (decoded at first paint, that frame
  took ~100ms as its buttons and stats came in).
- Opacity-only fades that need no following (the box row's sides, the
  stats) stay CSS transitions: the phone's compositor runs them through a
  busy page thread, where an engine fade would stall.
- Keyboard focus always shows (`:focus-visible`, 2px outline); text fields
  show theirs with their border.
- The PDF editor's zoom keeps the point under the fingers on the same spot
  of the same page (the space between pages doesn't scale); only pages near
  the view are redrawn sharper; a new PDF opens at the top, at 100%.

Files out and updates:
- Every save button saves through `saveFiles` (utils.js): the share sheet
  (Save to Files, AirDrop, any app) with every file as itself — several
  images, photos, split pages or page PNGs are that many files, never a
  zip; where a browser can't share files, each one is downloaded. A browser
  opens the sheet only just after a tap: a save that took longer (several
  images converted, a PDF built) shows a "ready to save" pop-up, and one
  more tap opens it. Cancelled, a button doesn't turn green.
- PDF tools: every page of one file → that file rearranged in place (forms,
  outline stay); otherwise each file's pages copied in one go (shared fonts
  and pictures once). Pages left out are never kept in the file.
- The service worker serves /assets/ (hashed) from its cache first, never
  lets a 404 or a web page replace a good copy, keeps the previous build's
  cache for open tabs, and keeps cmaps / OCR files in `toolbox-runtime`.
  `loadLibrary` reloads only when the app really changed (never offline,
  never while saving).

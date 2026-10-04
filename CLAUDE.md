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
| **the bulk bar** | PDF tools' and the image converter's select/delete/clear: the instagram repo's bulk bar (count outlined, plain buttons, delete red), where it sits there too: floating at the bottom of the screen (18px up), centered; it pops in like the pages when its tab is showing and there's more than one page/image | `BulkBar` |
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
picture's background colour. The picture is redrawn from the PDF just for the
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
- Double-click an empty spot (or tap one with "add text" on) to add a line,
  in the size and font of the nearest line; left empty, it goes again.

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

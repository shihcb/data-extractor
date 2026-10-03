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
| **the pop** | pop-ups and toasts come in from 14px down at 95% scale and leave the same way; so do the PDF pages and the image converter's image cards | `Modal`, `Toast`, `MotionList` |
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

Rules that keep it smooth (each was a real bug):
- A row/box measures positions against itself (`position: relative`), never
  against something that moves with the boxes above it.
- Nothing is measured while hidden (a closed panel measures 0px).
- A leaving copy is hidden before its motion styles are dropped.
- Heavy work (encoding an image) never runs on the page's thread while
  something moves (the size estimate runs in `estimateWorker.js`).
- Text being clipped while it resizes must not change its baseline.

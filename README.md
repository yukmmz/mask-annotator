# mask-annotator

*English / [日本語](README_ja.md)*

**Open the app**: https://yukmmz.github.io/mask-annotator/

A **pixel-mask annotation tool that runs entirely in the browser** (a static web app), built for iPad / Apple Pencil.
For a chronophotography (multiple-exposure style compositing) pipeline, you paint regions such as the robot or a box
with a brush to extract them. It is the iPad counterpart of the desktop tool `annotate_robot_mask.py`.

## Features

- **Fully client-side**: images are processed only inside the browser. Nothing is sent to GitHub or any server.
- **Apple Pencil support**: draw with the pen, zoom/pan with your fingers (with palm rejection).
- **Smart brush**: grows from where you stroke into connected regions with a similar difference, and fills holes inside
  (a JS port of `select_region` from `annotate_robot_mask.py`; needs a background image).
- **Autosave**: saved to IndexedDB. You can resume on the same iPad even after closing Safari.
- **Resume from ZIP**: load an exported mask ZIP and continue from there (another iPad or browser,
  a continuation made with `annotate_robot_mask.py` on a Mac, or masks received from someone else).
- **Copy previous mask**: for neighbouring frames with nearly the same shape, copy the previous frame's mask and
  align it by moving and rotating → after confirming, fine-tune it with the brush.
- **Outside selection (lasso)**: turn on "Outside" and circle an area with the Pencil to ADD/REMOVE everything
  outside it at once (e.g. REMOVE to "keep only what you circled"). Undo reverts it.
- **Output**: exports `<frame>_<object>_mask.png` + `manifest_<object>.json` as a ZIP.
- **Japanese / English**: switch in ⚙ (settings) at the top right (the first visit follows the browser language). Output file names and the manifest are the same regardless of language.
- **Settings (⚙)**: language, share (QR codes: app URL / source URL), changelog, other apps, clear saved data.
  ⛶ toggles full screen.
- **How to use (?)**: the ? button at the top right (or the `?` key) opens a window summarising the basic flow, the tools and iPad notes.

## How to use

1. **Prepare the images** (on the Mac): put a few keyframes (`frame_*.png`) and one background in iCloud Drive or similar.
   - Background = the last frame of the extraction folder (or a median plate). Used to compute differences.
   - `scripts/experiments/export_for_ipad.py` in the parent repository can export them all at once
     (`frame_*.png` + `background_<stem>.png` into `ipad_pack_<stem>/`).
2. **Open on the iPad**: https://yukmmz.github.io/mask-annotator/ ("Add to Home Screen" recommended).
3. Select several keyframes with "Load images" → choose `background_<stem>.png` with "Background".
   - The **pack name (`<stem>`) is taken automatically from the background file name** (you can also edit it in the field at the top).
     The pack name is used for the ZIP file name and the storage namespace (IndexedDB), preventing clashes with other datasets.
4. **Enter the object** (required, free text; robot/box/mech/wing are suggested; letters, digits, `_` and `-` only).
   Until it is entered, you cannot create masks or export a ZIP (the field turns red). Once entered, paint with the Apple Pencil
   (adjust brush/similarity/reach with the sliders at the top).
   - `ADD/REMOVE` toggle, `Undo`/`Clear`, `◀▶` to move between frames.
   - `reach=0` gives only "what you painted + holes inside" (no difference-based growth).
5. "Export ZIP" → save `<pack>_<object>_masks.zip` to Files → unzip it on the Mac into `brush_masks/`.
6. Composite on the Mac: `compose_robot_gui.py --mask-dir brush_masks/`.

Paint robot and box separately by switching the object, and put both in the same ZIP/folder
(the manifest is per object: `manifest_robot.json` / `manifest_box.json`).

### About objects

Besides `robot` / `box`, the object selector has **`mech` (links)** / **`wing`** for the flapping-mechanism research.
The lower layers (brush, saving, resuming, ZIP import/export) do not depend on the object name, so every object
is annotated with the same steps and outputs `manifest_<object>.json` + `<stem>_<object>_mask.png`.

#### Workflow for the flapping mechanism (mech / wing)

Flapping is filmed against a **black background**. Links = white, wings = yellow (semi-transparent).

- **Background**: use a **median plate** of the black background (`export_for_ipad.py --background median`
  in the parent repository outputs `frame...JPG` + `background_<stem>.png` into `ipad_pack_<stem>/`.
  The pack name is taken automatically from the background file name).
- **mech (white links)**: background difference works, so trace them with the smart brush (similarity/reach) to extract them.
- **wing (yellow wings)**: the thin, whitish membrane is hard to pick up by background difference, so painting by hand
  with `reach=0` (only what you painted + holes inside) is the reliable way.
- Compositing (on the Mac) reads the per-object manifests (`manifest_mech.json` / `manifest_wing.json`).

### Resume from ZIP (continue where you left off)

Use this when you want to continue on the iPad with masks made on another device or the Mac.

1. As usual, "Load images" → choose "Background" and **settle the pack name** (resuming also happens after loading images).
2. Press **"Load masks"** and choose `*_robot_masks.zip` / `*_box_masks.zip` (several allowed).
3. It matches `manifest_<object>.json` and `*_mask.png` in the ZIP to frames by name, resizes them (nearest neighbour)
   to the current frame resolution, binarises them and applies them. robot/box can be imported in one go.
4. Keep drawing, and "Export ZIP" when done.

Notes:
- **If anything does not match, the import is aborted**: if a masked frame name in the ZIP matches none of the
  images currently loaded, it **writes nothing and aborts** for safety (no partial import).
  Load the same keyframes that were used to make the ZIP, then try again.
- The import **overwrites** existing masks for the same frame and object (that is what resuming means). Frames with
  `has_mask:false` (not annotated) are not imported and stay as they are.

### Copy previous mask (move/rotate and reuse)

In consecutive frames the mask shape often barely changes, so you can reuse the previous frame's shape.

1. Show the target frame (`◀▶`).
2. Press **"Copy previous mask"**. The previous frame's (`idx-1`) mask is overlaid as a cyan preview.
   - If the target frame **already has a mask, a confirmation dialog** appears (to avoid overwriting by mistake).
     It tells you "you can revert with Undo later", and only OK proceeds.
3. **Drag with the Apple Pencil = move**, **drag the ○ handle above the preview = rotate**
   (the same feel as PowerPoint / GoodNotes; the rotation centre is the centre of the mask's bounding box). Pinching with
   fingers zooms/pans the view.
4. **"Confirm"** burns it in as the current frame's mask (the previous state can be undone by one step with Undo). **"Cancel"** discards it.
5. After confirming, it is treated exactly like a hand-painted mask and can be adjusted with the **ADD/REMOVE brush, Undo and Clear**.

While in move/rotate mode, frame navigation, object switching, ZIP export/import and Undo/Clear are temporarily
blocked to prevent mistakes (the status shows "Confirm or cancel first").

## Run locally and test

```bash
python3 -m http.server 8000                       # local check (http://localhost:8000)
for t in tests/test_*.js; do node $t; done        # unit tests (from the repository root)
```

## Saved data

- In-progress masks are saved automatically in this browser's **IndexedDB** (per pack), so you can close Safari and resume on the same iPad.
- The language and the last-seen version are kept in **localStorage** (keys starting with `mask-annotator/`).
- Nothing is sent to a server. To move work to another device, use "Export ZIP" and "Resume from ZIP".
- To erase everything, use **⚙ → Clear saved data** (in-progress masks are erased too).

## Output format (the contract with the parent pipeline)

```
manifest_<object>.json:
{ "object": "robot", "long_side": 1600, "mask_size_hw": [H, W],
  "frames": [ { "file": "frame_000030.png",
                "mask": "frame_000030_robot_mask.png", "has_mask": true }, ... ] }
```
Mask PNGs are 255 = object / 0 = background. The compositing side reads them with a nearest-neighbour resize to the
keyframe resolution, so a slightly different resolution is fine.

## Files

| File | Role |
|---|---|
| `index.html` | Layout and toolbar |
| `style.css` | Styles (disabling touch gestures, etc.) |
| `brush.js` | Core equivalent of `select_region` (pure functions, testable with node) |
| `mask_io.js` | Pure functions for ZIP import (manifest parsing, binarising; testable with node) |
| `mask_transform.js` | Pure functions for rigid mask transforms (move + rotate): inverse warping, rotation-handle position (testable with node) |
| `app.js` | UI, input/output, state, IndexedDB, ZIP export/import, copy previous mask, settings |
| `i18n.js` | Japanese/English switching (the same file shared by every app on yukmmz.github.io) |
| `strings.js` | UI strings (Japanese/English) and the changelog `CHANGELOG` |
| `tests/test_brush.js` | node unit tests for `brush.js` (`node tests/test_brush.js`) |
| `tests/test_mask_io.js` | node unit tests for `mask_io.js` (`node tests/test_mask_io.js`) |
| `tests/test_mask_transform.js` | node unit tests for `mask_transform.js` (`node tests/test_mask_transform.js`) |
| `tests/test_strings.js` | Checks that Japanese/English string keys match and that the changelog matches `APP_VERSION` (`node tests/test_strings.js`) |

## Version history

The version is shown as `vX.Y.Z` next to the app name at the left end of the top toolbar; tapping it opens the changelog.
The single source of truth is `APP_VERSION` in `app.js`. When you bump it, also update the top of `CHANGELOG` in `strings.js` and this list (in both README.md and README_ja.md).

- **v1.2.0** — "?" button at the top right (a How to use window; the `?` key opens it too)

- **v1.1.0** — Common UI (the same as the other apps on yukmmz.github.io)
  - App name + version at the top left (tap the version to open the changelog)
  - ⚙ Settings: language (日本語 / English), share (QR), changelog, other apps, clear saved data
  - ⛶ full-screen button
  - QR display moved from the "More ⋯" menu to "Share" in settings (⚙)

- **v1.0.0** — The first versioned public release, bringing together all the features so far.
  - Pixel-mask annotation (brush ADD/REMOVE, region selection by sim/reach, Undo)
  - Loading keyframes (`frame_*.png`) + background, Fit, frame stepping, collapsible chrome
  - Outside selection (lasso), copy previous mask (rigid transform: move + rotate)
  - Wing from 3 points (ellipse), Auto (link) automatic seed extraction, Diff view
  - ZIP export/import (resume), IndexedDB saving, manual pack (ZIP name) input
  - QR display (app URL / source repository URL)
  - App name + version shown at the right end of the top toolbar

## License / notes

MIT ([LICENSE](LICENSE)).

Contains only general-purpose brush annotation code — no research data or confidential information.
Served on GitHub Pages (public).

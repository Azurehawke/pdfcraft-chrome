# PdfCraft Viewer for Chrome

Makes [PdfCraft](https://github.com/Azurehawke/pdfcraft) the PDF viewer in desktop Chrome. PDF links,
typed PDF URLs and local `.pdf` files open in PdfCraft's web build instead of Chrome's built-in viewer.

## How it works

- `background.js` redirects top-level navigations to `*.pdf` URLs (and local `file://` PDFs) to
  `viewer.html#<original URL>`.
- `viewer.html` / `viewer.js` downloads the PDF with the site's cookies, loads PdfCraft from `app/`
  in an iframe (`?host=parent`) and hands the file over through PdfCraft's `postMessage` bridge.
  Saves come back through the same bridge and are written with a file picker (or a download).

## Setup

1. Build PdfCraft's web app (in WSL or Linux):

   ```sh
   rustup target add wasm32-unknown-unknown
   cargo install trunk --locked
   cd pdfcraft/apps/pdfcraft-web
   trunk build --release        # output: pdfcraft/dist/web
   ```

2. Install it into this extension:

   ```sh
   python3 tools/install_app.py ../pdfcraft/dist/web
   ```

   This copies the build into `app/` and moves Trunk's inline startup script into a file, since
   extensions can't run inline scripts. `app/` is not committed; rerun this after each PdfCraft build.

3. In Chrome, open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and
   choose this folder. If the folder lives in WSL, copy it to a Windows path first.

4. On the extension's **Details** page, turn on **Allow access to file URLs** so local PDFs open too.

After rebuilding PdfCraft, rerun step 2 and click the reload icon on the extension's card.

## Known limits (v0.1)

- Only URLs ending in `.pdf` are caught. Links like `/download?id=123` still go to Chrome.
- Some sites' cookies (`SameSite` strict) may not be sent, so a few logged-in PDFs may fail to load.
- Desktop Chrome only. Chrome on Android doesn't run extensions.

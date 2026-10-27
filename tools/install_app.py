#!/usr/bin/env python3
"""Copy PdfCraft's web build into app/ and make it loadable in an extension.

Usage: python3 tools/install_app.py <path to pdfcraft>/dist/web

Chrome extensions can't run inline <script> blocks, and Trunk puts the
startup code inline in index.html. This moves each inline script into its own
file (app/boot-N.js) and points index.html at it.
"""
import re
import shutil
import sys
from pathlib import Path

INLINE = re.compile(r'<script(?P<attrs>[^>]*)>(?P<body>.*?)</script>', re.S | re.I)


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__.strip())
        return 2
    src = Path(sys.argv[1]).expanduser().resolve()
    if not (src / 'index.html').is_file():
        print(f'No index.html in {src}. Point this at the web build (dist/web).')
        return 1
    app = Path(__file__).resolve().parent.parent / 'app'
    if app.exists():
        shutil.rmtree(app)
    shutil.copytree(src, app)

    index = app / 'index.html'
    html = index.read_text(encoding='utf-8')
    count = 0

    def extract(m: re.Match) -> str:
        nonlocal count
        attrs, body = m.group('attrs'), m.group('body')
        if re.search(r'\bsrc\s*=', attrs, re.I) or not body.strip():
            return m.group(0)
        count += 1
        name = f'boot-{count}.js'
        (app / name).write_text(body, encoding='utf-8')
        attrs = re.sub(r'\s(nonce|integrity)\s*=\s*"[^"]*"', '', attrs)
        return f'<script{attrs} src="./{name}"></script>'

    html = INLINE.sub(extract, html)
    index.write_text(html, encoding='utf-8')
    print(f'Installed {src} -> {app} ({count} inline script(s) moved out)')
    return 0


if __name__ == '__main__':
    sys.exit(main())

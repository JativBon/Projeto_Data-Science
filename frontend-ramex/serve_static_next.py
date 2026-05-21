from __future__ import annotations

import mimetypes
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import unquote, urlparse


BASE_DIR = Path(__file__).resolve().parent
OUT_DIR = BASE_DIR / "out"
APP_HTML = OUT_DIR / "index.html"
PUBLIC_DIR = BASE_DIR / "public"


class NextStaticHandler(SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        return

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = unquote(parsed.path).lstrip("/")

        out_candidate = OUT_DIR / path
        if out_candidate.is_file():
            return self._send_file(out_candidate)

        return self._send_file(APP_HTML)

    def _send_file(self, path: Path) -> None:
        try:
            resolved = path.resolve()
        except OSError:
            self.send_error(404)
            return

        allowed_roots = (OUT_DIR.resolve(), PUBLIC_DIR.resolve())
        if not any(resolved == root or root in resolved.parents for root in allowed_roots):
            self.send_error(404)
            return

        if not resolved.is_file():
            self.send_error(404)
            return

        content_type = mimetypes.guess_type(resolved.name)[0] or "application/octet-stream"
        data = resolved.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 3001), NextStaticHandler)
    print("Serving RAMEX frontend at http://localhost:3001")
    server.serve_forever()

#!/usr/bin/env python3
"""Local dev server that disables caching, so a normal refresh always
picks up the latest edits instead of serving stale JS/CSS from the
browser's HTTP cache (the plain `http.server` module doesn't send any
Cache-Control header, so browsers cache aggressively by default)."""
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    http.server.test(HandlerClass=NoCacheHandler, port=port)

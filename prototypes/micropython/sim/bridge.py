"""Bridge for the browser tests.

  ws://127.0.0.1:<ws-port>    one connection per FakePort.open(): binary frames are serial
                              bytes, text frames are JSON {t: baud|signals}
  http://127.0.0.1:<http-port>  serves prototypes/micropython/ (index.html and the library)
                              plus a control API for tests:
      POST /__sim/reset  {"firmware": "stage_a", "boot_ms": 300, "install_library": true,
                          "files": {"/main.py": "..."}}
      GET  /__sim/state  counters, flash file list, baud rates, jack output values
      GET  /__sim/file?path=/main.py
"""
import argparse
import asyncio
import importlib.util
import json
import os
import queue
import shutil
import sys
import tempfile
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from websockets.asyncio.server import serve

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.dont_write_bytecode = True
from board_sim import PROTO, Board  # noqa: E402

LIBRARY = {
    "/lib/tinkerbit/__init__.py": "lib/tinkerbit/__init__.py",
    "/lib/tinkerbit/board.py": "lib/tinkerbit/board.py",
    "/lib/ssd1306.py": "lib/ssd1306.py",
    "/boot.py": "boot.py",
    "/main.py": "main.py",
}


def _board_map():
    spec = importlib.util.spec_from_file_location("tb_board_map", os.path.join(PROTO, "lib", "tinkerbit", "board.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class Bridge:
    def __init__(self):
        self.loop = None
        self.tmp = tempfile.mkdtemp(prefix="tbsim-")
        self.count = 0
        self.board = None
        self.ws = None
        self.outq = None
        self.inq = queue.Queue()
        self.map = _board_map()
        self.lock = threading.Lock()
        threading.Thread(target=self._feeder, daemon=True).start()

    # Serial bytes and signal changes go through one queue so they keep their order;
    # host_write can block while the simulated board drains its stdin buffer.
    def _feeder(self):
        while True:
            board, kind, value = self.inq.get()
            if board is not self.board:
                continue
            if kind == "data":
                board.host_write(value)
            elif kind == "signals":
                board.set_signals(dtr=value.get("dtr"), rts=value.get("rts"))
            elif kind == "baud":
                board.set_host_baud(value)

    def reset(self, opts):
        with self.lock:
            if self.board is not None:
                self.board.shutdown()
            self.count += 1
            flash = os.path.join(self.tmp, "flash%d" % self.count)
            os.makedirs(flash)
            files = {}
            if opts.get("install_library"):
                for dest, src in LIBRARY.items():
                    with open(os.path.join(PROTO, src), encoding="utf-8") as f:
                        files[dest] = f.read()
            files.update(opts.get("files") or {})
            for dest, text in files.items():
                real = os.path.join(flash, *dest.strip("/").split("/"))
                os.makedirs(os.path.dirname(real), exist_ok=True)
                with open(real, "w", encoding="utf-8", newline="") as f:
                    f.write(text)
            board = Board(flash, firmware=opts.get("firmware", "stage_a"), on_output=self._out, boot_ms=opts.get("boot_ms", 300))
            board.dtr = board.rts = False
            self.board = board
            board.power_on()

    def _out(self, data):
        q, loop = self.outq, self.loop
        if q is not None and loop is not None:
            loop.call_soon_threadsafe(q.put_nowait, data)

    def state(self):
        b = self.board
        jacks = {}
        for name, spec in self.map.JACKS.items():
            gpio = spec["pins"].get("sig")
            if gpio is not None and gpio in b.pins:
                jacks[name] = b.pins[gpio]["value"]
        return {
            "firmware": b.firmware,
            "files": b.files(),
            "resets": b.resets,
            "boots": b.boots,
            "soft_reboots": b.soft_reboots,
            "paste_violations": b.paste_violations,
            "rx_overflow": b.rx_overflow,
            "uart_baud": b.uart_baud,
            "host_baud": b.host_baud,
            "mode": b.mode,
            "wifi_on": b.wifi_on,
            "jacks": jacks,
            "pwm_pins": len(b.pwm),
        }

    async def handler(self, ws):
        if self.ws is not None:
            await self.ws.close()
        q = asyncio.Queue()
        self.ws, self.outq = ws, q
        sender = asyncio.create_task(self._sender(ws, q))
        try:
            async for msg in ws:
                board = self.board
                if isinstance(msg, bytes):
                    self.inq.put((board, "data", msg))
                    continue
                m = json.loads(msg)
                if m.get("t") == "signals":
                    self.inq.put((board, "signals", m))
                elif m.get("t") == "baud":
                    self.inq.put((board, "baud", int(m["baud"])))
        except Exception:
            pass
        finally:
            sender.cancel()
            if self.ws is ws:
                self.ws, self.outq = None, None

    async def _sender(self, ws, q):
        while True:
            data = await q.get()
            await ws.send(data)


def make_http_handler(bridge):
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=PROTO, **kw)

        def log_message(self, *a):
            pass

        def _json(self, obj, code=200):
            body = json.dumps(obj).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def end_headers(self):
            self.send_header("Cache-Control", "no-store")
            super().end_headers()

        def do_GET(self):
            url = urlparse(self.path)
            if url.path == "/__sim/state":
                return self._json(bridge.state())
            if url.path == "/__sim/file":
                path = parse_qs(url.query).get("path", [""])[0]
                real = bridge.board.real_path(path)
                if not os.path.isfile(real):
                    return self._json({"error": "missing"}, 404)
                with open(real, encoding="utf-8") as f:
                    return self._json({"path": path, "text": f.read()})
            return super().do_GET()

        def do_POST(self):
            url = urlparse(self.path)
            length = int(self.headers.get("Content-Length") or 0)
            opts = json.loads(self.rfile.read(length) or b"{}")
            if url.path == "/__sim/reset":
                bridge.reset(opts)
                return self._json({"ok": True})
            return self._json({"error": "unknown"}, 404)

    return Handler


async def main(args):
    bridge = Bridge()
    bridge.loop = asyncio.get_running_loop()
    bridge.reset({"firmware": args.firmware})
    httpd = ThreadingHTTPServer(("127.0.0.1", args.http_port), make_http_handler(bridge))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    print("bridge: ws://127.0.0.1:%d  http://127.0.0.1:%d/index.html" % (args.ws_port, args.http_port), flush=True)
    try:
        async with serve(bridge.handler, "127.0.0.1", args.ws_port, max_size=None):
            await asyncio.Future()
    finally:
        httpd.shutdown()
        shutil.rmtree(bridge.tmp, ignore_errors=True)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--ws-port", type=int, default=8765)
    p.add_argument("--http-port", type=int, default=8766)
    p.add_argument("--firmware", default="stage_a", choices=["stage_a", "stage_b", "none"])
    asyncio.run(main(p.parse_args()))

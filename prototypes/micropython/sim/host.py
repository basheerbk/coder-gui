"""Host side of the serial protocol, in Python, for the simulator tests.

Mirrors what index.html does over Web Serial: raw REPL, raw-paste with flow control,
EN reset through RTS and serial safe mode.
"""
import threading
import time


class Timeout(AssertionError):
    pass


class Host:
    def __init__(self, board):
        self.board = board
        self.buf = bytearray()
        self.log = bytearray()
        self.cv = threading.Condition()
        board.on_output = self._on_output

    def _on_output(self, data):
        with self.cv:
            self.buf += data
            self.log += data
            self.cv.notify_all()

    def write(self, data):
        if isinstance(data, str):
            data = data.encode()
        self.board.host_write(data)

    def clear(self):
        with self.cv:
            self.buf.clear()

    def text(self):
        with self.cv:
            return bytes(self.buf).decode("utf-8", "replace")

    def read_until(self, token, timeout=5.0):
        if isinstance(token, str):
            token = token.encode()
        end = time.monotonic() + timeout
        with self.cv:
            while token not in self.buf:
                left = end - time.monotonic()
                if left <= 0:
                    raise Timeout("waited for %r, got %r" % (token, bytes(self.buf[-300:])))
                self.cv.wait(left)
            i = self.buf.index(token) + len(token)
            out = bytes(self.buf[:i])
            del self.buf[:i]
            return out

    def read_exact(self, n, timeout=5.0):
        end = time.monotonic() + timeout
        with self.cv:
            while len(self.buf) < n:
                left = end - time.monotonic()
                if left <= 0:
                    raise Timeout("waited for %d bytes, got %r" % (n, bytes(self.buf)))
                self.cv.wait(left)
            out = bytes(self.buf[:n])
            del self.buf[:n]
            return out

    def pending(self):
        with self.cv:
            return len(self.buf)

    # ---------------- raw REPL ----------------
    def enter_raw(self, timeout=5.0):
        self.write(b"\r\x03\x03\x03")
        time.sleep(0.05)
        self.clear()
        self.write(b"\x01")
        self.read_until(b"raw REPL; CTRL-B to exit\r\n>", timeout)

    def exec_raw(self, code, timeout=10.0):
        self.write(code.encode() + b"\x04")
        self.read_until(b"OK", timeout)
        return self._result(timeout)

    def _result(self, timeout):
        out = self.read_until(b"\x04", timeout)[:-1].decode("utf-8", "replace")
        err = self.read_until(b"\x04", timeout)[:-1].decode("utf-8", "replace")
        self.read_until(b">", timeout)
        return out, err

    def exec_paste(self, code, honor_flow=True, timeout=10.0):
        """Raw-paste mode. Returns (out, err), or None if the board does not support it."""
        data = code.encode()
        self.write(b"\x05A\x01")
        self.read_until(b"R", timeout)
        if self.read_exact(1, timeout) == b"\x00":
            return None
        w = self.read_exact(2, timeout)
        window = w[0] | (w[1] << 8)
        credit = 0
        i = 0
        while i < len(data):
            while credit == 0 or (honor_flow and self.pending()):
                if not honor_flow:
                    credit = len(data)
                    break
                c = self.read_exact(1, timeout)
                if c == b"\x01":
                    credit += window
                elif c == b"\x04":
                    self.write(b"\x04")
                    return self._result(timeout)
            n = min(credit, len(data) - i)
            self.write(data[i:i + n])
            i += n
            credit -= n
        self.write(b"\x04")
        while self.read_exact(1, timeout) != b"\x04":
            pass
        return self._result(timeout)

    def exit_raw(self):
        self.write(b"\x02")
        self.read_until(b"\r\n")

    def soft_reset_run_main(self, timeout=10.0):
        """Friendly-REPL soft reset: boot.py then main.py run (raw-REPL Ctrl-D skips main.py)."""
        self.write(b"\x02")
        time.sleep(0.05)
        self.clear()
        self.write(b"\x04")
        self.read_until(b"MPY: soft reboot\r\n", timeout)

    # ---------------- reset / recover ----------------
    def open_port(self, glitch=False):
        """What the page does on open: Chrome asserts DTR+RTS, the page drops both (RTS first)."""
        if glitch:
            self.board.set_signals(rts=True)
            self.board.set_signals(dtr=True)
        else:
            self.board.set_signals(dtr=True, rts=True)
        self.board.set_signals(rts=False)
        self.board.set_signals(dtr=False)

    def hard_reset(self):
        self.board.set_signals(dtr=False, rts=True)
        time.sleep(0.1)
        self.board.set_signals(rts=False)

    def recover(self, timeout=3.0):
        self.clear()
        self.hard_reset()
        end = time.monotonic() + timeout
        while time.monotonic() < end:
            self.write(b"TB_SAFE\n")
            time.sleep(0.05)
            if b"TB_SAFE_OK" in self.buf:
                self.read_until(b"TB_SAFE_OK")
                return True
        return False

    def install_files(self, files):
        """files: {board path: text}. Writes through the raw REPL the way the page does."""
        for path, text in files.items():
            raw = text.encode()
            parts = path.strip("/").split("/")
            code = "import os\n"
            for k in range(1, len(parts)):
                code += "try:\n os.mkdir(%r)\nexcept OSError:\n pass\n" % ("/" + "/".join(parts[:k]))
            code += "f=open(%r,'wb')\n" % (path + ".tmp")
            for j in range(0, len(raw), 512):
                code += "f.write(bytes.fromhex(%r))\n" % raw[j:j + 512].hex()
            code += "f.close()\n"
            code += "try:\n os.remove(%r)\nexcept OSError:\n pass\n" % path
            code += "os.rename(%r,%r)\n" % (path + ".tmp", path)
            out, err = self.exec_raw(code)
            if err:
                raise AssertionError("install %s failed: %s" % (path, err))

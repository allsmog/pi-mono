"""Attach one real Pi process to a POSIX PTY; exchange bounded JSON lines with Node."""

import codecs
import errno
import fcntl
import json
import os
import pty
import select
import signal
import struct
import sys
import termios
import time


def emit(value):
    sys.stdout.write(json.dumps(value, ensure_ascii=True) + "\n")
    sys.stdout.flush()


def main():
    # The server, not browser input, chooses the executable, argv, and working directory.
    config = json.loads(sys.stdin.buffer.raw.readline(131072))
    pid, master = pty.fork()
    if pid == 0:
        os.chdir(config["cwd"])
        os.execvpe(config["command"], config["args"], config["env"])

    def resize(cols, rows):
        fcntl.ioctl(master, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))

    def stop(_signum=None, _frame=None):
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    resize(config["cols"], config["rows"])
    os.set_blocking(master, False)
    decoder = codecs.getincrementaldecoder("utf-8")("replace")
    incoming = bytearray()
    pending = bytearray()
    status = None
    try:
        while True:
            readable, writable, _ = select.select([master, sys.stdin.fileno()], [master] if pending else [], [], 0.2)
            if master in writable:
                try:
                    written = os.write(master, pending)
                    del pending[:written]
                except BlockingIOError:
                    pass
            if master in readable:
                try:
                    data = os.read(master, 65536)
                except OSError as error:
                    if error.errno != errno.EIO:
                        raise
                    data = b""
                if not data:
                    break
                output = decoder.decode(data)
                if output:
                    emit({"type": "output", "data": output})
            if sys.stdin.fileno() in readable:
                data = os.read(sys.stdin.fileno(), 65536)
                if not data:
                    break
                incoming.extend(data)
                if len(incoming) > 262144:
                    break
                while b"\n" in incoming:
                    line, _, remainder = incoming.partition(b"\n")
                    incoming = bytearray(remainder)
                    message = json.loads(line)
                    if message["type"] == "input":
                        pending.extend(message["data"].encode("utf-8"))
                        if len(pending) > 262144:
                            raise ValueError("Terminal input backlog exceeded")
                    elif message["type"] == "resize":
                        resize(message["cols"], message["rows"])
            child, child_status = os.waitpid(pid, os.WNOHANG)
            if child:
                status = child_status
                # Read the remaining terminal output before reporting the exit.
                while True:
                    try:
                        data = os.read(master, 65536)
                    except (BlockingIOError, OSError):
                        break
                    if not data:
                        break
                    emit({"type": "output", "data": decoder.decode(data)})
                break
    except KeyboardInterrupt:
        pass
    finally:
        os.close(master)
        if status is None:
            try:
                os.killpg(pid, signal.SIGHUP)
            except ProcessLookupError:
                pass
            deadline = time.monotonic() + 2
            while time.monotonic() < deadline:
                child, child_status = os.waitpid(pid, os.WNOHANG)
                if child:
                    status = child_status
                    break
                time.sleep(0.02)
            if status is None:
                try:
                    os.killpg(pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                _, status = os.waitpid(pid, 0)
        tail = decoder.decode(b"", final=True)
        if tail:
            emit({"type": "output", "data": tail})
        emit({"type": "status", "state": "exited", "exitCode": os.waitstatus_to_exitcode(status)})


if __name__ == "__main__":
    main()

"""Bluetooth RFCOMM(SPP)でプリンタに送る。sudo も rfcomm bind も要らない(Linux の標準ソケット)。"""
from __future__ import annotations

import os
import socket
import time

from .protocol import STATUS_LEN, STATUS_REQUEST, parse_status

DEFAULT_CHANNEL = 2  # PT-P300BT の「SPP SERVER」(sdptool browse で確認)


def printer_addr() -> str:
    addr = os.environ.get("PTOUCH_ADDR")
    if not addr:
        raise RuntimeError("PTOUCH_ADDR にプリンタの Bluetooth アドレス(例 XX:XX:XX:XX:XX:XX)を設定してください")
    return addr


def _open(timeout: float = 10.0) -> socket.socket:
    s = socket.socket(socket.AF_BLUETOOTH, socket.SOCK_STREAM, socket.BTPROTO_RFCOMM)
    s.settimeout(timeout)
    s.connect((printer_addr(), int(os.environ.get("PTOUCH_CHANNEL", DEFAULT_CHANNEL))))
    return s


def read_status(timeout: float = 5.0) -> dict:
    s = _open(timeout)
    try:
        s.sendall(b"\x00" * 64 + b"\x1b\x40" + STATUS_REQUEST)
        buf = b""
        end = time.time() + timeout
        while len(buf) < STATUS_LEN and time.time() < end:
            try:
                buf += s.recv(STATUS_LEN - len(buf))
            except socket.timeout:
                break
        return parse_status(buf)
    finally:
        s.close()


def send_job(job: bytes, *, copies: int = 1, timeout: float = 15.0) -> dict:
    """ジョブを送る。コピーは 1 枚ずつ送る(間にフィードが入る)。送ったあとステータスを返す。"""
    s = _open(timeout)
    try:
        for _ in range(copies):
            for i in range(0, len(job), 512):
                s.sendall(job[i:i + 512])
            time.sleep(0.2)
        time.sleep(1.0)
        s.settimeout(1.0)
        try:
            tail = s.recv(STATUS_LEN)
        except socket.timeout:
            tail = b""
        return parse_status(tail) if tail else {"ok": None, "note": "送信は完了(ステータスの返事なし)"}
    finally:
        s.close()

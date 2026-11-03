"""Bluetooth RFCOMM(SPP)でプリンタに送る。sudo も rfcomm bind も要らない(Linux の標準ソケット)。"""
from __future__ import annotations

import os
import socket
import time

from .protocol import (STATUS_COMPLETED, STATUS_ERROR, STATUS_LEN, STATUS_REQUEST, extract_frames, parse_status)

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


def _wait_for_done(s: socket.socket, wait_s: float) -> dict:
    """印刷が終わった(または、エラーになった)知らせを待つ。来なければ timeout。"""
    buf = b""
    end = time.time() + wait_s
    while time.time() < end:
        s.settimeout(max(0.1, min(0.5, end - time.time())))
        try:
            data = s.recv(256)
        except socket.timeout:
            continue
        if not data:
            break
        frames, buf = extract_frames(buf + data)
        for f in frames:
            st = parse_status(f)
            if st["status_type"] == STATUS_ERROR or (st["status_type"] != STATUS_COMPLETED and st["error_bits"]):
                return {"result": "error", "status": st}
            if st["status_type"] == STATUS_COMPLETED:
                return {"result": "completed", "status": st}
    return {"result": "timeout"}


def send_job(job: bytes, *, copies: int = 1, wait_s: float = 15.0, timeout: float = 15.0) -> dict:
    """ジョブを 1 枚ずつ送る。1 枚ごとに「印刷完了」の知らせを待ってから、次を送る。

    印刷中に次のデータを送ると、プリンタがエラーになることがあるため。
    知らせが来なかった(timeout)ときは、少し待って次へ進む。エラーの知らせが来たら、そこで止める。
    """
    s = _open(timeout)
    results = []
    try:
        for i in range(copies):
            for k in range(0, len(job), 512):
                s.sendall(job[k:k + 512])
            r = _wait_for_done(s, wait_s)
            results.append(r["result"])
            if r["result"] == "error":
                return {"ok": False, "copies": results, "status": r["status"], "note": f"{i + 1} 枚目でエラー"}
            if r["result"] == "timeout":
                time.sleep(2.5)       # 完了の知らせが来ないときの、念のための待ち
            if i + 1 < copies:
                time.sleep(0.5)
        ok = all(x in ("completed", "timeout") for x in results)
        return {"ok": ok, "copies": results,
                "note": "完了の知らせを受け取りました" if all(x == "completed" for x in results)
                else "完了の知らせが来ない枚がありました(印刷はできているかもしれません)"}
    finally:
        s.close()

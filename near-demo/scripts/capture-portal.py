#!/usr/bin/env python3
"""Record the real NEAR desktop notch through the GNOME ScreenCast portal."""
import os
import signal
import subprocess
import time
from pathlib import Path

import dbus
from dbus.mainloop.glib import DBusGMainLoop
from gi.repository import GLib

DBusGMainLoop(set_as_default=True)
bus = dbus.SessionBus()
portal_path = "/org/freedesktop/portal/desktop"
portal_obj = bus.get_object("org.freedesktop.portal.Desktop", portal_path)
cast = dbus.Interface(portal_obj, "org.freedesktop.portal.ScreenCast")
request_iface = "org.freedesktop.portal.Request"
loop = GLib.MainLoop()


def wait_for_request(path):
    result = {}

    def on_response(code, details):
        result["code"] = int(code)
        result["details"] = details
        loop.quit()

    bus.add_signal_receiver(on_response, signal_name="Response", dbus_interface=request_iface, path=path, bus_name="org.freedesktop.portal.Desktop")
    loop.run()
    if result["code"] != 0:
        raise RuntimeError(f"Screen capture request declined or failed (response {result['code']})")
    return result["details"]


def options(token, **values):
    result = {"handle_token": dbus.String(token)}
    result.update(values)
    return result


session_request = cast.CreateSession(options("near_create", session_handle_token=dbus.String("near_session")))
created = wait_for_request(session_request)
session = created["session_handle"]
selected_request = cast.SelectSources(session, options("near_sources", types=dbus.UInt32(1), multiple=dbus.Boolean(False), cursor_mode=dbus.UInt32(1)))
wait_for_request(selected_request)
started_request = cast.Start(session, "", options("near_start"))
started = wait_for_request(started_request)
streams = started.get("streams", [])
if not streams:
    raise RuntimeError("The screen capture portal returned no video streams")
node_id = int(streams[0][0])
print(f"Screen capture granted; stream node {node_id}. Recording collapsed notch, then expanding at 10 seconds.", flush=True)

pipewire = dbus.Interface(portal_obj, "org.freedesktop.portal.ScreenCast").OpenPipeWireRemote(session, options("near_pipewire"))
fd = pipewire.take()
capture_path = Path(__file__).resolve().parents[1] / "public" / "captures" / "near-notch-reveal.mp4"
pipeline = [
    "gst-launch-1.0", "-e",
    "pipewiresrc", f"fd={fd}", f"path={node_id}", "do-timestamp=true", "!",
    "video/x-raw,framerate=30/1", "!", "videoconvert", "!", "video/x-raw,format=I420", "!",
    "queue", "!", "x264enc", "tune=zerolatency", "speed-preset=ultrafast", "bitrate=9000", "key-int-max=60", "!",
    "h264parse", "!", "mp4mux", "!", "filesink", f"location={capture_path}",
]
recorder = subprocess.Popen(pipeline, pass_fds=(fd,))
os.close(fd)
time.sleep(10)

# Trigger the app's actual registered Ctrl+Shift+Space shortcut, preserving its own spring animation.
import ctypes

x11 = ctypes.CDLL("libX11.so.6")
xtst = ctypes.CDLL("libXtst.so.6")
x11.XOpenDisplay.restype = ctypes.c_void_p
x11.XKeysymToKeycode.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
x11.XKeysymToKeycode.restype = ctypes.c_ubyte
xtst.XTestFakeKeyEvent.argtypes = [ctypes.c_void_p, ctypes.c_ubyte, ctypes.c_int, ctypes.c_ulong]
display = x11.XOpenDisplay(None)
keys = [x11.XKeysymToKeycode(display, symbol) for symbol in (0xFFE3, 0xFFE1, 0x20)]
for key in keys:
    xtst.XTestFakeKeyEvent(display, key, 1, 0)
for key in reversed(keys):
    xtst.XTestFakeKeyEvent(display, key, 0, 0)
x11.XFlush(display)
print("NEAR opened; holding expanded view for 20 seconds.", flush=True)
time.sleep(20)
recorder.send_signal(signal.SIGINT)
code = recorder.wait(timeout=20)
if code not in (0, 130):
    raise RuntimeError(f"GStreamer exited with status {code}")
print(f"Saved {capture_path}", flush=True)

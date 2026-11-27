#!/usr/bin/env python3
"""Record a native desktop clip through the GNOME ScreenCast portal.

Usage: python scripts/capture-scene3-desktop.py 00-wallpaper-test.mp4 5
The final clips belong in public/captures/scene-3/ and should begin immediately
before the featured interaction. This helper captures video only; system/app
sound must be captured separately when an audio source is available.
"""
import signal
import subprocess
import sys
import time
from pathlib import Path

import dbus
from dbus.mainloop.glib import DBusGMainLoop
from gi.repository import GLib

if len(sys.argv) != 3:
    raise SystemExit("usage: capture-scene3-desktop.py <filename.mp4> <seconds>")
name = Path(sys.argv[1]).name
if not name.endswith(".mp4"):
    raise SystemExit("capture filename must end in .mp4")
seconds = max(1, float(sys.argv[2]))
out = Path(__file__).resolve().parents[1] / "public" / "captures" / "scene-3" / name
out.parent.mkdir(parents=True, exist_ok=True)

DBusGMainLoop(set_as_default=True)
bus = dbus.SessionBus()
portal_path = "/org/freedesktop/portal/desktop"
portal = bus.get_object("org.freedesktop.portal.Desktop", portal_path)
cast = dbus.Interface(portal, "org.freedesktop.portal.ScreenCast")
request_iface = "org.freedesktop.portal.Request"
loop = GLib.MainLoop()

def wait_request(path):
    result = {}
    def response(code, details):
        result["code"] = int(code)
        result["details"] = details
        loop.quit()
    bus.add_signal_receiver(response, signal_name="Response", dbus_interface=request_iface, path=path, bus_name="org.freedesktop.portal.Desktop")
    loop.run()
    if result["code"] != 0:
        raise RuntimeError(f"Screen capture request rejected (response {result['code']})")
    return result["details"]

def opts(token, **values):
    return {"handle_token": dbus.String(token), **values}

session = wait_request(cast.CreateSession(opts("near3_create", session_handle_token=dbus.String("near3_session"))))["session_handle"]
wait_request(cast.SelectSources(session, opts("near3_sources", types=dbus.UInt32(1), multiple=dbus.Boolean(False), cursor_mode=dbus.UInt32(1))))
streams = wait_request(cast.Start(session, "", opts("near3_start"))).get("streams", [])
if not streams:
    raise RuntimeError("The ScreenCast portal returned no desktop stream")
node = int(streams[0][0])
pipewire = dbus.Interface(portal, "org.freedesktop.portal.ScreenCast").OpenPipeWireRemote(session, opts("near3_pipewire"))
fd = pipewire.take()
pipeline = [
    "gst-launch-1.0", "-e", "pipewiresrc", f"fd={fd}", f"path={node}", "do-timestamp=true", "!",
    "videoconvert", "!", "x264enc", "tune=zerolatency", "speed-preset=ultrafast", "bitrate=6000", "key-int-max=60", "!",
    "video/x-h264,stream-format=avc,alignment=au", "!", "mp4mux", "faststart=true", "!", "filesink", f"location={out}",
]
print(f"Recording desktop stream {node} to {out} for {seconds:g}s", flush=True)
recorder = subprocess.Popen(pipeline, pass_fds=(fd,))
try:
    time.sleep(seconds)
finally:
    recorder.send_signal(signal.SIGINT)
    code = recorder.wait(timeout=20)
    os_close = __import__("os").close
    os_close(fd)
if code not in (0, 130):
    raise RuntimeError(f"GStreamer exited with status {code}")
print(f"Saved {out}", flush=True)

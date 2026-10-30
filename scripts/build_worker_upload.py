import os, json, uuid, base64, mimetypes
from pathlib import Path

public = Path("/workspace/aicodinghunt/public")
embedded = {}
for p in public.rglob("*"):
    if not p.is_file():
        continue
    rel = "/" + p.relative_to(public).as_posix()
    ctype = mimetypes.guess_type(p.name)[0] or "application/octet-stream"
    embedded[rel] = {
        "b64": base64.b64encode(p.read_bytes()).decode("ascii"),
        "type": ctype,
    }

worker_template = r"""
const FILES = __FILES__;
function b64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
export default {
  async fetch(request) {
    const url = new URL(request.url);
    let path = url.pathname;
    if (path.endsWith("/")) path += "index.html";
    let item = FILES[path];
    if (!item && path === "/index.html") item = FILES["/index.html"];
    if (!item && !path.includes(".")) item = FILES["/index.html"];
    if (!item) return new Response("Not Found", { status: 404 });
    const textish = item.type.startsWith("text/") || item.type.includes("json") || item.type.includes("javascript");
    const headers = {
      "content-type": item.type + (textish ? "; charset=utf-8" : ""),
      "cache-control": path.endsWith(".html") ? "public, max-age=60" : "public, max-age=3600",
    };
    return new Response(b64ToBytes(item.b64), { headers });
  }
};
"""
worker = worker_template.replace("__FILES__", json.dumps(embedded))
Path("/tmp/worker_embedded.js").write_text(worker)
print("worker_bytes", len(worker.encode()), "files", len(embedded))

boundary = "----B" + uuid.uuid4().hex
meta = json.dumps({"main_module": "worker.js", "compatibility_date": "2026-10-01"})
parts = []

def add(name, content, filename=None, ctype="application/octet-stream"):
    disp = f'form-data; name="{name}"'
    if filename:
        disp += f'; filename="{filename}"'
    head = f"--{boundary}\r\nContent-Disposition: {disp}\r\nContent-Type: {ctype}\r\n\r\n".encode()
    body = content if isinstance(content, bytes) else content.encode()
    parts.append(head + body + b"\r\n")

add("metadata", meta, ctype="application/json")
add("worker.js", worker, filename="worker.js", ctype="application/javascript+module")
blob = b"".join(parts) + f"--{boundary}--\r\n".encode()
Path("/tmp/worker_upload.bin").write_bytes(blob)
Path("/tmp/worker_boundary.txt").write_text(boundary)
print("body_bytes", len(blob))

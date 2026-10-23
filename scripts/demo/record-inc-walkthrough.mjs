// Records a demo page to MP4, frame by frame: the student INC walkthrough (/demo/inc-walkthrough,
// the default) or, with --demo admin, the admin source-management walkthrough (/demo/admin-sources).
//
//   1. npm run dev                      (the demo route exists only in `next dev`)
//   2. node scripts/demo/record-inc-walkthrough.mjs [--demo inc|admin] [--url http://localhost:3000] [--fps 30] [--scale 1.25]
//
// No extra packages: drives the installed Chrome over the DevTools protocol, seeks the demo
// clock to each frame (window.__demoSeek), screenshots it, then encodes H.264 with Chrome's
// WebCodecs and writes the MP4 container here. A WebM copy is also written when Playwright's
// ffmpeg build is present (it can only encode VP8). Output: scripts/demo/output/ (admin: output/admin/).

import { spawn } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => (arg.startsWith("--") ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs), [])
)
const BASE_URL = args.url ?? "http://localhost:3000"
const FPS = Number(args.fps ?? 30)
// Each demo: its route, length (its DURATION export) and output location.
const DEMOS = {
  inc: { route: "/demo/inc-walkthrough", duration: 18, dir: "", name: "cect-agent-inc-demo", stills: [0.5, 3.2, 5.45, 7, 10.4, 13.6, 17.9] },
  admin: { route: "/demo/admin-sources", duration: 34, dir: "admin", name: "cect-agent-admin-sources-demo", stills: [0.5, 2.6, 5.6, 8.2, 11.5, 14.8, 18.2, 20.5, 24, 28.2, 30.5, 33.8] },
}
const DEMO = DEMOS[args.demo ?? "inc"]
if (!DEMO) throw new Error(`Unknown --demo ${args.demo}. Use: ${Object.keys(DEMOS).join(", ")}`)
const DURATION = DEMO.duration
const WIDTH = 1920
const HEIGHT = 1080
// The reference screenshots were taken at 125% display scaling: lay the page out at 1536×864
// CSS px and render it at 1.25× so the 1920×1080 video matches them (and text stays sharp).
const SCALE = Number(args.scale ?? 1.25)
const VIEW_W = Math.round(WIDTH / SCALE)
const VIEW_H = Math.round(HEIGHT / SCALE)
const PORT = 9333 + Math.floor(Math.random() * 500)

const here = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(here, "output", DEMO.dir)
const framesDir = path.join(outDir, "frames")
const jpegDir = path.join(outDir, "frames-jpeg")
const mp4Path = path.join(outDir, `${DEMO.name}.mp4`)
const webmPath = path.join(outDir, `${DEMO.name}.webm`)
const verifyDir = path.join(outDir, "verify")

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ]
  const found = candidates.find((p) => p && fs.existsSync(p))
  if (!found) throw new Error("Chrome not found. Set CHROME_PATH.")
  return found
}

function findFfmpeg() {
  const root = path.join(os.homedir(), "AppData/Local/ms-playwright")
  if (!fs.existsSync(root)) return null
  for (const dir of fs.readdirSync(root).filter((d) => d.startsWith("ffmpeg"))) {
    const exe = fs.readdirSync(path.join(root, dir)).find((f) => f.startsWith("ffmpeg"))
    if (exe) return path.join(root, dir, exe)
  }
  return null
}

/** Minimal DevTools protocol client over Node's built-in WebSocket. */
async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl)
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = reject
  })
  let id = 0
  const pending = new Map()
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data)
    const waiter = msg.id && pending.get(msg.id)
    if (!waiter) return
    pending.delete(msg.id)
    if (msg.error) waiter.reject(new Error(msg.error.message))
    else waiter.resolve(msg.result)
  }
  return {
    send(method, params = {}) {
      const msgId = ++id
      ws.send(JSON.stringify({ id: msgId, method, params }))
      return new Promise((resolve, reject) => pending.set(msgId, { resolve, reject }))
    },
    async eval(expression) {
      const { result, exceptionDetails } = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })
      if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text)
      return result.value
    },
    close: () => ws.close(),
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function launchChrome() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "cect-demo-chrome-"))
  const chrome = spawn(findChrome(), [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    `--window-size=${VIEW_W},${VIEW_H}`,
    `--force-device-scale-factor=${SCALE}`,
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--mute-audio",
    "about:blank",
  ], { stdio: "ignore" })
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`)
      if (res.ok) break
    } catch {}
    await sleep(100)
  }
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json()
  const page = await connect(target.webSocketDebuggerUrl)
  return {
    page,
    close() {
      page.close()
      chrome.kill()
      // Chrome can hold its profile for a moment after exit; a leftover temp folder is harmless.
      setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }) } catch {} }, 1500)
    },
  }
}

// Runs inside the (localhost, so secure-context) demo page: H.264 encoding with WebCodecs.
const ENCODER_SCRIPT = `
window.__enc = (() => {
  const samples = []
  let description = null, encoder = null, error = null, all = null
  const b64 = (bytes) => { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s) }
  return {
    async init(width, height, fps) {
      for (const codec of ["avc1.640028", "avc1.4d0028", "avc1.42e028"]) {
        const config = { codec, width, height, framerate: fps, bitrate: 14_000_000, bitrateMode: "variable", latencyMode: "quality", avc: { format: "avc" } }
        if (!(await VideoEncoder.isConfigSupported(config)).supported) continue
        encoder = new VideoEncoder({
          output: (chunk, meta) => {
            const d = meta?.decoderConfig?.description
            if (d && !description) description = d instanceof ArrayBuffer ? new Uint8Array(d.slice(0)) : new Uint8Array(d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength))
            const data = new Uint8Array(chunk.byteLength)
            chunk.copyTo(data)
            samples.push({ data, key: chunk.type === "key", ts: chunk.timestamp })
          },
          error: (e) => { error = String(e) },
        })
        encoder.configure(config)
        return codec
      }
      throw new Error("No H.264 WebCodecs encoder available")
    },
    async add(png, i, fps) {
      const bitmap = await createImageBitmap(await (await fetch("data:image/png;base64," + png)).blob())
      const frame = new VideoFrame(bitmap, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) })
      encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 })
      frame.close()
      bitmap.close()
      while (encoder.encodeQueueSize > 4) await new Promise((r) => setTimeout(r, 5))
      if (error) throw new Error(error)
    },
    async finish() {
      await encoder.flush()
      encoder.close()
      if (error) throw new Error(error)
      all = new Uint8Array(samples.reduce((n, s) => n + s.data.length, 0))
      let off = 0
      for (const s of samples) { all.set(s.data, off); off += s.data.length }
      return { description: description ? b64(description) : null, samples: samples.map((s) => ({ size: s.data.length, key: s.key, ts: s.ts })), total: all.length }
    },
    slice: (off, len) => b64(all.subarray(off, off + len)),
  }
})()
`

// Plays the finished MP4 back in the page and grabs stills, to prove it decodes.
const VERIFY_SCRIPT = `
window.__ver = (() => {
  const parts = []
  let video = null
  return {
    push: (b64) => { const s = atob(b64); const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); parts.push(a) },
    async load() {
      video = document.createElement("video")
      video.muted = true
      video.src = URL.createObjectURL(new Blob(parts, { type: "video/mp4" }))
      await new Promise((resolve, reject) => { video.onloadeddata = resolve; video.onerror = () => reject(new Error("MP4 failed to decode: " + (video.error && video.error.message))) })
      return { duration: video.duration, width: video.videoWidth, height: video.videoHeight }
    },
    async still(t) {
      await new Promise((resolve) => { video.onseeked = resolve; video.currentTime = t })
      const canvas = document.createElement("canvas")
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext("2d").drawImage(video, 0, 0)
      return canvas.toDataURL("image/png").split(",")[1]
    },
  }
})()
`

// --- MP4 (ISO BMFF) writer: one H.264 track, all samples in one chunk, moov before mdat. ---
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0); return b }
const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16BE(n); return b }
const box = (type, ...parts) => { const body = Buffer.concat(parts); return Buffer.concat([u32(body.length + 8), Buffer.from(type, "ascii"), body]) }
const fullBox = (type, version, flags, ...parts) => box(type, u32((version << 24) | flags), ...parts)
const MATRIX = Buffer.concat([0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000].map(u32))

function buildMp4({ description, samples, data, width, height, fps }) {
  const timescale = fps * 1000
  const delta = 1000
  const duration = samples.length * delta
  const movieDuration = Math.round((duration / timescale) * 1000)
  const avc1 = box("avc1",
    Buffer.alloc(6), u16(1), u16(0), u16(0), Buffer.alloc(12), u16(width), u16(height),
    u32(0x00480000), u32(0x00480000), u32(0), u16(1), Buffer.alloc(32), u16(0x0018), u16(0xffff),
    box("avcC", description))
  const keys = samples.flatMap((s, i) => (s.key ? [i + 1] : []))
  const stbl = (chunkOffset) => box("stbl",
    fullBox("stsd", 0, 0, u32(1), avc1),
    fullBox("stts", 0, 0, u32(1), u32(samples.length), u32(delta)),
    fullBox("stss", 0, 0, u32(keys.length), ...keys.map(u32)),
    fullBox("stsc", 0, 0, u32(1), u32(1), u32(samples.length), u32(1)),
    fullBox("stsz", 0, 0, u32(0), u32(samples.length), ...samples.map((s) => u32(s.size))),
    fullBox("stco", 0, 0, u32(1), u32(chunkOffset)))
  const moov = (chunkOffset) => box("moov",
    fullBox("mvhd", 0, 0, u32(0), u32(0), u32(1000), u32(movieDuration), u32(0x00010000), u16(0x0100), Buffer.alloc(10), MATRIX, Buffer.alloc(24), u32(2)),
    box("trak",
      fullBox("tkhd", 0, 3, u32(0), u32(0), u32(1), u32(0), u32(movieDuration), Buffer.alloc(8), u16(0), u16(0), u16(0), u16(0), MATRIX, u32(width << 16), u32(height << 16)),
      box("mdia",
        fullBox("mdhd", 0, 0, u32(0), u32(0), u32(timescale), u32(duration), u16(0x55c4), u16(0)),
        fullBox("hdlr", 0, 0, u32(0), Buffer.from("vide"), Buffer.alloc(12), Buffer.from("VideoHandler\0")),
        box("minf",
          fullBox("vmhd", 0, 1, u16(0), Buffer.alloc(6)),
          box("dinf", fullBox("dref", 0, 0, u32(1), fullBox("url ", 0, 1))),
          stbl(chunkOffset)))))
  const ftyp = box("ftyp", Buffer.from("isom"), u32(0x200), Buffer.from("isomiso2avc1mp41"))
  const offset = ftyp.length + moov(0).length + 8
  return Buffer.concat([ftyp, moov(offset), u32(data.length + 8), Buffer.from("mdat"), data])
}

// Playwright's ffmpeg build has no pipe or image2 input: feed it one concatenated MJPEG file.
async function writeWebm(ffmpeg, frameCount) {
  const mjpeg = path.join(outDir, "frames.mjpeg")
  fs.writeFileSync(mjpeg, Buffer.concat(Array.from({ length: frameCount }, (_, i) => fs.readFileSync(path.join(jpegDir, frameName(i, "jpg"))))))
  const proc = spawn(ffmpeg, [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", mjpeg,
    "-c:v", "libvpx", "-b:v", "12M", "-crf", "4", "-qmin", "0", "-qmax", "24", "-quality", "good", "-cpu-used", "0",
    "-pix_fmt", "yuv420p", webmPath,
  ], { stdio: "inherit" })
  const code = await new Promise((r) => proc.on("close", r))
  fs.rmSync(mjpeg, { force: true })
  if (code !== 0) throw new Error(`ffmpeg exited with ${code}`)
}

const frameName = (i, ext) => `frame_${String(i + 1).padStart(5, "0")}.${ext}`

async function main() {
  for (const dir of args.preview ? [] : [framesDir, jpegDir, verifyDir]) {
    fs.rmSync(dir, { recursive: true, force: true })
    fs.mkdirSync(dir, { recursive: true })
  }
  const frameCount = Math.round(DURATION * FPS)
  const browser = await launchChrome()
  const { page } = browser
  try {
    await page.send("Page.enable")
    await page.send("Emulation.setDeviceMetricsOverride", { width: VIEW_W, height: VIEW_H, deviceScaleFactor: SCALE, mobile: false })
    await page.send("Emulation.setFocusEmulationEnabled", { enabled: true })
    await page.send("Page.navigate", { url: `${BASE_URL}${DEMO.route}?record=1` })
    const deadline = Date.now() + 180_000
    while (!(await page.eval("window.__demoReady === true").catch(() => false))) {
      if (Date.now() > deadline) throw new Error("Demo page did not become ready. Is `npm run dev` running?")
      await sleep(250)
    }

    // --preview 2,9.5,20: just those moments, as PNGs in output/[admin/]preview/, for a quick check.
    if (args.preview) {
      const previewDir = path.join(outDir, "preview")
      fs.mkdirSync(previewDir, { recursive: true })
      for (const t of args.preview.split(",").map(Number)) {
        await page.eval(`window.__demoSeek(${t})`)
        const png = await page.send("Page.captureScreenshot", { format: "png" })
        fs.writeFileSync(path.join(previewDir, `t_${String(t).replace(".", "_")}s.png`), Buffer.from(png.data, "base64"))
      }
      console.log(`Preview stills: ${previewDir}`)
      return
    }

    console.log(`Capturing ${frameCount} frames at ${WIDTH}×${HEIGHT}, ${FPS} fps…`)
    for (let i = 0; i < frameCount; i++) {
      await page.eval(`window.__demoSeek(${i / FPS})`)
      const png = await page.send("Page.captureScreenshot", { format: "png" })
      fs.writeFileSync(path.join(framesDir, frameName(i, "png")), Buffer.from(png.data, "base64"))
      const jpg = await page.send("Page.captureScreenshot", { format: "jpeg", quality: 98 })
      fs.writeFileSync(path.join(jpegDir, frameName(i, "jpg")), Buffer.from(jpg.data, "base64"))
      if ((i + 1) % FPS === 0) process.stdout.write(`  ${(i + 1) / FPS}s\n`)
    }

    console.log("Encoding H.264…")
    await page.eval(ENCODER_SCRIPT)
    const codec = await page.eval(`window.__enc.init(${WIDTH}, ${HEIGHT}, ${FPS})`)
    for (let i = 0; i < frameCount; i++) {
      const b64 = fs.readFileSync(path.join(framesDir, frameName(i, "png"))).toString("base64")
      await page.eval(`window.__enc.add("${b64}", ${i}, ${FPS})`)
    }
    const { description, samples, total } = await page.eval("window.__enc.finish()")
    if (!description) throw new Error("Encoder returned no avcC description")
    if (samples.some((s, i) => i > 0 && s.ts <= samples[i - 1].ts)) throw new Error("Out-of-order samples (B-frames) are not supported")
    const pieces = []
    for (let off = 0; off < total; off += 4 << 20) pieces.push(Buffer.from(await page.eval(`window.__enc.slice(${off}, ${4 << 20})`), "base64"))
    const mp4 = buildMp4({ description: Buffer.from(description, "base64"), samples, data: Buffer.concat(pieces), width: WIDTH, height: HEIGHT, fps: FPS })
    fs.writeFileSync(mp4Path, mp4)
    console.log(`MP4: ${mp4Path} (${codec}, ${samples.length} frames, ${(mp4.length / 1e6).toFixed(1)} MB)`)

    // Verify: decode the MP4 in Chrome and save stills.
    await page.eval(VERIFY_SCRIPT)
    for (let off = 0; off < mp4.length; off += 4 << 20) await page.eval(`window.__ver.push("${mp4.subarray(off, off + (4 << 20)).toString("base64")}")`)
    const info = await page.eval("window.__ver.load()")
    console.log(`Decoded: ${info.width}×${info.height}, ${info.duration.toFixed(2)} s`)
    for (const t of DEMO.stills) {
      fs.writeFileSync(path.join(verifyDir, `still_${String(t).replace(".", "_")}s.png`), Buffer.from(await page.eval(`window.__ver.still(${t})`), "base64"))
    }
  } finally {
    browser.close()
  }

  const ffmpeg = findFfmpeg()
  if (ffmpeg) {
    await writeWebm(ffmpeg, frameCount)
    console.log(`WebM: ${webmPath}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

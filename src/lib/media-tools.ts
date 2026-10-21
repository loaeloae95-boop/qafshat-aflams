// Browser-only helpers. FFmpeg is dynamically imported inside functions so it never enters SSR.
type FF = import("@ffmpeg/ffmpeg").FFmpeg;
let ffPromise: Promise<FF> | null = null;

const CORE = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm";

async function getFFmpeg(): Promise<FF> {
  if (!ffPromise) {
    ffPromise = (async () => {
      const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
        import("@ffmpeg/ffmpeg"),
        import("@ffmpeg/util"),
      ]);
      const ff = new FFmpeg();
      await ff.load({
        coreURL: await toBlobURL(`${CORE}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${CORE}/ffmpeg-core.wasm`, "application/wasm"),
      });
      return ff;
    })().catch((e) => {
      ffPromise = null;
      throw e;
    });
  }
  return ffPromise;
}

const extOf = (f: File) => (f.name.split(".").pop() || "bin").toLowerCase();

/** Cut [start, end] seconds out of a video/audio file. Uses stream copy (fast, no re-encode). */
export async function trimMedia(file: File, start: number, end: number): Promise<File> {
  const ff = await getFFmpeg();
  const { fetchFile } = await import("@ffmpeg/util");
  const ext = extOf(file);
  const inName = `in.${ext}`;
  const outName = `out.${ext}`;
  await ff.writeFile(inName, await fetchFile(file));
  await ff.exec([
    "-ss",
    start.toFixed(2),
    "-i",
    inName,
    "-t",
    (end - start).toFixed(2),
    "-c",
    "copy",
    "-avoid_negative_ts",
    "make_zero",
    outName,
  ]);
  const data = (await ff.readFile(outName)) as Uint8Array;
  await ff.deleteFile(inName).catch(() => {});
  await ff.deleteFile(outName).catch(() => {});
  const base = file.name.replace(/\.[^.]+$/, "");
  return new File([new Uint8Array(data)], `${base}-trim.${ext}`, { type: file.type });
}

/** Extract a small mono 16kHz MP3 of the audio track (from video or audio) for transcription. */
export async function extractSpeech(file: File, start: number, end: number): Promise<Blob> {
  const ff = await getFFmpeg();
  const { fetchFile } = await import("@ffmpeg/util");
  const inName = `src.${extOf(file)}`;
  await ff.writeFile(inName, await fetchFile(file));
  const len = Math.min(end - start, 120);
  await ff.exec([
    "-ss",
    start.toFixed(2),
    "-i",
    inName,
    "-t",
    len.toFixed(2),
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-b:a",
    "48k",
    "speech.mp3",
  ]);
  const data = (await ff.readFile("speech.mp3")) as Uint8Array;
  await ff.deleteFile(inName).catch(() => {});
  await ff.deleteFile("speech.mp3").catch(() => {});
  return new Blob([new Uint8Array(data)], { type: "audio/mpeg" });
}

export async function blobToBase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000)
    s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

export const fmtTime = (t: number) => {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s < 10 ? "0" : ""}${s.toFixed(1)}`;
};

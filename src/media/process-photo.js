import { toDateInput } from "../domain/memories";

const HEIC_TYPES = new Set(["image/heic", "image/heif"]);

function canvasBlob(canvas, type = "image/webp", quality = 0.88) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("无法生成照片预览"))),
      type,
      quality,
    );
  });
}

async function decodeBlob(blob) {
  if (typeof createImageBitmap === "function") return createImageBitmap(blob);
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function convertHeic(file) {
  if (!HEIC_TYPES.has(file.type) && !/\.(heic|heif)$/i.test(file.name)) return file;
  try {
    const { default: heic2any } = await import("heic2any");
    const output = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
    return Array.isArray(output) ? output[0] : output;
  } catch (error) {
    throw new Error(`无法读取 HEIC/HEIF：${error.message}`);
  }
}

async function readExif(file) {
  try {
    const exifr = await import("exifr");
    const data = await exifr.parse(file, {
      tiff: true,
      exif: true,
      gps: true,
      reviveValues: true,
    });
    return {
      capturedAt: toDateInput(data?.DateTimeOriginal || data?.CreateDate || ""),
      latitude: Number.isFinite(data?.latitude) ? data.latitude : null,
      longitude: Number.isFinite(data?.longitude) ? data.longitude : null,
    };
  } catch {
    return { capturedAt: "", latitude: null, longitude: null };
  }
}

async function makeRendition(source, maxEdge, quality) {
  const ratio = Math.min(1, maxEdge / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * ratio));
  const height = Math.max(1, Math.round(source.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = "#f2eadc";
  context.fillRect(0, 0, width, height);
  context.drawImage(source, 0, 0, width, height);
  return { blob: await canvasBlob(canvas, "image/webp", quality), canvas };
}

function analyze(canvas) {
  const sample = document.createElement("canvas");
  sample.width = sample.height = 24;
  const context = sample.getContext("2d", { willReadFrequently: true });
  context.drawImage(canvas, 0, 0, 24, 24);
  const pixels = context.getImageData(0, 0, 24, 24).data;
  let luma = 0;
  let warmth = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index] / 255;
    const green = pixels[index + 1] / 255;
    const blue = pixels[index + 2] / 255;
    luma += red * 0.2126 + green * 0.7152 + blue * 0.0722;
    warmth += red - blue;
  }
  const count = pixels.length / 4;
  return { averageLuma: luma / count, warmth: warmth / count };
}

export async function processPhotoFile(file) {
  if (!file?.type?.startsWith("image/") && !/\.(heic|heif)$/i.test(file?.name ?? "")) {
    throw new Error(`${file?.name || "文件"}不是支持的照片格式`);
  }
  const [exif, decodedBlob] = await Promise.all([readExif(file), convertHeic(file)]);
  const source = await decodeBlob(decodedBlob);
  try {
    const display = await makeRendition(source, 2048, 0.9);
    const thumbnail = await makeRendition(source, 640, 0.82);
    return {
      name: file.name,
      originalBlob: file,
      displayBlob: display.blob,
      thumbnailBlob: thumbnail.blob,
      width: source.width,
      height: source.height,
      ...analyze(display.canvas),
      ...exif,
    };
  } finally {
    source.close?.();
  }
}

export async function processPhotoFiles(files, onProgress = () => {}) {
  const results = [];
  const errors = [];
  const list = Array.from(files);
  for (let index = 0; index < list.length; index += 1) {
    const file = list[index];
    try {
      results.push(await processPhotoFile(file));
    } catch (error) {
      errors.push({ name: file.name, message: error.message });
    }
    onProgress({ completed: index + 1, total: list.length, file: file.name });
  }
  return { results, errors };
}

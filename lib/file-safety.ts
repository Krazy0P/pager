export const MAX_FILE_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/wav",
  "audio/mp4",
  "audio/x-m4a",
  "application/pdf",
  "text/plain",
]);

const BLOCKED_EXTENSIONS = new Set([
  "exe",
  "bat",
  "cmd",
  "com",
  "msi",
  "scr",
  "js",
  "mjs",
  "cjs",
  "html",
  "htm",
  "svg",
  "php",
  "sh",
  "ps1",
  "apk",
  "dll",
]);

function startsWith(bytes: Uint8Array, magic: number[]) {
  if (bytes.length < magic.length) return false;
  return magic.every((value, index) => bytes[index] === value);
}

function asciiAt(bytes: Uint8Array, offset: number, text: string) {
  const codes = Array.from(text).map((char) => char.charCodeAt(0));
  if (bytes.length < offset + codes.length) return false;
  return codes.every((value, index) => bytes[offset + index] === value);
}

export function sniffMime(bytes: Uint8Array, claimed: string): string | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return "image/png";
  if (asciiAt(bytes, 0, "GIF8")) return "image/gif";
  if (asciiAt(bytes, 0, "RIFF") && asciiAt(bytes, 8, "WEBP")) return "image/webp";
  if (asciiAt(bytes, 0, "%PDF")) return "application/pdf";
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) {
    if (claimed === "audio/webm" || claimed === "video/webm") return "audio/webm";
    return "audio/webm";
  }
  if (asciiAt(bytes, 0, "OggS")) return "audio/ogg";
  if (asciiAt(bytes, 0, "ID3") || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) {
    return "audio/mpeg";
  }
  if (asciiAt(bytes, 0, "RIFF") && asciiAt(bytes, 8, "WAVE")) return "audio/wav";
  if (claimed === "text/plain") return "text/plain";
  return null;
}

export function classifyKind(mime: string): "image" | "audio" | "file" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  return "file";
}

export function validateUpload(file: File, bytes: Uint8Array) {
  if (file.size === 0) {
    return { ok: false as const, error: "Empty files are not allowed." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false as const, error: "Files must be 10 MB or smaller." };
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (BLOCKED_EXTENSIONS.has(extension)) {
    return { ok: false as const, error: "That file type is blocked for safety." };
  }

  const sniffed = sniffMime(bytes, file.type);
  const mime = sniffed ?? (file.type === "text/plain" ? "text/plain" : null);
  if (!mime || !ALLOWED_MIME.has(mime)) {
    return {
      ok: false as const,
      error: "Only images, voice notes, PDFs, and text files are allowed.",
    };
  }

  return { ok: true as const, mime, kind: classifyKind(mime) };
}

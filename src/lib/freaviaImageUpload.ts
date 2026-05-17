import type { SupabaseClient } from "@supabase/supabase-js";

export const FREAVIA_IMAGES_BUCKET = "freavia-images";

/** File extension from MIME or original filename; fallback safe for storage keys. */
export function inferImageExtension(file: File): string {
  const fromMime: Record<string, string> = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/svg+xml": ".svg",
    "image/avif": ".avif",
  };
  const mime = file.type?.toLowerCase() ?? "";
  if (fromMime[mime]) return fromMime[mime]!;
  const name = file.name ?? "";
  const dot = name.lastIndexOf(".");
  if (dot !== -1) {
    const ext = name.slice(dot).toLowerCase();
    if (/^\.[a-z0-9]{1,8}$/.test(ext)) return ext;
  }
  return ".bin";
}

export function buildFreaviaImageObjectKey(file: File): string {
  const ext = inferImageExtension(file);
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  return `${id}${ext}`;
}

/**
 * Upload to public bucket `freavia-images`, return canonical public URL.
 */
export async function uploadFreaviaImageToStorage(
  client: SupabaseClient,
  file: File,
): Promise<string> {
  const path = buildFreaviaImageObjectKey(file);
  const { error } = await client.storage.from(FREAVIA_IMAGES_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "application/octet-stream",
  });
  if (error) throw error;
  const { data } = client.storage.from(FREAVIA_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

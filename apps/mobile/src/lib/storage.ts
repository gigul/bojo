import type { BucketId } from '@bojo/shared';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { supabase } from './supabase';

/** Longest side of uploaded photos (px). */
export const MAX_IMAGE_SIDE = 1600;
const JPEG_QUALITY = 0.8;

/** Public URL of an object in a public bucket (`avatars`, `venue-photos`). */
export function publicUrl(bucket: BucketId, path: string): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/**
 * Resizes to ≤ 1600 px on the longest side and re-encodes as JPEG q=0.8 — re-encoding strips
 * EXIF (incl. GPS, §8). Uploads the bytes as an ArrayBuffer (works on iOS, Android and web)
 * and returns the storage path. `path` must follow the bucket's layout (see @bojo/shared storage.ts).
 */
export async function uploadImage({
  bucket,
  path,
  uri,
}: {
  bucket: BucketId;
  path: string;
  uri: string;
}): Promise<string> {
  const original = await ImageManipulator.manipulate(uri).renderAsync();
  const longest = Math.max(original.width, original.height);
  const context = ImageManipulator.manipulate(original);
  if (longest > MAX_IMAGE_SIDE) {
    context.resize(
      original.width >= original.height ? { width: MAX_IMAGE_SIDE } : { height: MAX_IMAGE_SIDE },
    );
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: JPEG_QUALITY,
    base64: true,
  });
  original.release();
  rendered.release();
  if (!saved.base64) throw new Error('image_encode_failed');

  const body = base64ToArrayBuffer(saved.base64.replace(/^data:image\/\w+;base64,/, ''));
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, body, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}

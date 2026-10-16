// Storage buckets (ARCHITECTURE §4.5). Object paths are enforced by storage RLS policies:
//   avatars:       "<user_id>/<uuid>.<ext>"
//   venue-photos:  "<venue_id>/<user_id>/<uuid>.<ext>"  (add_venue_photo checks the same pattern)

export const BUCKETS = { avatars: 'avatars', venuePhotos: 'venue-photos' } as const;
export type BucketId = (typeof BUCKETS)[keyof typeof BUCKETS];

export type ImageExt = 'jpg' | 'jpeg' | 'png' | 'webp';

export function avatarObjectPath(userId: string, fileId: string, ext: ImageExt = 'jpg'): string {
  return `${userId}/${fileId}.${ext}`;
}

export function venuePhotoObjectPath(
  venueId: string,
  userId: string,
  fileId: string,
  ext: ImageExt = 'jpg',
): string {
  return `${venueId}/${userId}/${fileId}.${ext}`;
}

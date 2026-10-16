// "Add photo" flow: auth gate → system photo picker → re-encode + upload (EXIF/GPS stripped) →
// add_venue_photo → toast. Shared by the venue page hero and its action list.
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';

import { useToast } from '@/components/ui';
import { useRequireAuth } from '@/lib/auth';
import { useErrorText } from '@/lib/errors';

import { useAddVenuePhoto } from './api';

export function usePhotoUpload(venueId: string): { pick: () => Promise<void>; uploading: boolean } {
  const { t } = useTranslation('venues');
  const toast = useToast();
  const errorText = useErrorText();
  const requireAuth = useRequireAuth();
  const mutation = useAddVenuePhoto(venueId);

  const pick = async () => {
    if (!requireAuth()) return;
    let result: ImagePicker.ImagePickerResult;
    try {
      // The system picker (iOS PHPicker / Android photo picker / web file dialog) needs no permission.
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 1,
        exif: false,
      });
    } catch {
      toast.show(t('photo.failed'), 'danger');
      return;
    }
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    try {
      await mutation.mutateAsync(asset.uri);
      toast.show(t('photo.added'), 'success');
    } catch (e) {
      toast.show(errorText(e), 'danger');
    }
  };

  return { pick, uploading: mutation.isPending };
}

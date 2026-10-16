import { DISTRICTS } from '@bojo/shared';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ListItem, Sheet } from '@/components/ui';
import { Icon } from '@/icons';
import { useThemedStyles, type Theme } from '@/theme';

export interface DistrictSheetProps {
  visible: boolean;
  value: string | null;
  onChange: (districtKey: string | null) => void;
  onClose: () => void;
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    // ListItem has its own 16 pt padding: align its text with the sheet title.
    list: { marginHorizontal: -t.spacing.lg },
    divider: {
      height: t.layout.hairline,
      backgroundColor: t.colors.border,
      marginLeft: t.spacing.lg,
    },
  });

/** Picker for the 18 Warsaw districts (`vocab:districts.*`) + "all districts". */
export function DistrictSheet({ visible, value, onChange, onClose }: DistrictSheetProps) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation(['events', 'vocab', 'common']);
  const { height } = useWindowDimensions();
  const options = [...DISTRICTS]
    .map((d) => ({ key: d.key, label: t(`vocab:districts.${d.key}`) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const pick = (key: string | null) => {
    onChange(key);
    onClose();
  };
  const a11y = (label: string, selected: boolean) =>
    selected ? `${label}, ${t('common:states.selected')}` : label;
  const check = (selected: boolean) =>
    selected ? <Icon name="check" size={20} color="primaryText" /> : null;

  return (
    <Sheet visible={visible} onClose={onClose} title={t('events:filters.districtTitle')}>
      <>
        <ScrollView style={[styles.list, { maxHeight: height * 0.6 }]}>
          <ListItem
            title={t('events:filters.allDistricts')}
            onPress={() => pick(null)}
            right={check(value === null)}
            accessibilityLabel={a11y(t('events:filters.allDistricts'), value === null)}
          />
          {options.map((o) => (
            <View key={o.key}>
              <View style={styles.divider} />
              <ListItem
                title={o.label}
                onPress={() => pick(o.key)}
                right={check(value === o.key)}
                accessibilityLabel={a11y(o.label, value === o.key)}
              />
            </View>
          ))}
        </ScrollView>
      </>
    </Sheet>
  );
}

import { StyleSheet, View } from 'react-native';

import { Card, Skeleton } from '@/components/ui';
import { useThemedStyles, type Theme } from '@/theme';

const createStyles = (t: Theme) =>
  StyleSheet.create({
    body: { padding: t.spacing.lg, gap: t.spacing.md },
    row: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
    text: { flex: 1, gap: t.spacing.sm },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: t.spacing.lg,
      paddingVertical: t.spacing.md,
      borderTopWidth: t.layout.hairline,
      borderTopColor: t.colors.border,
    },
  });

/** Loading placeholder with the EventCard silhouette. */
export function EventCardSkeleton() {
  const styles = useThemedStyles(createStyles);
  return (
    <Card padded={false}>
      <View style={styles.body}>
        <View style={styles.row}>
          <Skeleton width={44} height={44} radius={22} />
          <View style={styles.text}>
            <Skeleton width="55%" height={22} />
            <Skeleton width="40%" height={14} />
          </View>
          <Skeleton width={56} height={24} radius={12} />
        </View>
        <Skeleton width="70%" height={14} style={{ marginLeft: 56 }} />
      </View>
      <View style={styles.footer}>
        <Skeleton width={120} height={28} radius={14} />
        <Skeleton width={88} height={40} radius={20} />
      </View>
    </Card>
  );
}

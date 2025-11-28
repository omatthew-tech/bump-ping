import { View, StyleSheet } from 'react-native';
import { colors, spacing } from '../../theme';

type Props = {
  total: number;
  currentIndex: number;
};

const ProgressDots = ({ total, currentIndex }: Props) => (
  <View style={styles.container}>
    {Array.from({ length: total }).map((_, idx) => (
      <View
        key={idx}
        style={[
          styles.dot,
          idx === currentIndex && styles.activeDot,
        ]}
      />
    ))}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
  },
  activeDot: {
    width: 28,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
});

export default ProgressDots;


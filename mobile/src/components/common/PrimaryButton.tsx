import { TouchableOpacity, Text, StyleSheet, TouchableOpacityProps } from 'react-native';
import { colors, spacing, typography } from '../../theme';

type Props = TouchableOpacityProps & {
  label: string;
  variant?: 'primary' | 'secondary';
};

const PrimaryButton = ({ label, variant = 'primary', style, disabled, ...rest }: Props) => (
  <TouchableOpacity
    activeOpacity={0.9}
    style={[
      styles.base,
      variant === 'secondary' ? styles.secondary : styles.primary,
      disabled && styles.disabled,
      style,
    ]}
    disabled={disabled}
    {...rest}
  >
    <Text
      style={[
        styles.label,
        variant === 'secondary' && { color: colors.text },
      ]}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.md,
    borderRadius: 16,
    alignItems: 'center',
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.border,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    color: colors.surface,
    fontSize: typography.body,
    fontWeight: '700',
  },
});

export default PrimaryButton;


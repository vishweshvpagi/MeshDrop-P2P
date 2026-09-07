import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'primary';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  withDot?: boolean;
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'neutral',
  withDot = false,
  style,
}) => {
  const colors = getBadgeColors(variant);

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg, borderColor: colors.border }, style]}>
      {withDot && <View style={[styles.dot, { backgroundColor: colors.text }]} />}
      <Text style={[styles.text, { color: colors.text }]}>{label}</Text>
    </View>
  );
};

function getBadgeColors(variant: BadgeVariant) {
  switch (variant) {
    case 'success':
      return { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' };
    case 'warning':
      return { bg: '#fffbeb', text: '#d97706', border: '#fde68a' };
    case 'error':
      return { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' };
    case 'info':
      return { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' };
    case 'primary':
      return { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' };
    case 'neutral':
    default:
      return { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' };
  }
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
});

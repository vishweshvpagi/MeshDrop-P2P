import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
  View,
} from 'react-native';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  isLoading?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  isLoading = false,
  icon,
  style,
  textStyle,
}) => {
  const isActionDisabled = disabled || isLoading;
  const vStyle = getVariantStyle(variant, isActionDisabled);
  const sStyle = getSizeStyle(size);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      disabled={isActionDisabled}
      style={[styles.base, sStyle.button, vStyle.button, style]}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={vStyle.text.color} />
      ) : (
        <View style={styles.content}>
          {icon && <View style={styles.icon}>{icon}</View>}
          <Text style={[styles.text, sStyle.text, vStyle.text, textStyle]}>
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

function getVariantStyle(variant: ButtonVariant, disabled: boolean) {
  if (disabled) {
    return {
      button: { backgroundColor: '#e2e8f0', borderColor: '#cbd5e1', borderWidth: 1 },
      text: { color: '#94a3b8' },
    };
  }

  switch (variant) {
    case 'primary':
      return {
        button: { backgroundColor: '#2563eb', borderColor: '#2563eb', borderWidth: 1 },
        text: { color: '#ffffff' },
      };
    case 'secondary':
      return {
        button: { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1', borderWidth: 1 },
        text: { color: '#1e293b' },
      };
    case 'danger':
      return {
        button: { backgroundColor: '#dc2626', borderColor: '#dc2626', borderWidth: 1 },
        text: { color: '#ffffff' },
      };
    case 'success':
      return {
        button: { backgroundColor: '#16a34a', borderColor: '#16a34a', borderWidth: 1 },
        text: { color: '#ffffff' },
      };
    case 'outline':
      return {
        button: { backgroundColor: 'transparent', borderColor: '#3b82f6', borderWidth: 1.5 },
        text: { color: '#2563eb' },
      };
  }
}

function getSizeStyle(size: ButtonSize) {
  switch (size) {
    case 'sm':
      return {
        button: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
        text: { fontSize: 13, fontWeight: '600' as const },
      };
    case 'lg':
      return {
        button: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: 10 },
        text: { fontSize: 16, fontWeight: '700' as const },
      };
    case 'md':
    default:
      return {
        button: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8 },
        text: { fontSize: 14, fontWeight: '600' as const },
      };
  }
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 6,
  },
  text: {
    textAlign: 'center',
  },
});

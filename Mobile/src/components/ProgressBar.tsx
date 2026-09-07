import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

interface ProgressBarProps {
  progress: number; // 0 to 100
  color?: string;
  trackColor?: string;
  height?: number;
  style?: ViewStyle;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  color = '#2563eb',
  trackColor = '#e2e8f0',
  height = 8,
  style,
}) => {
  const clamped = Math.min(100, Math.max(0, isNaN(progress) ? 0 : progress));

  return (
    <View style={[styles.track, { backgroundColor: trackColor, height, borderRadius: height / 2 }, style]}>
      <View
        style={[
          styles.fill,
          {
            backgroundColor: color,
            width: `${clamped}%`,
            borderRadius: height / 2,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});

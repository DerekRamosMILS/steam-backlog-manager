import React, { useState } from 'react';
import {
  View,
  Image,
  StyleSheet,
  ViewStyle,
  StyleProp,
  ActivityIndicator,
  DimensionValue,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../hooks/useAppContext';

interface GameCoverProps {
  uri: string;
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

export function GameCover({
  uri,
  width = 120,
  height = 56,
  radius = 12,
  style,
}: GameCoverProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { themeColors } = useAppContext();
  const normalizedUri = typeof uri === 'string' ? uri.trim() : '';
  const showPlaceholder = error || !normalizedUri;

  return (
    <View
      style={[styles.wrapper, { width, height, borderRadius: radius, backgroundColor: themeColors.card }, style]}
    >
      {showPlaceholder ? (
        <View style={[styles.placeholder, { borderRadius: radius, backgroundColor: themeColors.card }]}>
          <Ionicons name="game-controller" size={28} color={themeColors.textMuted} />
        </View>
      ) : (
        <>
          <Image
            source={{ uri: normalizedUri }}
            style={[styles.image, { borderRadius: radius }]}
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setError(true);
            }}
            resizeMode="cover"
          />
          {loading && (
            <View style={[StyleSheet.absoluteFill, styles.loader, { borderRadius: radius, backgroundColor: themeColors.card }]}>
              <ActivityIndicator color={themeColors.accent} size="small" />
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

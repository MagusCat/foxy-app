import { View, type ViewProps } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  className?: string;
};

export function ThemedView({ style, lightColor, darkColor, className, ...otherProps }: ThemedViewProps) {
  const overrideColor = useThemeColor({ light: lightColor, dark: darkColor }, 'background');
  const hasOverride = lightColor !== undefined || darkColor !== undefined;

  return (
    <View
      className={hasOverride ? className : `bg-bg-light dark:bg-bg-dark ${className ?? ''}`}
      style={hasOverride ? [{ backgroundColor: overrideColor }, style] : style}
      {...otherProps}
    />
  );
}

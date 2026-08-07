import { Text, type TextProps } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
  className?: string;
};

const TYPE_CLASSES: Record<NonNullable<ThemedTextProps['type']>, string> = {
  default: 'text-base leading-6',
  defaultSemiBold: 'text-base leading-6 font-semibold',
  title: 'text-[32px] font-bold leading-8',
  subtitle: 'text-xl font-bold',
  link: 'text-base leading-[30px] text-[#0a7ea4]',
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  className,
  ...rest
}: ThemedTextProps) {
  const overrideColor = useThemeColor({ light: lightColor, dark: darkColor }, 'text');
  const hasOverride = lightColor !== undefined || darkColor !== undefined;
  const colorClass = type === 'link' || hasOverride ? '' : 'text-text-primary-light dark:text-text-primary-dark';

  return (
    <Text
      className={`${TYPE_CLASSES[type]} ${colorClass} ${className ?? ''}`}
      style={hasOverride ? [{ color: overrideColor }, style] : style}
      {...rest}
    />
  );
}

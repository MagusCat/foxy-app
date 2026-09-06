import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Palette, Colors } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';

const TAB_CONFIG: Record<
  string,
  { title: string; activeIcon: keyof typeof Ionicons.glyphMap; inactiveIcon: keyof typeof Ionicons.glyphMap }
> = {
  index: {
    title: 'Preguntar',
    activeIcon: 'chatbubble',
    inactiveIcon: 'chatbubble-outline',
  },
  exams: {
    title: 'Plan',
    activeIcon: 'clipboard',
    inactiveIcon: 'clipboard-outline',
  },
  class: {
    title: 'Cuaderno',
    activeIcon: 'book',
    inactiveIcon: 'book-outline',
  },
  profile: {
    title: 'Perfil',
    activeIcon: 'person',
    inactiveIcon: 'person-outline',
  },
};

function TabBarButton({
  isFocused,
  iconName,
  label,
  color,
  onPress,
  accessibilityLabel,
  testID,
}: {
  isFocused: boolean;
  iconName: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
  accessibilityLabel?: string;
  testID?: string;
}) {
  // El icono activo sube 2px — Animated.View con `style` normal (no
  // `className`), envolviendo solo el icono, nunca el TouchableOpacity: eso
  // rompe las clases de NativeWind en Android (ver advertencia 0.1 del doc).
  const lift = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    lift.value = withTiming(isFocused ? 1 : 0, { duration: 180 });
  }, [isFocused, lift]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -2 * lift.value }],
  }));

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      onPress={onPress}
      className="h-full flex-1 items-center justify-center"
      activeOpacity={0.7}
    >
      <Animated.View style={iconStyle}>
        <Ionicons name={iconName} size={20} color={color} />
      </Animated.View>
      <Text
        className="mt-0.5 text-center text-[10px] font-semibold"
        style={{ color }}
        maxFontSizeMultiplier={1.3}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function CustomFloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const keyboardHeight = useKeyboardHeight();

  if (keyboardHeight > 0) return null;

  const activeColor = isDark ? Palette.primaryGlow : Palette.primary;
  const inactiveColor = isDark ? '#8E8A99' : Colors.light.icon;
  const backgroundColor = isDark ? Palette.cardDark : Palette.cardLight;
  const borderColor = isDark ? Palette.cardDarkBorder : Palette.cardLightBorder;

  const bottomMargin = Platform.OS === 'android' ? Math.max(insets.bottom, 12) + 8 : insets.bottom + 8;

  return (
    <View
      className="absolute left-5 right-5 h-[60px] flex-row items-center justify-around rounded-[30px] border px-2 shadow-lg"
      style={{
        bottom: bottomMargin,
        backgroundColor,
        borderColor,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      }}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;

        const tabInfo = TAB_CONFIG[route.name] || {
          title: options.title || route.name,
          activeIcon: 'ellipse' as const,
          inactiveIcon: 'ellipse-outline' as const,
        };

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const color = isFocused ? activeColor : inactiveColor;
        const iconName = isFocused ? tabInfo.activeIcon : tabInfo.inactiveIcon;

        return (
          <TabBarButton
            key={route.key}
            isFocused={isFocused}
            iconName={iconName}
            label={tabInfo.title}
            color={color}
            onPress={onPress}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarButtonTestID}
          />
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomFloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        animation: 'shift',
      }}>
      <Tabs.Screen name="index" options={{ title: 'Preguntar' }} />
      <Tabs.Screen name="exams" options={{ title: 'Plan' }} />
      <Tabs.Screen name="class" options={{ title: 'Cuaderno' }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}

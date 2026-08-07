import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Palette, Colors } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

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
    title: 'Examenes',
    activeIcon: 'document-text',
    inactiveIcon: 'document-text-outline',
  },
  class: {
    title: 'Clase',
    activeIcon: 'school',
    inactiveIcon: 'school-outline',
  },
  profile: {
    title: 'Perfil',
    activeIcon: 'person',
    inactiveIcon: 'person-outline',
  },
};

function CustomFloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();

  const activeColor = isDark ? Palette.primaryGlow : Palette.primary;
  const inactiveColor = isDark ? '#8E8A99' : Colors.light.icon;
  const backgroundColor = isDark ? Palette.cardDark : Palette.cardLight;
  const borderColor = isDark ? Palette.cardDarkBorder : Palette.cardLightBorder;

  // Elevación sobre la barra del sistema (3 botones o gestos) en Android/iOS
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
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarButtonTestID}
            onPress={onPress}
            className="h-full flex-1 items-center justify-center"
            activeOpacity={0.7}
          >
            <Ionicons name={iconName} size={20} color={color} />
            <Text
              className="mt-0.5 text-center text-[10px] font-semibold"
              style={{ color }}
              // La etiqueta es de 10px: sin tope, una fuente grande del
              // sistema desborda y parte la barra flotante.
              maxFontSizeMultiplier={1.3}
              numberOfLines={1}
            >
              {tabInfo.title}
            </Text>
          </TouchableOpacity>
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
      }}>
      <Tabs.Screen name="index" options={{ title: 'Preguntar' }} />
      <Tabs.Screen name="exams" options={{ title: 'Examenes' }} />
      <Tabs.Screen name="class" options={{ title: 'Clase' }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}

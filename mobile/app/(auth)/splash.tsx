import React, { useEffect } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';

import { BrandLogo } from '@/components/brand-logo';
import { Palette } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';

const SPLASH_MS = 1400;

export default function SplashScreen() {
  const router = useRouter();
  const { hasSeenOnboarding } = useAuth();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace(hasSeenOnboarding ? '/login' : '/onboarding');
    }, SPLASH_MS);

    return () => clearTimeout(timer);
  }, [router, hasSeenOnboarding]);

  return (
    <View className="flex-1 items-center justify-center" style={{ backgroundColor: Palette.primary }}>
      <StatusBar style="light" />
      <BrandLogo size={72} withWordmark background="#FFFFFF" wordmarkColor="#FFFFFF" />
    </View>
  );
}

import React, { useEffect, useRef } from 'react';
import { Keyboard, Platform, View } from 'react-native';

// TEST-ONLY keyboard overlap probe. Wrap a sheet's root View and read
// logcat: overlap=0 means the focused input is fully visible above the
// keyboard. Non-zero reproduces the buried-input bug with a number attached.
export default function KeyboardProbe({ children }: { children: React.ReactNode }) {
  const ref = useRef<View | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = Keyboard.addListener('keyboardDidShow', (e) => {
      ref.current?.measureInWindow((_x, y, _w, h) => {
        const overlap = Math.max(0, y + h - e.endCoordinates.screenY);
        console.log(`[KB-PROBE] overlap=${Math.round(overlap)}px (0 = fully visible)`);
      });
    });
    return () => sub.remove();
  }, []);

  return (
    <View ref={ref} style={{ flex: 1 }}>
      {children}
    </View>
  );
}

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, usePathname, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/Auth';
import { useBack } from '../context/Back';
import { useDrawer } from '../context/Drawer';
import { useTheme } from '../context/Theme';
import { useNotifications } from '../context/Notifications';
import Icon from './Icon';

const TAB_ROOTS = ['/', '/partners', '/osce', '/chat', '/focus'];

// Green top app bar — burger on root tabs, back on pushed screens (matches web TopBar).
export default function TopBar() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { setOpen: setDrawerOpen } = useDrawer();
  const { setOpen: setBellOpen, totalCount } = useNotifications();
  const { backHandler } = useBack();
  const navigation = useNavigation();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const showBack = !TAB_ROOTS.includes(pathname) || !!backHandler;
  const goBack = () => {
    if (backHandler) backHandler();
    else navigation.goBack();
  };
  const onProfile = pathname === '/profile';

  const initials = (user?.name || 'Dr A')
    .replace(/^Dr\.?\s+/i, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase())
    .join('');

  return (
    <View style={[styles.bar, { paddingTop: insets.top + 12, backgroundColor: colors.topbarBg }]}>
      <View style={styles.side}>
        {showBack ? (
          <Pressable style={styles.iconBtn} onPress={goBack} accessibilityLabel="Back">
            <Icon name="back" size={24} color="#fff" />
          </Pressable>
        ) : (
          <Pressable style={styles.iconBtn} onPress={() => setDrawerOpen(true)} accessibilityLabel="Menu">
            <View style={styles.burger}>
              <View style={styles.burgerLine} />
              <View style={styles.burgerLine} />
              <View style={styles.burgerLine} />
            </View>
          </Pressable>
        )}
      </View>

      <Text style={styles.title} numberOfLines={1}>
        MedConnect
      </Text>

      <View style={[styles.side, styles.sideRight]}>
        {user && !onProfile && (
          <Pressable
            style={[styles.iconBtn, { opacity: totalCount > 0 ? 1 : 0.65 }]}
            accessibilityLabel="Notifications"
            onPress={() => setBellOpen(true)}
          >
            <View>
              <Icon name="bell" size={20} color="#fff" strokeWidth={1.8} />
              {totalCount > 0 && (
                <View style={[styles.badge, { borderColor: colors.topbarBg }]}>
                  <Text style={styles.badgeText}>{totalCount > 9 ? '9+' : totalCount}</Text>
                </View>
              )}
            </View>
          </Pressable>
        )}
        {!onProfile && (
          <Pressable
            style={styles.avatar}
            accessibility-label="Profile"
            onPress={() => router.push('/profile')}
          >
            <Text style={styles.avatarText}>{user?.avatar || initials}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    minHeight: 60,
  },
  side: { width: 76, flexShrink: 0, flexDirection: 'row', alignItems: 'center' },
  sideRight: { justifyContent: 'flex-end', gap: 8 },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  burger: { width: 22, gap: 4 },
  burgerLine: { height: 2.2, width: 22, backgroundColor: '#fff', borderRadius: 2 },
  title: {
    flex: 1,
    textAlign: 'center',
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,.16)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  badge: {
    position: 'absolute',
    top: -3,
    right: -4,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#a8442a',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
});

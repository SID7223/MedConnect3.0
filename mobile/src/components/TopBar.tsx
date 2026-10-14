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
import Wordmark from './Wordmark';
import { border } from '../theme/tokens';

// Tab roots - shared with Back.tsx so the hardware-back exit gate and the
// TopBar burger/back swap agree on what "root" means. Keep in sync with
// TAB_META in app/(main)/(tabs)/_layout.tsx.
export const TAB_ROOTS = ['/', '/partners', '/osce', '/chat', '/focus'];

// Top app bar - burger on root tabs, back on pushed screens.
//
// Home: transparent, icons sit straight on the page. Everywhere else: card
// fill with a 1.5px hairline under it, ink-coloured content. The avatar always
// carries the mint ring.
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
    else if (navigation.canGoBack()) navigation.goBack();
    // Deep-link / fresh-stack entry has nothing to pop — a dead back button
    // is worse than a redirect, so land on Home instead.
    else router.replace('/');
  };
  const onProfile = pathname === '/profile';

  const initials = (user?.name || 'Dr A')
    .replace(/^Dr\.?\s+/i, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase())
    .join('');

  const isHome = pathname === '/';

  return (
    <View
      style={[
        styles.bar,
        {
          paddingTop: insets.top + 10,
          paddingBottom: isHome ? 2 : 12,
          backgroundColor: isHome ? 'transparent' : colors.card,
          borderBottomWidth: isHome ? 0 : border.hair,
          borderBottomColor: colors.line,
        },
      ]}
    >
      <View style={[styles.side, isHome && styles.sideHome]}>
        {showBack ? (
          <Pressable
            style={[styles.iconBtn]}
            onPress={goBack}
            accessibilityLabel="Back"
          >
            <Icon name="back" size={24} color={colors.ink} />
          </Pressable>
) : isHome ? (
          <Pressable
            style={[styles.menuBtn]}
            onPress={() => setDrawerOpen(true)}
            accessibilityLabel="Menu"
          >
            <Icon name="menu" size={24} color={colors.ink} strokeWidth={2.2} />
            <Wordmark size={23} color={colors.ink} />
          </Pressable>
        ) : (
          <Pressable
            style={[styles.iconBtn]}
            onPress={() => setDrawerOpen(true)}
            accessibilityLabel="Menu"
          >
            <Icon name="menu" size={24} color={colors.ink} strokeWidth={2.2} />
          </Pressable>
        )}
      </View>

      {isHome ? null : <View style={styles.spacer} />}

      <View style={[styles.side, styles.sideRight]}>
        {user && !onProfile && (
          <Pressable
            style={[styles.bellBtn]}
            accessibilityLabel="Notifications"
            onPress={() => setBellOpen(true)}
          >
            <View>
              <Icon name="bell" size={20} color={colors.ink} strokeWidth={1.8} />
              {totalCount > 0 && (
                      <View style={[styles.badge, { backgroundColor: colors.orange, borderColor: colors.card }]}>
                        <Text style={[styles.badgeText, { color: colors.onForest }]}>
                          {totalCount > 9 ? '9+' : totalCount}
                        </Text>
                      </View>
              )}
            </View>
          </Pressable>
        )}
        {!onProfile && (
          <Pressable
            style={[
              styles.avatar,
              { backgroundColor: colors.tintGreen, borderColor: colors.mint },
            ]}
            accessibility-label="Profile"
            onPress={() => router.push('/profile')}
          >
            <Text style={[styles.avatarText, { color: colors.inkSoft }]}>
              {user?.avatar || initials}
            </Text>
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
  side: { width: 82, flexShrink: 0, flexDirection: 'row', alignItems: 'center' },
  // Home leads with the wordmark, so the left slot absorbs the spare width
  sideHome: { flexGrow: 1, width: undefined },
  sideRight: { justifyContent: 'flex-end', gap: 8 },
  iconBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    backgroundColor: 'transparent',
  },
  // Home's left slot pairs the burger with the wordmark in a single Menu
  // target - the wordmark alone opened the drawer before, undiscoverably -
  // and sizes to its content instead of boxing at 38x38 (which wrapped and
  // clipped "MedPeers").
  menuBtn: {
    minHeight: 38,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bellBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: 'transparent',
  },
  spacer: {
    // non-home headers carry no center content (the wordmark lives on Home
    // only) - this keeps the bell/avatar pinned right.
    flex: 1,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#171310',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  avatarText: { fontWeight: '800', fontSize: 13 },
  badge: {
    position: 'absolute',
    top: -3,
    right: -4,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  badgeText: { fontSize: 9, fontWeight: '800' },
});

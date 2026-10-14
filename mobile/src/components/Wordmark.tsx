import React from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';
import { NEWSREADER } from '../theme/fonts';

interface WordmarkProps {
  /** font size of the "Med" half */
  size?: number;
  color?: string;
  /** font size of the "peers" half - defaults to a touch larger than `size` */
  peersSize?: number;
  style?: StyleProp<TextStyle>;
}

// The MedPeers wordmark: "Med" in the heavy platform sans + "peers" in
// UPRIGHT (non-italic) Newsreader Medium.
//
// "peers" pins fontWeight to '500' on purpose. Nested Text inherits the parent's
// '900', and Android resolves fontWeight first - it would then hunt for a
// `Newsreader_500Medium_bold.ttf` that does not exist and silently fall back to
// the system sans, losing the serif entirely.
export default function Wordmark({ size = 20, color, peersSize, style }: WordmarkProps) {
  const peers = peersSize ?? size + Math.max(1, Math.round(size * 0.08));
  const track = -size * 0.035;

  return (
    <Text
      accessibilityRole="header"
      accessibilityLabel="MedPeers"
      style={[{ fontSize: size, fontWeight: '900', letterSpacing: track, color }, style]}
    >
      Med
      <Text style={{ fontFamily: NEWSREADER, fontWeight: '500', fontSize: peers, letterSpacing: track * 0.6 }}>
        Peers
      </Text>
    </Text>
  );
}

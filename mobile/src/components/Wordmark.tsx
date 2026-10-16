import React from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';
import { SCRIPT } from '../theme/fonts';

interface WordmarkProps {
  /** font size of the "Med" half */
  size?: number;
  color?: string;
  /** font size of the "peers" half - defaults to a touch larger than `size` */
  peersSize?: number;
  style?: StyleProp<TextStyle>;
}

// The MedPeers wordmark: "Med" in the heavy platform sans + "Peers" in a
// joining script hand (Pacifico Regular).
//
// "Peers" pins fontWeight 'normal' on purpose. The parent carries '900', and
// if it is inherited Android hunts a bold variant file that does not exist
// and silently falls back to the system sans (this regressed the wordmark to
// a plain sans the moment the pin was removed). An explicit normal-bucket
// weight loads the asset file directly. LetterSpacing stays 0 so the
// letterforms stay connected.
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
      <Text style={{ fontFamily: SCRIPT, fontWeight: 'normal', fontSize: peers }}>
        Peers
      </Text>
    </Text>
  );
}

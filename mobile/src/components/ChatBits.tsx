import React from 'react';
import { Text } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../context/Theme';

// Shared pieces for the chat screens — port of src/components/ChatBits.jsx.

interface IcoProps {
  color?: string;
  size?: number;
}

const ICO = {
  fill: 'none' as const,
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const SendIcon = ({ color = '#fff', size = 20 }: IcoProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ marginLeft: 2 }}>
    <Path d="M3.4 20.4l17.8-7.6c.8-.35.8-1.25 0-1.6L3.4 3.6c-.66-.28-1.4.2-1.4.9v5.2c0 .5.37.93.87 1L14 12 2.87 13.3c-.5.07-.87.5-.87 1v5.2c0 .7.74 1.18 1.4.9z" />
  </Svg>
);

export const IcoPlus = ({ color = '#15201c', size = 15 }: IcoProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...ICO} stroke={color}>
    <Path d="M12 5v14M5 12h14" />
  </Svg>
);

export const IcoUsers = ({ color = '#15201c', size = 15 }: IcoProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...ICO} stroke={color}>
    <Circle cx="9" cy="8" r="3.2" />
    <Path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
    <Circle cx="17" cy="9" r="2.6" />
    <Path d="M16 14.2c2.4.3 4.2 2.1 4.2 4.8" />
  </Svg>
);

export const IcoLeave = ({ color = '#15201c', size = 15 }: IcoProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...ICO} stroke={color}>
    <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <Path d="M16 17l5-5-5-5" />
    <Path d="M21 12H9" />
  </Svg>
);

export const IcoTrash = ({ color = '#15201c', size = 15 }: IcoProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...ICO} stroke={color}>
    <Path d="M3 6h18" />
    <Path d="M8 6V4h8v2" />
    <Path d="M19 6l-1 14H6L5 6" />
    <Path d="M10 11v6M14 11v6" />
  </Svg>
);

export const IcoBan = ({ color = '#15201c', size = 15 }: IcoProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...ICO} stroke={color}>
    <Circle cx="12" cy="12" r="9" />
    <Path d="M5.5 5.5l13 13" />
  </Svg>
);

export const IcoFlag = ({ color = '#15201c', size = 15 }: IcoProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...ICO} stroke={color}>
    <Path d="M4 21V4" />
    <Path d="M4 4h12l-2 4 2 4H4" />
  </Svg>
);

export const IcoAddUser = ({ color = '#fff', size = 24 }: IcoProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...ICO} strokeWidth={2} stroke={color}>
    <Circle cx="9" cy="8" r="3.2" />
    <Path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
    <Path d="M18 7v6M21 10h-6" />
  </Svg>
);

export interface Person {
  id: string | number;
  name: string;
  avatar?: string;
}

// turn a connection record into the "other person" {id, name, avatar}
export function otherPerson(c: any, myId: string | number | null | undefined): Person {
  const iAmRequester = String(c?.requester) === String(myId);
  return {
    id: iAmRequester ? c.recipient : c.requester,
    name: iAmRequester ? c.recipient_name : c.requester_name,
    avatar: iAmRequester ? c.recipient_avatar : c.requester_avatar,
  };
}

// "14:32"-style timestamp for message bubbles
export function fmtTime(ts?: string): string {
  try {
    const d = new Date(ts || '');
    if (isNaN(d.getTime())) return '';
    const h24 = d.getHours();
    const m = d.getMinutes();
    const h = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${h}:${m < 10 ? '0' : ''}${m} ${h24 >= 12 ? 'PM' : 'AM'}`;
  } catch {
    return '';
  }
}

// small stamp shown inside a bubble
export const Stamp = ({ ts, light }: { ts?: string; light?: boolean }) => {
  const { colors } = useTheme();
  const t = fmtTime(ts);
  if (!t) return null;
  return (
    <Text style={{ fontSize: 9.5, opacity: 0.65, textAlign: 'right', marginTop: 3, color: light ? '#e7f3ee' : colors.muted }}>
      {t}
    </Text>
  );
};

// Promise-based confirmation — re-exported from ConfirmDialog (the system-wide
// "Compact Pill" dialog) so existing imports from ChatBits keep working.
export { confirmAlert } from './ConfirmDialog';

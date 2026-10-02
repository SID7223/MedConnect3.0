import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'home'
  | 'partners'
  | 'osce'
  | 'chat'
  | 'focus'
  | 'profile'
  | 'bell'
  | 'back'
  | 'labs'
  | 'formulas'
  | 'resources'
  | 'insights'
  | 'notes'
  | 'planner'
  | 'invite'
  | 'pro'
  | 'info'
  | 'dev'
  | 'file'
  | 'logout'
  | 'cloudOff';

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

// Ported from src/App.jsx inline SVGs — stroke uses the given color instead of currentColor.
export default function Icon({ name, size = 22, color = '#fff', strokeWidth = 1.8 }: Props) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (name) {
    case 'home':
      return (
        <Svg {...common}>
          <Path d="M3 11l9-8 9 8" />
          <Path d="M5 10v10h14V10" />
        </Svg>
      );
    case 'partners':
      return (
        <Svg {...common}>
          <Circle cx="6" cy="6.5" r="2" />
          <Circle cx="18" cy="7.5" r="2" />
          <Circle cx="12" cy="17" r="2" />
          <Path d="M7.7 7.7l8.6 8.6M16.3 9l-8.4 6.6M8 6.8l8-.6" />
        </Svg>
      );
    case 'osce':
      return (
        <Svg {...common}>
          <Path d="M6 2.5v5.5a4 4 0 0 0 8 0V2.5" />
          <Path d="M4.5 2.5h3M12.5 2.5h3" />
          <Circle cx="18" cy="16.5" r="2.8" />
          <Path d="M18 13.7V12" />
          <Path d="M10 12v2.5a6 6 0 0 0 5.3 5.95" />
          <Circle cx="18" cy="16.5" r="1" />
        </Svg>
      );
    case 'chat':
      return (
        <Svg {...common}>
          <Path d="M4 5h16v11H7l-3 3z" />
          <Path d="M8 11.5h2l1-2 1.5 4 1-2h2.5" />
        </Svg>
      );
    case 'focus':
      return (
        <Svg {...common}>
          <Path d="M12 4.5C10.5 3 8 3.3 7 5c-1.8.2-2.8 1.7-2.4 3.2C3.4 9.2 3.3 11 4.6 12c-.6 1.4 0 3 1.5 3.5.3 1.6 2 2.5 3.5 1.8.7.8 2 .9 2.4 0" />
          <Path d="M12 4.5C13.5 3 16 3.3 17 5c1.8.2 2.8 1.7 2.4 3.2C20.6 9.2 20.7 11 19.4 12c.6 1.4 0 3-1.5 3.5-.3 1.6-2 2.5-3.5 1.8-.7.8-2 .9-2.4 0" />
          <Path d="M12 4.5v13" />
          <Path d="M7 8c1.2.3 2 1.2 2.2 2.5M17 8c-1.2.3-2 1.2-2.2 2.5" />
        </Svg>
      );
    case 'profile':
      return (
        <Svg {...common}>
          <Circle cx="12" cy="12" r="9" />
          <Circle cx="12" cy="10" r="3" />
          <Path d="M6.5 18.5c1-2.3 3.1-3.5 5.5-3.5s4.5 1.2 5.5 3.5" />
        </Svg>
      );
    case 'bell':
      return (
        <Svg {...common}>
          <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </Svg>
      );
    case 'back':
      return (
        <Svg {...common} strokeWidth={2.2}>
          <Path d="M15 18l-6-6 6-6" />
        </Svg>
      );
    case 'labs':
      return (
        <Svg {...common}>
          <Path d="M9 3h6M10 3v6.5L5.5 17a2 2 0 0 0 1.7 3h9.6a2 2 0 0 0 1.7-3L14 9.5V3" />
          <Path d="M8 14h8" />
        </Svg>
      );
    case 'formulas':
      return (
        <Svg {...common}>
          <Path d="M4 4h16M4 4v16M9 9l4 4M13 9l-4 4M8 18h8" />
        </Svg>
      );
    case 'resources':
      return (
        <Svg {...common}>
          <Path d="M4 5a2 2 0 0 1 2-2h11v18H6a2 2 0 0 1-2-2V5z" />
          <Path d="M8 7h7M8 11h7M8 15h4" />
        </Svg>
      );
    case 'insights':
      return (
        <Svg {...common}>
          <Path d="M12 2a7 7 0 0 1 7 7c0 2.4-1.2 4.5-3 5.7V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.3C6.2 13.5 5 11.4 5 9a7 7 0 0 1 7-7z" />
          <Path d="M9 21h6M10 17v-2a2 2 0 0 0-2-2M14 17v-2a2 2 0 0 1 2-2" />
        </Svg>
      );
    case 'notes':
      return (
        <Svg {...common}>
          <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <Path d="M14 2v6h6M8 13h8M8 17h5" />
        </Svg>
      );
    case 'planner':
      return (
        <Svg {...common}>
          <Rect x="3" y="4" width="18" height="18" rx="2" />
          <Path d="M16 2v4M8 2v4M3 10h18M8 14h2M14 14h2M8 18h2M14 18h2" />
        </Svg>
      );
    case 'invite':
      return (
        <Svg {...common}>
          <Path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <Circle cx="9" cy="7" r="4" />
          <Path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <Path d="M19 8v6M22 11h-6" />
        </Svg>
      );
    case 'pro':
      return (
        <Svg {...common}>
          <Rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
          <Path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
        </Svg>
      );
    case 'info':
      return (
        <Svg {...common}>
          <Circle cx="12" cy="12" r="10" />
          <Path d="M12 16v-4M12 8h.01" />
        </Svg>
      );
    case 'dev':
      return (
        <Svg {...common}>
          <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <Circle cx="12" cy="7" r="4" />
        </Svg>
      );
    case 'file':
      return (
        <Svg {...common}>
          <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <Path d="M14 2v6h6" />
        </Svg>
      );
    case 'logout':
      return (
        <Svg {...common}>
          <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <Path d="M16 17l5-5-5-5M21 12H9" />
        </Svg>
      );
    case 'cloudOff':
      return (
        <Svg {...common}>
          <Path d="M7 19a4.25 4.25 0 0 1 0-8.5 5 5 0 0 1 10 0 4.25 4.25 0 0 1 0 8.5z" />
          <Path d="M4.5 19.5L19.5 4.5" />
        </Svg>
      );
    default:
      return null;
  }
}

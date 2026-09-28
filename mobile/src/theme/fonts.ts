import { Platform } from 'react-native';

// Serif display font used for headings/quotes (web uses Fraunces/Newsreader via CSS).
// Fall back to the platform serif since no custom font files are bundled yet.
export const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

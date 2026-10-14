export interface Bio {
  p: string;
  r: string;
  legacy: string;
}

// tags are packed into the existing `bio` column as JSON {p, r}
export function unpackBio(bio: string): Bio {
  if (!bio) return { p: '', r: '', legacy: '' };
  try {
    const o = JSON.parse(bio);
    if (o && (typeof o.p === 'string' || typeof o.r === 'string')) {
      return { p: o.p || '', r: o.r || '', legacy: '' };
    }
  } catch {
    // not JSON - treat the whole value as the legacy free-text bio
  }
  return { p: '', r: '', legacy: bio };
}

export function packBio(p: string, r: string): string {
  return JSON.stringify({ p: p || '', r: r || '' });
}

export function bioTags(bio: string): string[] {
  const u = unpackBio(bio);
  return [
    ...u.p.split(',').map((x) => x.trim()).filter(Boolean),
    ...u.r.split(',').map((x) => x.trim()).filter(Boolean),
  ];
}

// Human-readable bio line for profile cards/peeks: the packed tags joined for
// reading, or the legacy free-text bio; '' when there is nothing to show
// (packed JSON with empty tags must never leak into the UI).
export function bioDisplay(bio: string): string {
  const tags = bioTags(bio);
  if (tags.length) return tags.join(' · ');
  return unpackBio(bio).legacy;
}

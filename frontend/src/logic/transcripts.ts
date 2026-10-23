export interface Transcript {
  title: string;
  file: string;
  bytes: number;
}

export const TRANSCRIPTS: readonly Transcript[] = [
  { title: '1337 design system', file: '1337-design-system.md', bytes: 14250 },
  { title: 'Backend planning', file: 'backend-planning.md', bytes: 15191 },
  { title: 'Backend build session', file: 'backend-build.md', bytes: 84326 },
];

export const transcriptHref = (t: Transcript) => `/transcripts/${t.file}`;

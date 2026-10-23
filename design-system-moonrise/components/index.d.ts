import type * as React from 'react';

export type TaskState = 'running' | 'finished' | 'cancelled';
export interface TaskEventLine { id: number; state: TaskState; at: string; name?: string }

export interface SegmentClockProps {
  /** Digits, plus colons for countdowns: "1337" (the word, no colon), "04:12", "1:02:41". Default "1337". */
  value?: string;
  /** Rendered height in px; width follows. Default 120. */
  height?: number;
  /** Now and then drop a segment or dip the whole display for a frame, like a tired LED. */
  flicker?: boolean;
  /** Fill the container's width instead (the hero on phones); height follows. */
  fluid?: boolean;
  /** Shift left when the value starts with "1" (which lights only its right-hand bars), so the word looks centred. */
  opticalCenter?: boolean;
  /** Blink the colon at 1 Hz when the value has one. Default true. */
  blinkColon?: boolean;
  /** On mount: every digit scrambles through random numbers, then they lock in from left to right. */
  boot?: boolean;
  /** Change this value to flash the clock once (one flash per stream event). */
  pulseKey?: string | number;
  /** Fast stepped pulse for the last 10 seconds and "Finishing…". */
  urgent?: boolean;
  /** Unlit look for ended timers: grey segments, no glow. */
  dim?: boolean;
  /** Blurred mirror image below the clock, for the hero over the clouds. */
  reflect?: boolean;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}
export declare function SegmentClock(props: SegmentClockProps): React.ReactElement;

export interface MoonPhaseProps { /** 0 = new moon (just started) … 1 = full moon (done). */ progress: number; size?: number; className?: string }
export declare function MoonPhase(props: MoonPhaseProps): React.ReactElement;

export interface LiveIndicatorProps { status?: 'live' | 'connecting' | 'reconnecting'; className?: string }
export declare function LiveIndicator(props: LiveIndicatorProps): React.ReactElement;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary: solid ink, once per view · glass: frosted, hairline border · text: underline grows on hover · cancel: text that turns red on hover. Default glass. */
  variant?: 'primary' | 'glass' | 'text' | 'cancel';
}
export declare function Button(props: ButtonProps): React.ReactElement;

export interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  /** Muted text after the value, e.g. "= 3m". */
  hint?: string;
  /** Sentence-case message under the field, in `alert`. */
  error?: string;
}
export declare function Field(props: FieldProps): React.ReactElement;

export interface StartFormProps {
  defaultName?: string;
  /** Default 180. */
  defaultSeconds?: number;
  /** Called with valid values: name trimmed 1–100 chars, seconds integer 1–86400. */
  onStart?: (value: { name: string; seconds: number }) => void;
  /** A server error (400) to show under the bar. */
  error?: string;
  submitting?: boolean;
  idPrefix?: string;
  className?: string;
}
export declare function StartForm(props: StartFormProps): React.ReactElement;

export interface PanelProps { strong?: boolean; glow?: boolean; as?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }
export declare function Panel(props: PanelProps): React.ReactElement;

export interface TimerCardProps {
  name: string;
  /** Full task UUID; the card shows the first 8 characters, the full id on hover. */
  id: string;
  remainingMs: number;
  durationMs: number;
  /** Local end time, "00:43:36". */
  endsAt: string;
  state?: 'running' | 'finishing' | 'cancelling' | 'finished' | 'cancelled';
  /** Plays the exit animation, then the app moves the timer to the archive. */
  exit?: 'finished' | 'cancelled';
  /** e.g. a 409 on cancel. */
  error?: string;
  historyOpen?: boolean;
  history?: TaskEventLine[];
  onToggleHistory?: () => void;
  onCancel?: () => void;
  clockHeight?: number;
  className?: string;
}
export declare function TimerCard(props: TimerCardProps): React.ReactElement;

export interface HistoryTimelineProps { events: TaskEventLine[]; className?: string }
export declare function HistoryTimeline(props: HistoryTimelineProps): React.ReactElement;

export interface LiveFeedProps {
  /** Oldest first, at most 50. */
  lines: Array<{ id: number; name: string; state: TaskState; at: string }>;
  lastId?: number | null;
  status?: 'live' | 'connecting' | 'reconnecting';
  /** Flash the newest line once. */
  highlightLast?: boolean;
  className?: string;
}
export declare function LiveFeed(props: LiveFeedProps): React.ReactElement;

export interface StatsProps { items: Array<{ label: string; value: React.ReactNode }>; className?: string }
export declare function Stats(props: StatsProps): React.ReactElement;

export interface ArchiveRow { id: string; name: string; state: 'finished' | 'cancelled'; duration: string; ended: string; history?: TaskEventLine[] }
export interface ArchiveTableProps {
  /** Newest first; show 20, then "Show all (n)". */
  rows: ArchiveRow[];
  total?: number;
  openId?: string | null;
  onToggleHistory?: (id: string) => void;
  onShowAll?: () => void;
  className?: string;
}
export declare function ArchiveTable(props: ArchiveTableProps): React.ReactElement;

export interface SheetProps { title: string; onClose?: () => void; footer?: React.ReactNode; className?: string; style?: React.CSSProperties; children?: React.ReactNode }
export declare function Sheet(props: SheetProps): React.ReactElement;

export interface NavProps { links?: string[]; githubUrl?: string; status?: 'live' | 'connecting' | 'reconnecting'; onMenu?: () => void; className?: string }
export declare function Nav(props: NavProps): React.ReactElement;

export interface LogoProps { size?: number; className?: string }
export declare function Logo(props: LogoProps): React.ReactElement;

export interface SceneProps {
  /** The moon photograph (frontend/public/moonrise/moon.webp). Without it a placeholder moon is drawn. */
  moonSrc?: string;
  /** Override the photo's width (default max(100%, 135vh)). */
  moonWidth?: string;
  /** Default 100vh. */
  height?: number | string;
  /** Where the moon's limb lands, in % of the hero height. Default 68, which leaves the 1337 display centred above it. */
  horizon?: number;
  /** A giant word ("TIMER") between the moon and the clouds. It rises into view as the hero scrolls away. */
  word?: string;
  /** Show the word in its risen state without the scroll animation (for static comps). */
  wordStatic?: boolean;
  seed?: number;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Only the 1337 SegmentClock. */
  children?: React.ReactNode;
}
export declare function Scene(props: SceneProps): React.ReactElement;

export interface CloudFloorProps {
  /** The cloud layer (frontend/public/moonrise/clouds.webp). */
  cloudSrc?: string;
  className?: string;
  style?: React.CSSProperties;
  /** The sections that sit on the gradient below the clouds. */
  children?: React.ReactNode;
}
export declare function CloudFloor(props: CloudFloorProps): React.ReactElement;

export interface GrainProps { /** Defaults to the grain-opacity token. */ opacity?: number; className?: string }
export declare function Grain(props: GrainProps): React.ReactElement;

export interface NotebookProps {
  /** Cover image (front of the closed notebook). */
  coverSrc: string;
  /** Blank page image, used for both pages (the left one is mirrored so its tabs face out). */
  paperSrc: string;
  /** Handwriting scans (ink on white), laid on the pages with multiply and turned red. */
  leftSrc?: string;
  rightSrc?: string;
  leftAlt?: string;
  rightAlt?: string;
  coverAlt?: string;
  /** One page's width in px; height is 1.5 × width. Default 400. */
  pageWidth?: number;
  /** Controlled open state. */
  open?: boolean;
  /** Open by itself after `autoOpenDelay` ms (default 700) — the opening scene when the notebook is shown. */
  autoOpen?: boolean;
  autoOpenDelay?: number;
  /** Clicking the cover or the left page toggles it. */
  onToggle?: (open: boolean) => void;
  className?: string;
  /** Extra marks on the right page, e.g. the drawing layer. */
  children?: React.ReactNode;
}
export declare function Notebook(props: NotebookProps): React.ReactElement;

export interface FooterProps { links?: Array<{ label: string; href: string; onClick?: (e: unknown) => void; external?: boolean }>; className?: string; style?: React.CSSProperties }
export declare function Footer(props: FooterProps): React.ReactElement;

export interface WordmarkProps { text?: string; decorative?: boolean; className?: string }
export declare function Wordmark(props: WordmarkProps): React.ReactElement;

declare global {
  interface Window {
    Moonrise: {
      SegmentClock: typeof SegmentClock; MoonPhase: typeof MoonPhase; LiveIndicator: typeof LiveIndicator;
      Button: typeof Button; Field: typeof Field; StartForm: typeof StartForm; Panel: typeof Panel;
      TimerCard: typeof TimerCard; HistoryTimeline: typeof HistoryTimeline; LiveFeed: typeof LiveFeed;
      Stats: typeof Stats; ArchiveTable: typeof ArchiveTable; Sheet: typeof Sheet; Notebook: typeof Notebook; Nav: typeof Nav;
      Logo: typeof Logo; Footer: typeof Footer; Scene: typeof Scene; CloudFloor: typeof CloudFloor; Grain: typeof Grain; Wordmark: typeof Wordmark;
      util: { countdown(ms: number): string; humanize(seconds: number): string; lockScroll(on: boolean): void; useScrollLock(on: boolean): void };
    };
  }
}

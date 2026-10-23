import { useEffect, useState } from 'react';
import type { Loadable } from './loadable';
import { transcriptHref, type Transcript } from './transcripts';

type Loaded = { file: string; result: Loadable<string> };

// The text of the selected transcript. Every new selection, the same file
// reopened included, starts at loading: an old result is never shown.
export function useTranscript(
  selected: Transcript | null,
): Loadable<string> | null {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [prev, setPrev] = useState(selected);
  if (prev !== selected) {
    setPrev(selected);
    setLoaded(null);
  }

  useEffect(() => {
    if (!selected) return;
    let alive = true;
    const file = selected.file;
    fetch(transcriptHref(selected))
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then(
        (text) =>
          alive &&
          setLoaded({ file, result: { status: 'ready', value: text } }),
        () => alive && setLoaded({ file, result: { status: 'failed' } }),
      );
    return () => {
      alive = false;
    };
  }, [selected]);

  if (!selected) return null;
  return loaded && loaded.file === selected.file
    ? loaded.result
    : { status: 'loading' };
}

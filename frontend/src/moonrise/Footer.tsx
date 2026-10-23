// The page's end: its links as a belt of white rules on the cropped wordmark.
export function Footer({
  onTranscripts,
  onNotebook,
}: {
  onTranscripts: () => void;
  onNotebook: () => void;
}) {
  return (
    <footer className="ms-footer ms-page-foot">
      <nav className="ms-belt" aria-label="More">
        <a
          className="ms-belt-link"
          href="https://github.com/auermatew/1337_prep"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub ↗
        </a>
        <button type="button" className="ms-belt-link" onClick={onTranscripts}>
          Transcripts
        </button>
        <button type="button" className="ms-belt-link" onClick={onNotebook}>
          Notebook
        </button>
      </nav>
      <div className="ms-wordmark" aria-hidden="true">
        <span>1337</span>
      </div>
    </footer>
  );
}

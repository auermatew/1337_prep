// Did the Moonrise stylesheet really arrive? A server with an SPA fallback
// answers a missing CSS file with index.html, which the browser "loads" as a
// stylesheet that does nothing. Moonrise's tokens live on .moonrise, so a
// hidden probe tells.
export function moonriseStylesApplied(): boolean {
  const probe = document.createElement('div');
  probe.className = 'moonrise';
  probe.hidden = true;
  document.body.append(probe);
  const sky = getComputedStyle(probe).getPropertyValue('--sky-0').trim();
  probe.remove();
  return sky !== '';
}

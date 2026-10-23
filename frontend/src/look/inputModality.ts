// Was the last click made with a mouse, finger or pen? A pointer click
// carries a click count (detail ≥ 1); a click made from the keyboard (Enter,
// Space) has none. Focus is moved or restored for keyboard users only: on a
// touch screen a programmatic focus leaves a focus ring that has to be
// tapped away.
let pointer = false;

if (typeof document !== 'undefined') {
  document.addEventListener(
    'click',
    (e) => {
      pointer = e.detail > 0;
    },
    true,
  );
}

export function lastClickWasPointer(): boolean {
  return pointer;
}

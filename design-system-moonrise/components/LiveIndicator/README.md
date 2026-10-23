# LiveIndicator

Connection state of the event stream: one glowing segment (a single bar of the clock, never a dot) and a word.

- `status`: `live` (lit, glowing) · `connecting` (dim `signal-dim`) · `reconnecting` (blinking). Text: "Live", "Connecting…", "Reconnecting…".
- `size="lg"` is the page's connection state, set under the live feed on the right: display face at 20px, a 28×7 segment with a slow breathing glow. The small size is for dense spots only.

# Grain

Hard film noise that lives in the backgrounds only: the sky, the cloud floor, the page ground and the footer gradient. It never sits on top of images, panels, the 1337 display or text.

- `Scene`, `CloudFloor` and `Wordmark` carry it already. Put the class `ms-noise` on any other background (the page root, a section) to add it there; it draws under that element's content.
- Strength is `grain-opacity`.
- The `Grain` component (a full-screen overlay) is kept only for old pages. Don't use it: it puts noise over everything.

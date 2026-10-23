# CloudFloor

The divider under the hero. The cloud layer overlaps the moon's lower part, and the ground below it starts at the clouds' underside colour (`cloud-floor`) and falls in a hard gradient through `steel`, `sky-2` and `sky-1` to `sky-0`.

- Provide `cloudSrc` = the `clouds.webp` asset (`/_blob/196f6f88ed038f93da15559e9e5ca7ed`). It is a transparent PNG-style layer and is shown in greyscale, so the clouds stay silver, never blue.
- Put the next sections inside it as children. They start on the grey, so text on the first part uses `ink` and `ink-2` only; glass panels read on any part of it.
- Place it directly after the `Scene`. It pulls its clouds up by about a quarter of their width to overlap the moon.

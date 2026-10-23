# StartForm

Name, seconds and the primary button on one glass bar. In the hero it sits on the moon's horizon.

- Provide `onStart({ name, seconds })`; the form checks the same rules as the server (name trimmed, 1–100 characters; seconds a whole number from 1 to 86400) and shows problems as one `alert` line under the bar, never a popup.
- Pass `error` for a server 400, `submitting` while the request runs.
- Default seconds 180, placeholder name "tea", live hint "= 3m". Exactly 1337 shows "= LEET"; more than 86400 shows "= HELL NAW" (and the form explains the limit on submit).
- On phones the name takes the full width; seconds and the button share the second row.

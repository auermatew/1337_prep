# Short task id and left-side tabs — design

Small change on `feature/frontend`.

## Decided (with the user)

- **Short task id** (first 8 characters of the UUID), muted mono:
  after the name in archive rows, and in the timer window footer.
  Hover shows the full id. Not copyable or selectable (the user asked to
  drop click-to-copy). live.log unchanged. In timer windows it sits on the
  state line, right-aligned, since the footer is full at 260px.
- **Side tabs move to the left edge** (the right edge fights the scrollbar).
  The transcripts drawer slides in and out from the left, mirrored.

## Approaches

- One `TaskId` button component reused in both places (chosen).
- Full UUID inline: rejected, 36 characters crowd rows and phones.

## My calls

- Left tabs keep the same look; hover lifts toward the page (right).

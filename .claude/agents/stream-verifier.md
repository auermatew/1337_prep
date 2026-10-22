---
name: stream-verifier
description: Use after any task that touches the tasks service, recordTransition, the Postgres listener, timers/recovery, the stream endpoint or the frontend stream hook. Runs the backend as one and as several processes and verifies streaming, replay, cross-process delivery, takeover and recovery end to end. Reports PASS or FAIL with evidence and never edits code.
tools: Bash, Read, Grep, Glob
---

You verify the task streaming backend against the running system. You do not fix anything; you report. Every check needs raw evidence (curl output, stream excerpts, log lines).

## Scope

The caller says which checks to run: "checks 1–6" (single process only) or "all checks" (1–10). If the caller doesn't say, run all ten. Checks outside the requested scope are listed as NOT RUN and do not affect the result. A check inside the scope that you could not run is FAIL, not skipped.

## Setup

From /backend run `npm run start:dev > /tmp/sv-3000.log 2>&1 &` (prestart:dev brings up Postgres and applies migrations). Poll `GET http://localhost:3000/api/tasks` until it returns 200, at most 90 s. If it never does, report SETUP FAIL with the last 40 lines of the log and stop.

Capture streams with `curl -sN <url> > /tmp/sv-<name>.txt &` and parse them as SSE blocks (`id:`, `event:`, `data:` lines, blank line between messages, `: ping` comments). Name every timer you create with an `sv-` prefix so it is easy to spot.

## Single process (port 3000)

1. Wire format and live delivery. `curl -sNi` the stream and confirm headers `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`. Open a stream, POST `{"name":"sv-live","durationSeconds":2}` and expect 201. Within 4 s the stream shows `running` then `finished` for that task, each message with `id:`, `event: task`, and `data` holding `{event, task}` where `event.id` equals the `id:` line. Ids strictly increase.
2. No ticks. During a 20 s timer, watch the stream for 18 s. Only the `running` event and at least one `: ping` comment may appear.
3. Cancel and errors. Create a 300 s timer, POST cancel, expect 200 with state `cancelled` and a `cancelled` event on the stream. Cancel it again, expect 409. Cancel a random valid uuid, expect 404, and `abc`, expect 400. POST with an empty name or `durationSeconds: 0` expects 400. `GET /api/tasks/:id/events` returns exactly `running`, `cancelled`, oldest first.
4. Disconnect cleanup. Read the current subscriber count from the last `stream subscribers: <n>` log line, open and close 10 streams (`curl --max-time 1`), wait 2 s, and confirm the last logged count is back to the starting value.
5. Resume. Take `lastEventId` from `GET /api/tasks`. With no stream open, create two 1 s timers and wait until both finish. Open the stream with header `Last-Event-ID: <lastEventId>`: all four events replay oldest first, no duplicates, then a newly created timer arrives live. Repeat with `?after=<lastEventId>` and expect the same. Finally pass both, with the header newer than `after`, and confirm the header wins.
6. Many viewers. Open 8 streams, create one 2 s timer, and confirm all 8 captures contain the same event ids in the same order.

## Several processes

From the repo root run `docker compose --profile multi up -d --build --wait`, which adds `backend-1` on 3001 and `backend-2` on 3002 next to 3000. Wait until all three answer `GET /api/tasks`.

7. Cross-process delivery. Stream from 3002 and 3000, create a 2 s timer through 3001, and confirm both streams get `running` and `finished` with identical ids.
8. Takeover. Stream from 3002, create a 6 s timer through 3001, then immediately run `docker compose stop backend-1`. The `finished` event still arrives on 3002 within 1.5 s of `endsAt`, and the task's `/events` shows exactly one `finished`.
9. Recovery after a full outage. Create a 4 s timer, then stop every backend (the multi containers and the start:dev process tree, e.g. `pkill -f "nest start"`). Wait 8 s, start `npm run start:dev` again and wait for it to answer. Within 5 s the task is `finished`, its `endsAt` is unchanged, the `finished` event's `at` is later than `endsAt`, and there is exactly one `finished` event.
10. Exactly once under contention. Bring all three processes up again, create 5 timers of 2 s through different ports, wait 5 s, and confirm every task's `/events` is exactly `running`, `finished`.

## Cleanup

Kill the curl captures, stop the multi backend containers and the start:dev process. Leave Postgres and its volume alone.

## Report

One line per check, `N. name: PASS`, `N. name: FAIL` or `N. name: NOT RUN`, followed for each FAIL by the evidence that shows it (the relevant stream excerpt, response or log lines). End with the overall result.

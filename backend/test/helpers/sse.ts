import http from 'node:http';
import type { TaskChange } from '../../src/tasks/task.types.js';

export interface SseMessage {
  id: number;
  event: string;
  data: TaskChange;
}

export interface SseStream {
  status: number;
  headers: http.IncomingHttpHeaders;
  messages: SseMessage[];
  comments: string[];
  /** True once the server ended the response or the connection closed. */
  readonly ended: boolean;
  waitFor(pred: () => boolean, ms?: number): Promise<void>;
  close(): void;
}

/** Opens an SSE stream; resolves once the response headers have arrived. */
export function openStream(
  url: string,
  headers: Record<string, string> = {},
): Promise<SseStream> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { headers }, (res) => {
      const messages: SseMessage[] = [];
      const comments: string[] = [];
      let ended = false;
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => {
        buf += chunk;
        let at: number;
        while ((at = buf.indexOf('\n\n')) !== -1) {
          const frame = buf.slice(0, at);
          buf = buf.slice(at + 2);
          parseFrame(frame, messages, comments);
        }
      });
      const markEnded = () => {
        ended = true;
      };
      res.on('end', markEnded);
      res.on('close', markEnded);
      res.on('error', markEnded);
      resolve({
        status: res.statusCode ?? 0,
        headers: res.headers,
        messages,
        comments,
        get ended() {
          return ended;
        },
        async waitFor(pred, ms = 5000) {
          const deadline = Date.now() + ms;
          while (!pred()) {
            if (Date.now() > deadline) throw new Error('timed out waiting');
            await new Promise((r) => setTimeout(r, 10));
          }
        },
        close() {
          req.destroy();
        },
      });
    });
    req.on('error', (err) => {
      // Our own close() surfaces as ECONNRESET/aborted after resolve.
      reject(err);
    });
  });
}

function parseFrame(
  frame: string,
  messages: SseMessage[],
  comments: string[],
): void {
  let id: number | undefined;
  let event = 'message';
  const data: string[] = [];
  for (const line of frame.split('\n')) {
    if (line.startsWith(':')) comments.push(line.slice(1).trim());
    else if (line.startsWith('id:')) id = Number(line.slice(3).trim());
    else if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
  }
  if (id !== undefined && data.length) {
    messages.push({
      id,
      event,
      data: JSON.parse(data.join('\n')) as TaskChange,
    });
  }
}

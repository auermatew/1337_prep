"""Scope the Moonrise tokens + bundle CSS under .moonrise.

usage (from the repo root):
  python3 frontend/scripts/scope-moonrise-css.py \
    design-system-moonrise/tokens.css design-system-moonrise/components/bundle.css \
    > frontend/src/moonrise/moonrise.generated.css
"""
import re, sys

def blocks(css):
    """Split CSS into top-level items: (prelude, body) or ('comment', text)."""
    i, n, out = 0, len(css), []
    while i < n:
        if css.startswith('/*', i):
            j = css.index('*/', i) + 2
            out.append(('comment', css[i:j])); i = j; continue
        if css[i].isspace():
            i += 1; continue
        if css.startswith('@import', i):
            j = css.index(')', i)
            j = css.index(';', j) + 1
            out.append(('import', css[i:j])); i = j; continue
        j = css.index('{', i)
        prelude = css[i:j].strip()
        depth, k = 1, j + 1
        while depth:
            c = css[k]
            if css.startswith('/*', k):
                k = css.index('*/', k) + 2; continue
            if c == '{': depth += 1
            elif c == '}': depth -= 1
            k += 1
        out.append((prelude, css[j + 1:k - 1])); i = k
    return out

def split_selectors(sel):
    parts, depth, cur = [], 0, ''
    for c in sel:
        if c in '([': depth += 1
        if c in ')]': depth -= 1
        if c == ',' and depth == 0:
            parts.append(cur.strip()); cur = ''
        else:
            cur += c
    parts.append(cur.strip())
    return [p for p in parts if p]

def scope(sel):
    out = []
    for s in split_selectors(sel):
        s = re.sub(r'\s+', ' ', s)
        if s in (':root', '[data-theme="night"]'):
            out.append('.moonrise')
        else:
            out.append('.moonrise ' + s)
    # keep order, drop duplicates
    seen, uniq = set(), []
    for s in out:
        if s not in seen: seen.add(s); uniq.append(s)
    return ',\n'.join(uniq)

CLOCK = re.compile(r'^\.ms-(clock|seg-)')

def convert(items, top, keyframes, imports):
    out = []
    for pre, body in items:
        if pre == 'comment':
            out.append(body); continue
        if pre == 'import':
            imports.append(body); continue
        if pre.startswith('@keyframes'):
            name = pre.split()[1]
            if name in ('ms-breathe', 'ms-blink', 'ms-urgent', 'ms-flicker', 'ms-flash'):
                continue  # in clock.css
            keyframes.append(f'{pre} {{{body}}}'); continue
        if pre.startswith('@media') or pre.startswith('@supports'):
            inner = convert(blocks(body), False, keyframes, imports)
            if inner.strip():
                out.append(f'{pre} {{\n{inner}\n}}')
            continue
        sels = split_selectors(pre)
        # page-level rules the app handles elsewhere
        if any(s.startswith('html') or s == 'body' for s in sels):
            continue
        sels = [s for s in sels if not CLOCK.match(s)]
        if not sels:
            continue
        out.append(f'{scope(",".join(sels))} {{{body}}}')
    return '\n'.join(out)

tokens, bundle = (open(p).read() for p in sys.argv[1:3])
keyframes, imports = [], []
body = convert(blocks(tokens) + blocks(bundle), True, keyframes, imports)
print('\n'.join(imports))
print('/* Generated from design-system-moonrise/tokens.css and components/bundle.css')
print('   by scoping every rule under .moonrise; clock rules live in clock/clock.css. */')
print(body)
print('\n'.join(keyframes))

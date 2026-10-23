/* @ds-bundle: {"format":4,"namespace":"Moonrise","components":[{"name":"SegmentClock"},{"name":"MoonPhase"},{"name":"LiveIndicator"},{"name":"Button"},{"name":"Field"},{"name":"StartForm"},{"name":"Panel"},{"name":"TimerCard"},{"name":"HistoryTimeline"},{"name":"LiveFeed"},{"name":"Stats"},{"name":"ArchiveTable"},{"name":"Sheet"},{"name":"Notebook"},{"name":"Nav"},{"name":"Logo"},{"name":"Footer"},{"name":"Scene"},{"name":"CloudFloor"},{"name":"Grain"},{"name":"Wordmark"}]} */
(function () {
  var React = window.React;
  var h = React.createElement;
  var useState = React.useState, useEffect = React.useEffect, useRef = React.useRef, useMemo = React.useMemo;

  function cx() { return Array.prototype.filter.call(arguments, Boolean).join(' '); }
  function omit(o, keys) { var r = {}; for (var k in o) if (keys.indexOf(k) < 0) r[k] = o[k]; return r; }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  function reducedMotion() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }

  // "180" -> "3m", "3725" -> "1h 2m 5s"
  function humanize(sec) {
    var s = Math.floor(Number(sec));
    if (!(s > 0)) return '';
    var hh = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return [hh ? hh + 'h' : '', m ? m + 'm' : '', ss ? ss + 's' : ''].filter(Boolean).join(' ');
  }
  // ms left -> "mm:ss", or "h:mm:ss" from one hour
  function countdown(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000));
    var hh = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    var p = function (x) { return (x < 10 ? '0' : '') + x; };
    return hh ? hh + ':' + p(m) + ':' + p(ss) : p(m) + ':' + p(ss);
  }

  // ---- Seven-segment geometry: one digit is 60 x 108 units, segments 11 thick.
  var DW = 60, DH = 108, T = 11, G = 2, GAP = 14, CW = 22;
  function hseg(x1, x2, y) { var t = T / 2; return [[x1, y], [x1 + t, y - t], [x2 - t, y - t], [x2, y], [x2 - t, y + t], [x1 + t, y + t]]; }
  function vseg(x, y1, y2) { var t = T / 2; return [[x, y1], [x + t, y1 + t], [x + t, y2 - t], [x, y2], [x - t, y2 - t], [x - t, y1 + t]]; }
  var L = T / 2, R = DW - T / 2, TOP = T / 2, MID = DH / 2, BOT = DH - T / 2;
  var SEGS = {
    a: hseg(L + G, R - G, TOP), b: vseg(R, TOP + G, MID - G), c: vseg(R, MID + G, BOT - G),
    d: hseg(L + G, R - G, BOT), e: vseg(L, MID + G, BOT - G), f: vseg(L, TOP + G, MID - G),
    g: hseg(L + G, R - G, MID)
  };
  var ALL = 'abcdefg';
  var DIGITS = { '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd', '6': 'afgedc', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', '-': 'g', ' ': '' };
  function points(p, dx) { return p.map(function (q) { return (q[0] + dx) + ',' + q[1]; }).join(' '); }
  function layout(value) {
    var items = [], x = 0;
    for (var i = 0; i < value.length; i++) {
      var ch = value[i];
      if (ch === ':') { items.push({ kind: 'colon', x: x }); x += CW + GAP; }
      else { items.push({ kind: 'digit', ch: ch, x: x }); x += DW + GAP; }
    }
    return { items: items, width: Math.max(1, x - GAP) };
  }

  // The 1337 display. Lit segments glow in `signal`, unlit ones stay as ghosts.
  // "1337" is a word, not a time: colons only appear in countdowns.
  function SegmentClock(props) {
    var value = props.value == null ? '1337' : String(props.value);
    var height = props.height || 120;
    var lay = useMemo(function () { return layout(value); }, [value]);
    // Boot: every digit scrambles through random numbers, then they lock in from
    // left to right (frame 10, 14, 18, …; one frame every 70 ms).
    var digitIdx = useMemo(function () {
      var m = {}, k = 0;
      lay.items.forEach(function (it, i) { if (it.kind === 'digit') m[i] = k++; });
      return m;
    }, [lay]);
    var lastFrame = 10 + 4 * Math.max(0, Object.keys(digitIdx).length - 1) + 1;
    var bootState = useState(props.boot && !reducedMotion() ? 0 : -1), bootStep = bootState[0], setBootStep = bootState[1];
    var flashState = useState(false), flash = flashState[0], setFlash = flashState[1];
    var darkState = useState(null), dark = darkState[0], setDark = darkState[1];
    var dipState = useState(false), dip = dipState[0], setDip = dipState[1];
    var firstPulse = useRef(true), rootRef = useRef(null);
    // The display lights the moon: tell the Scene around it when the light drops,
    // so the moon's red-lit top darkens with it (see .ms-scene-rimshade).
    function setLight(v) {
      var sc = rootRef.current && rootRef.current.closest && rootRef.current.closest('.ms-scene');
      if (!sc) return;
      if (v) sc.setAttribute('data-clock-light', v); else sc.removeAttribute('data-clock-light');
    }
    var uid = 'msclock' + (React.useId ? React.useId() : Math.random().toString(36).slice(2)).replace(/[^A-Za-z0-9_-]/g, '');

    useEffect(function () {
      if (bootStep < 0) return;
      var t = setTimeout(function () { setBootStep(bootStep >= lastFrame ? -1 : bootStep + 1); }, 70);
      return function () { clearTimeout(t); };
    }, [bootStep, lastFrame]);
    var bootingNow = bootStep >= 0;
    useEffect(function () { setLight(bootingNow ? 'boot' : null); }, [bootingNow]);
    useEffect(function () {
      if (firstPulse.current) { firstPulse.current = false; return; }
      setFlash(true);
      var t = setTimeout(function () { setFlash(false); }, 320);
      return function () { clearTimeout(t); };
    }, [props.pulseKey]);
    // Flicker: now and then one or two lit segments drop out for a frame or two,
    // and sometimes the whole display dips, like a tired LED.
    useEffect(function () {
      if (!props.flicker || reducedMotion()) return;
      var timers = [];
      function schedule() {
        timers.push(setTimeout(function () {
          var keys = [];
          lay.items.forEach(function (it, i) { if (it.kind === 'digit') (DIGITS[it.ch] || '').split('').forEach(function (sg) { keys.push(i + sg); }); });
          var pick = {};
          pick[keys[Math.floor(Math.random() * keys.length)]] = true;
          if (Math.random() < 0.35) pick[keys[Math.floor(Math.random() * keys.length)]] = true;
          var dipping = Math.random() < 0.3;
          setDark(pick);
          if (dipping) setDip(true);
          setLight(dipping ? 'dip' : 'drop');
          timers.push(setTimeout(function () { setDark(null); setDip(false); setLight(null); schedule(); }, 70 + Math.random() * 90));
        }, 700 + Math.random() * 2600));
      }
      schedule();
      return function () { timers.forEach(clearTimeout); setLight(null); };
    }, [props.flicker, lay]);

    var booting = bootStep >= 0;
    function charAt(it, i) {
      if (!booting) return it.ch;
      return bootStep >= 10 + 4 * digitIdx[i] ? it.ch : String(Math.floor(Math.random() * 10));
    }
    function isOn(i, s, ch) {
      if (dark && dark[i + s]) return false;
      return (DIGITS[ch] || '').indexOf(s) >= 0;
    }
    var warm = false;

    function face(key) {
      var off = [], on = [];
      lay.items.forEach(function (it, i) {
        if (it.kind === 'colon') {
          var mx = it.x + CW / 2 - 5.5, dots = [DH * 0.32 - 5.5, DH * 0.68 - 5.5];
          var colonOn = true;
          dots.forEach(function (y, j) {
            var el = h('rect', { key: i + 'c' + j, x: mx, y: y, width: 11, height: 11, rx: 1.5, className: warm ? 'ms-seg-warm' : (colonOn ? 'ms-seg-on' : 'ms-seg-off') });
            (warm || !colonOn ? off : on).push(el);
          });
          return;
        }
        ALL.split('').forEach(function (s) {
          var lit = isOn(i, s, charAt(it, i));
          var el = h('polygon', { key: i + s, points: points(SEGS[s], it.x), className: warm ? 'ms-seg-warm' : (lit ? 'ms-seg-on' : 'ms-seg-off') });
          (lit ? on : off).push(el);
        });
      });
      var colonBlink = props.blinkColon !== false && !booting;
      // The bloom is an SVG filter with a generous region: CSS drop-shadow on SVG
      // content is cut to a tight box and shows a visible rectangle.
      var fid = uid + key;
      var reflection = key === 'r';
      var filter = h('filter', { id: fid, x: '-40%', y: '-120%', width: '180%', height: '340%', colorInterpolationFilters: 'sRGB' },
        reflection
          ? h('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: 6 })
          : [h('feGaussianBlur', { key: 1, in: 'SourceGraphic', stdDeviation: 2, result: 'b1' }),
            h('feGaussianBlur', { key: 2, in: 'SourceGraphic', stdDeviation: 9, result: 'b2' }),
            h('feGaussianBlur', { key: 3, in: 'SourceGraphic', stdDeviation: 30, result: 'b3' }),
            h('feColorMatrix', { key: 4, in: 'b3', type: 'matrix', values: '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.7 0', result: 'b3a' }),
            h('feMerge', { key: 5 }, h('feMergeNode', { in: 'b3a' }), h('feMergeNode', { in: 'b2' }), h('feMergeNode', { in: 'b1' }), h('feMergeNode', { in: 'SourceGraphic' }))]);
      var size = props.fluid ? { style: { width: '100%', height: 'auto' } } : { width: height * lay.width / DH, height: height };
      return h('svg', Object.assign({ key: key, viewBox: '0 0 ' + lay.width + ' ' + DH, 'aria-hidden': true }, size),
        h('defs', null, filter),
        h('g', null, off),
        h('g', { className: cx('ms-clock-lit', colonBlink && 'ms-clock-blinkcolon'), filter: props.dim ? undefined : 'url(#' + fid + ')' }, on));
    }

    return h('div', {
      className: cx('ms-clock', props.fluid && 'ms-clock-fluid', flash && 'ms-clock-flash', dip && 'ms-clock-dip', props.flicker && 'ms-clock-flicker', props.urgent && 'ms-clock-urgent', props.dim && 'ms-clock-dim', props.className),
      role: 'img', 'aria-label': props.label || value, ref: rootRef,
      style: Object.assign({ '--k': String(height / 120) }, props.opticalCenter && value.charAt(0) === '1'
        ? { transform: 'translateX(-' + ((R - T / 2) / 2 / lay.width * 100).toFixed(2) + '%)' } : null, props.style)
    }, face('f'), props.reflect ? h('div', { className: 'ms-clock-reflection', 'aria-hidden': true }, face('r')) : null);
  }

  // Elapsed time as a moon phase: new moon at 0, full moon at 1.
  function MoonPhase(props) {
    var p = Math.max(0, Math.min(1, Number(props.progress) || 0)), size = props.size || 28, r = 12, c = 14;
    var rx = Math.abs(1 - 2 * p) * r;
    var d = 'M' + c + ' ' + (c - r) + ' A' + r + ' ' + r + ' 0 0 1 ' + c + ' ' + (c + r) +
      ' A' + rx.toFixed(2) + ' ' + r + ' 0 0 ' + (p < 0.5 ? 0 : 1) + ' ' + c + ' ' + (c - r) + ' Z';
    return h('svg', { className: cx('ms-phase', props.className), width: size, height: size, viewBox: '0 0 28 28', role: 'img', 'aria-label': Math.round(p * 100) + '% elapsed' },
      h('circle', { className: 'ms-phase-dark', cx: c, cy: c, r: r }),
      p > 0 ? h('path', { className: 'ms-phase-lit', d: d }) : null,
      h('circle', { className: 'ms-phase-ring', cx: c, cy: c, r: r + 1.5 }));
  }

  var STATUS = { live: 'Live', connecting: 'Connecting…', reconnecting: 'Reconnecting…' };
  function LiveIndicator(props) {
    var s = props.status || 'live';
    return h('span', { className: cx('ms-live', 'ms-live-' + s, props.size === 'lg' && 'ms-live-lg', props.className), role: 'status' },
      h('span', { className: 'ms-live-pip', 'aria-hidden': true }), STATUS[s] || s);
  }

  function Button(props) {
    var variant = props.variant || 'glass';
    var cls = variant === 'cancel' ? 'ms-btn-text ms-btn-cancel' : 'ms-btn-' + variant;
    return h('button', Object.assign({ type: 'button' }, omit(props, ['variant', 'className']), { className: cx('ms-btn', cls, props.className) }));
  }

  function Field(props) {
    var rest = omit(props, ['label', 'hint', 'error', 'className']);
    return h('label', { className: cx('ms-field', props.error && 'ms-field-error', props.className), htmlFor: props.id },
      h('span', { className: 'ms-field-label' }, props.label),
      h('span', { className: 'ms-field-row' },
        h('input', Object.assign({ className: 'ms-input', 'aria-invalid': props.error ? true : undefined }, rest)),
        props.hint ? h('span', { className: 'ms-field-hint' }, props.hint) : null),
      props.error ? h('span', { className: 'ms-field-msg', role: 'alert' }, props.error) : null);
  }

  // The seconds hint: humanised duration, with two easter eggs.
  function secondsHint(n) {
    if (n === 1337) return '= LEET';
    if (n > 86400) return '= HELL NAW';
    return humanize(n) ? '= ' + humanize(n) : '';
  }

  // Name + seconds + start, on one glass bar. Mirrors the server's checks.
  function StartForm(props) {
    var nameState = useState(props.defaultName || ''), name = nameState[0], setName = nameState[1];
    var secState = useState(String(props.defaultSeconds == null ? 180 : props.defaultSeconds)), secs = secState[0], setSecs = secState[1];
    var errState = useState(null), err = errState[0], setErr = errState[1];
    var id = props.idPrefix || 'start';
    var n = Number(secs);
    function submit(ev) {
      ev.preventDefault();
      var nm = name.trim();
      if (nm.length < 1 || nm.length > 100) return setErr('Give the timer a name of 1 to 100 characters.');
      if (!Number.isInteger(n) || n < 1 || n > 86400) return setErr('Seconds must be a whole number from 1 to 86400.');
      setErr(null);
      if (props.onStart) props.onStart({ name: nm, seconds: n });
    }
    var error = props.error || err;
    return h('form', { className: cx('ms-start', props.className), onSubmit: submit, noValidate: true },
      h('div', { className: 'ms-start-bar' },
        h(Field, { id: id + '-name', label: 'Name', placeholder: 'tea', value: name, autoComplete: 'off', className: 'ms-start-name', onChange: function (e) { setName(e.target.value); } }),
        h(Field, { id: id + '-seconds', label: 'Seconds', inputMode: 'numeric', value: secs, className: 'ms-start-secs', hint: secondsHint(n), onChange: function (e) { setSecs(e.target.value); } }),
        h(Button, { type: 'submit', variant: 'primary', disabled: !!props.submitting, className: 'ms-start-go' }, props.submitting ? 'Starting…' : 'Start timer →')),
      error ? h('p', { className: 'ms-error', role: 'alert' }, error) : null);
  }

  function Panel(props) {
    return h(props.as || 'div', { className: cx('ms-panel', props.strong && 'ms-panel-strong', props.glow && 'ms-panel-glow', props.className), style: props.style }, props.children);
  }

  var STATE_LABEL = { running: 'Running', finishing: 'Finishing…', cancelling: 'Cancelling…', finished: 'Finished', cancelled: 'Cancelled' };
  function TimerCard(props) {
    var st = props.state || 'running';
    var dur = props.durationMs || 1;
    var rem = st === 'finishing' ? 0 : Math.max(0, props.remainingMs || 0);
    var live = st === 'running' || st === 'finishing' || st === 'cancelling';
    var text = countdown(rem);
    var histState = useState(!!props.historyOpen), histOpen = histState[0], setHistOpen = histState[1];
    useEffect(function () { setHistOpen(!!props.historyOpen); }, [props.historyOpen]);
    function toggleHistory() { var next = !histOpen; setHistOpen(next); if (props.onToggleHistory) props.onToggleHistory(next); }
    return h('article', { className: cx('ms-panel', 'ms-panel-liquid', 'ms-timer', 'ms-timer-' + st, props.exit && 'ms-exit-' + props.exit, props.className), 'aria-label': props.name + ', ' + STATE_LABEL[st] },
      h('header', { className: 'ms-timer-head' },
        h('div', { className: 'ms-timer-title' },
          h('h3', { className: 'ms-timer-name' }, props.name),
          h('span', { className: 'ms-id', title: props.id }, String(props.id || '').slice(0, 8))),
        h(MoonPhase, { progress: 1 - rem / dur, size: 28 })),
      h('div', { className: 'ms-timer-time' },
        h(SegmentClock, { value: text, height: props.clockHeight || 52, blinkColon: false, urgent: (st === 'running' && rem <= 10000) || st === 'finishing', dim: !live, label: text + ' left' }),
        h('p', { className: 'ms-timer-state ms-state-' + (live ? 'running' : st) }, STATE_LABEL[st])),
      props.error ? h('p', { className: 'ms-error', role: 'alert' }, props.error) : null,
      histOpen && props.history ? h('div', { className: 'ms-history-pop ms-history-pop-card', role: 'region', 'aria-label': 'History of ' + props.name }, h(HistoryTimeline, { events: props.history })) : null,
      h('footer', { className: 'ms-timer-foot' },
        h('span', { className: 'ms-muted' }, 'Ends ', h('span', { className: 'ms-num' }, props.endsAt)),
        h('span', { className: 'ms-timer-actions' },
          h(Button, { variant: 'text', onClick: toggleHistory, 'aria-expanded': histOpen }, histOpen ? 'Hide history' : 'History'),
          live ? h(Button, { variant: 'cancel', onClick: props.onCancel, disabled: st !== 'running' }, 'Cancel') : null)));
  }

  function HistoryTimeline(props) {
    return h('ol', { className: cx('ms-history', props.className) }, (props.events || []).map(function (e) {
      return h('li', { key: e.id, className: 'ms-history-item' },
        h('span', { className: 'ms-history-id' }, '#' + e.id),
        h('span', { className: 'ms-state-' + e.state }, cap(e.state)),
        h('span', { className: 'ms-num ms-muted' }, e.at));
    }));
  }

  function LiveFeed(props) {
    var lines = props.lines || [];
    return h('section', { className: cx('ms-panel', 'ms-panel-liquid', 'ms-feed', props.className), 'aria-label': 'Live feed' },
      h('header', { className: 'ms-feed-head' }, h('h3', { className: 'ms-title' }, 'Live feed')),
      lines.length
        ? h('ol', { className: 'ms-feed-list', 'aria-live': 'polite' }, lines.map(function (l, i) {
          return h('li', { key: l.id, className: cx('ms-feed-line', props.highlightLast && i === lines.length - 1 && 'ms-feed-new') },
            h('span', { className: 'ms-feed-id' }, '#' + l.id),
            h('span', { className: 'ms-feed-name' }, l.name),
            h('span', { className: 'ms-state-' + l.state }, l.state),
            h('span', { className: 'ms-num ms-muted' }, l.at));
        }))
        : h('p', { className: 'ms-muted ms-feed-empty' }, 'Waiting for the first event.'),
      h('footer', { className: 'ms-feed-foot' }, props.lastId != null ? 'Last event #' + props.lastId : 'No events yet'));
  }

  function Stats(props) {
    return h('dl', { className: cx('ms-stats', props.className) }, (props.items || []).map(function (s) {
      return h('div', { key: s.label, className: 'ms-stat' }, h('dt', { className: 'ms-stat-label' }, s.label), h('dd', { className: 'ms-stat-value' }, s.value));
    }));
  }

  function ArchiveTable(props) {
    var rows = props.rows || [];
    var openState = useState(props.openId || null), openId = openState[0], setOpenId = openState[1];
    useEffect(function () { setOpenId(props.openId || null); }, [props.openId]);
    return h('div', { className: cx('ms-archive', props.className) },
      h('table', { className: 'ms-table' },
        h('thead', null, h('tr', null, ['Name', 'State', 'Duration', 'Ended', ''].map(function (c, i) { return h('th', { key: i, scope: 'col' }, c); }))),
        h('tbody', null, rows.map(function (r) {
          var open = openId === r.id && !!r.history;
          function toggle() { var next = open ? null : r.id; setOpenId(next); if (props.onToggleHistory) props.onToggleHistory(next); }
          return h('tr', { key: r.id, className: 'ms-row ms-row-' + r.state },
            h('td', { 'data-label': 'Name' }, h('span', { className: 'ms-row-name' }, r.name), ' ', h('span', { className: 'ms-id', title: r.id }, r.id.slice(0, 8))),
            h('td', { 'data-label': 'State' }, h('span', { className: 'ms-state-' + r.state }, cap(r.state))),
            h('td', { 'data-label': 'Duration', className: 'ms-num ms-cell-duration' }, r.duration),
            h('td', { 'data-label': 'Ended', className: 'ms-num' }, r.ended),
            h('td', { className: 'ms-cell-action' },
              r.history ? h(Button, { variant: 'text', 'aria-expanded': open, onClick: toggle }, open ? 'Hide history' : 'History') : null,
              open ? h('div', { className: 'ms-history-pop ms-history-pop-row', role: 'region', 'aria-label': 'History of ' + r.name }, h(HistoryTimeline, { events: r.history })) : null));
        }))),
      props.total && props.total > rows.length ? h(Button, { variant: 'text', className: 'ms-showall', onClick: props.onShowAll }, 'Show all (' + props.total + ')') : null);
  }

  // Drawer or modal body. The consumer owns the <dialog> and its placement.
  function Sheet(props) {
    return h('section', { className: cx('ms-panel', 'ms-panel-strong', 'ms-sheet', props.className), 'aria-label': props.title, style: props.style },
      h('header', { className: 'ms-sheet-head' }, h('h2', { className: 'ms-title' }, props.title), props.onClose ? h(Button, { variant: 'text', onClick: props.onClose }, 'Close') : null),
      h('div', { className: 'ms-sheet-body' }, props.children),
      props.footer ? h('footer', { className: 'ms-sheet-foot' }, props.footer) : null);
  }

  function Logo(props) {
    var s = props.size || 22;
    return h('span', { className: cx('ms-logo', props.className) },
      h('svg', { width: s, height: s, viewBox: '0 0 24 24', 'aria-hidden': true },
        h('polygon', { className: 'ms-logo-seg', points: '8,5 9.5,3.5 14.5,3.5 16,5 14.5,6.5 9.5,6.5' }),
        h('path', { className: 'ms-logo-moon', d: 'M3 19 A9 9 0 0 1 21 19 Z' }),
        h('rect', { className: 'ms-logo-moon', x: 1, y: 20, width: 22, height: 1.25 })),
      h('span', { className: 'ms-logo-word' }, '1337'));
  }

  function Nav(props) {
    var links = props.links || ['Timers', 'Archive', 'Transcripts', 'Notebook'];
    return h('nav', { className: cx('ms-nav', props.className), 'aria-label': 'Main' },
      h(Logo, null),
      h('div', { className: 'ms-nav-links' },
        links.map(function (l) { return h('a', { key: l, href: '#' + l.toLowerCase(), className: 'ms-link' }, l); }),
        h('a', { className: 'ms-link', href: props.githubUrl || 'https://github.com/auermatew/1337_prep', target: '_blank', rel: 'noopener noreferrer' }, 'GitHub ↗')),
      h(LiveIndicator, { status: props.status || 'live' }),
      h(Button, { variant: 'text', className: 'ms-nav-menu', onClick: props.onMenu }, 'Menu'));
  }

  // The hero sky: a hard black-to-silver gradient, stars, the moon photograph
  // rising from the bottom edge, and whatever is centred above it (the 1337 display).
  // Without moonSrc it draws a placeholder moon from the tokens.
  // Stars spread over the whole sky in percentages, so every width gets them edge to edge.
  // mulberry32: a small seeded generator that spreads evenly from the first value on.
  function starField(seed, n) {
    var a = seed >>> 0, out = [];
    function rnd() { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    for (var i = 0; i < n; i++) {
      var big = rnd() < 0.15;
      out.push({ left: (rnd() * 100).toFixed(2) + '%', top: (rnd() * 70).toFixed(2) + '%', width: big ? 2 : 1, height: big ? 2 : 1, opacity: (0.25 + rnd() * 0.55).toFixed(2) });
    }
    return out;
  }
  function Scene(props) {
    var stars = useMemo(function () { return starField(props.seed || 1337, 140); }, [props.seed]);
    var style = Object.assign({ height: props.height || '100vh', '--ms-horizon': String(props.horizon == null ? 68 : props.horizon) }, props.style);
    return h('section', { className: cx('ms-scene', props.className), style: style, 'aria-label': props.label || '1337' },
      h('div', { className: 'ms-stars', 'aria-hidden': true }, stars.map(function (st, i) { return h('i', { key: i, style: st }); })),
      h('div', { className: 'ms-scene-moonlayer', 'aria-hidden': true },
        props.moonSrc
          ? h('img', { className: 'ms-scene-moon', src: props.moonSrc, alt: '', draggable: false, loading: 'eager', decoding: 'async', fetchPriority: 'high', style: props.moonWidth ? { width: props.moonWidth } : null })
          : h('div', { className: 'ms-moon-wrap' }, h('div', { className: 'ms-moon ms-moon-placeholder' })),
        h('div', { className: 'ms-scene-rimshade' }),
        h('div', { className: 'ms-scene-rimshade ms-scene-rimshade-k' })),
      props.word ? h('div', { className: cx('ms-scene-word', props.wordStatic && 'ms-scene-word-static') }, h('span', null, props.word)) : null,
      h('div', { className: 'ms-scene-content' }, props.children));
  }

  // The divider under the hero: the cloud layer overlapping the moon's lower edge,
  // then a hard gradient from the clouds' underside down to black. Sections go inside.
  function CloudFloor(props) {
    return h('div', { className: cx('ms-floor', props.className), style: props.style },
      props.cloudSrc ? h('img', { className: 'ms-floor-clouds', src: props.cloudSrc, alt: '', 'aria-hidden': true, draggable: false, loading: 'eager', decoding: 'async', fetchPriority: 'high' }) : h('div', { className: 'ms-floor-haze', 'aria-hidden': true }),
      h('div', { className: 'ms-floor-content' }, props.children));
  }

  // Hard film grain over everything. Render once, at the end of the page.
  function Grain(props) {
    return h('div', { className: cx('ms-grain', props.className), 'aria-hidden': true, style: props.opacity != null ? { opacity: props.opacity } : null });
  }

  // A paper notebook that starts closed on its cover and swings open into a two-page spread.
  // The cover is a leaf hinged on the spine: its front is the cover, its back is the left page.
  function Notebook(props) {
    var openState = useState(!!props.open), open = openState[0], setOpen = openState[1];
    useEffect(function () {
      if (!props.autoOpen) return;
      var t = setTimeout(function () { setOpen(true); }, reducedMotion() ? 0 : (props.autoOpenDelay == null ? 1800 : props.autoOpenDelay));
      return function () { clearTimeout(t); };
    }, []);
    useEffect(function () { if (props.open != null) setOpen(!!props.open); }, [props.open]);
    var w = props.pageWidth || 400;
    function openBook() { if (open) return; setOpen(true); if (props.onToggle) props.onToggle(true); }
    return h('div', { className: cx('ms-notebook', open && 'ms-notebook-open', props.className), style: { '--nb-w': w + 'px' } },
      h('div', { className: 'ms-nb-book' },
        h('div', { className: 'ms-nb-page ms-nb-right' },
          h('img', { className: 'ms-nb-paper', src: props.paperSrc, alt: '', draggable: false }),
          h('span', { className: 'ms-nb-spine ms-nb-spine-l', 'aria-hidden': true }),
          props.rightSrc ? h('img', { className: 'ms-nb-ink', src: props.rightSrc, alt: props.rightAlt || '', draggable: false }) : null,
          props.children),
        h('button', { type: 'button', className: 'ms-nb-leaf', onClick: openBook, 'aria-expanded': open, 'aria-label': open ? 'Notebook, open' : 'Open the notebook', tabIndex: open ? -1 : 0 },
          h('span', { className: 'ms-nb-face ms-nb-front' }, h('img', { src: props.coverSrc, alt: props.coverAlt || '', draggable: false })),
          h('span', { className: 'ms-nb-face ms-nb-back' },
            h('img', { className: 'ms-nb-paper ms-nb-mirror', src: props.paperSrc, alt: '', draggable: false }),
            h('span', { className: 'ms-nb-spine ms-nb-spine-r', 'aria-hidden': true }),
            props.leftSrc ? h('img', { className: 'ms-nb-ink ms-nb-ink-left', src: props.leftSrc, alt: props.leftAlt || '', draggable: false }) : null))));
  }

  // The page's end: its links as a belt of white rules, sitting on the cropped wordmark.
  function Footer(props) {
    var links = props.links || [
      { label: 'GitHub ↗', href: 'https://github.com/auermatew/1337_prep', external: true },
      { label: 'Transcripts', href: '#transcripts' },
      { label: 'Notebook', href: '#notebook' }];
    return h('footer', { className: cx('ms-footer', props.className) },
      h('nav', { className: 'ms-belt', 'aria-label': 'More' }, links.map(function (l) {
        return h('a', { key: l.label, className: 'ms-belt-link', href: l.href, onClick: l.onClick, target: l.external ? '_blank' : undefined, rel: l.external ? 'noopener noreferrer' : undefined }, l.label);
      })),
      h(Wordmark, { decorative: true }));
  }

  function Wordmark(props) {
    return h('div', { className: cx('ms-wordmark', props.className), 'aria-hidden': props.decorative ? true : undefined },
      h('span', null, props.text || '1337'));
  }

  // Page scroll lock for open drawers and modals (transcripts, preview, notebook).
  // Counts nested locks and pads for the scrollbar so the page doesn't shift.
  var scrollLocks = 0, savedPad = '';
  function lockScroll(on) {
    var root = document.documentElement, body = document.body;
    if (on) {
      if (scrollLocks++ === 0) {
        var bar = window.innerWidth - root.clientWidth;
        savedPad = body.style.paddingRight;
        if (bar > 0) body.style.paddingRight = bar + 'px';
        root.classList.add('ms-scroll-locked');
      }
    } else if (scrollLocks > 0 && --scrollLocks === 0) {
      body.style.paddingRight = savedPad;
      root.classList.remove('ms-scroll-locked');
    }
  }
  function useScrollLock(on) {
    useEffect(function () { if (!on) return; lockScroll(true); return function () { lockScroll(false); }; }, [on]);
  }

  window.Moonrise = Object.assign(window.Moonrise || {}, {
    SegmentClock: SegmentClock, MoonPhase: MoonPhase, LiveIndicator: LiveIndicator, Button: Button, Field: Field,
    StartForm: StartForm, Panel: Panel, TimerCard: TimerCard, HistoryTimeline: HistoryTimeline, LiveFeed: LiveFeed,
    Stats: Stats, ArchiveTable: ArchiveTable, Sheet: Sheet, Notebook: Notebook, Nav: Nav, Logo: Logo, Footer: Footer, Scene: Scene, CloudFloor: CloudFloor, Grain: Grain, Wordmark: Wordmark,
    util: { countdown: countdown, humanize: humanize, lockScroll: lockScroll, useScrollLock: useScrollLock }
  });
})();

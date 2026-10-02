// TEMPORARY: on-screen log of the lifecycle and touch events iOS delivers. Remove after diagnosis.
const start = performance.now();
let last = start;
const lines: string[] = [];
const box = document.createElement('pre');
box.style.cssText =
  'position:fixed;top:env(safe-area-inset-top);left:0;right:0;margin:0;padding:4px;z-index:9;pointer-events:none;' +
  'font:9px/1.2 monospace;color:#0f0;background:rgba(0,0,0,.7);white-space:pre-wrap';
document.addEventListener('DOMContentLoaded', () => document.body.append(box));

function log(what: string) {
  const now = performance.now();
  lines.push(`${((now - start) / 1000).toFixed(2)} +${Math.round(now - last)}ms ${what} vis=${document.visibilityState} focus=${document.hasFocus()}`);
  last = now;
  box.textContent = lines.slice(-45).join('\n');
}

for (const type of ['visibilitychange', 'pagehide', 'pageshow', 'freeze', 'resume']) document.addEventListener(type, () => log(type), true);
for (const type of ['blur', 'focus', 'resize', 'pointercancel', 'touchcancel', 'touchstart', 'touchend', 'pointerdown', 'pointerup'])
  window.addEventListener(type, (e) => log(type + ('touches' in e ? ` y=${Math.round((e as TouchEvent).changedTouches[0]?.clientY)}` : '')), { capture: true, passive: true });
window.visualViewport?.addEventListener('resize', () => log('viewport resize'));

let over = false;
new MutationObserver((records) => {
  if (records.some((r) => [...r.addedNodes].some((n) => n instanceof HTMLElement && /flash/.test(n.className)))) log('HIT (flash)');
  const now = document.querySelector('[aria-label="Game Over"]') !== null;
  if (now !== over) log(now ? 'GAME OVER shown' : 'game over gone');
  over = now;
}).observe(document, { childList: true, subtree: true });

let frame = performance.now();
const tick = (t: number) => {
  if (t - frame > 150) log(`frame gap ${Math.round(t - frame)}ms`);
  frame = t;
  requestAnimationFrame(tick);
};
requestAnimationFrame(tick);

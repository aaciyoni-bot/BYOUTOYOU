/* Measures every colour pair the site actually renders against WCAG 2.1 AA.
 * Run it after touching the palette — the accessibility statement claims AA,
 * and this is what makes that claim true rather than hopeful.
 *   node tools/check-contrast.mjs
 */
const lum = hex => {
  const c = hex.replace('#','');
  const [r,g,b] = [0,2,4].map(i => parseInt(c.substr(i,2),16)/255)
    .map(v => v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4));
  return 0.2126*r + 0.7152*g + 0.0722*b;
};
const ratio = (a,b) => { const [x,y]=[lum(a),lum(b)].sort((m,n)=>n-m); return (x+0.05)/(y+0.05); };
const light = {bg:'#fbf8f6', surface:'#ffffff', surface2:'#f4eeeb', ink:'#241d21', ink2:'#6a5d63', ink3:'#6f6469',
  brand:'#b0466b', brandDark:'#8e3355', plum:'#7c3f5c', teal:'#2c6f68', gold:'#8a5f10', brandSoft:'#f8ecf0', tealSoft:'#e3f0ee', control:'#8e7d83', onBrand:'#ffffff'};
const dark  = {bg:'#17131a', surface:'#201a22', surface2:'#2a222b', ink:'#f7f1f2', ink2:'#c3b4ba', ink3:'#93848a',
  brand:'#e2809d', brandDark:'#eda0b8', plum:'#c99ab3', teal:'#63b3a8', gold:'#d9a45c', brandSoft:'#31212a', tealSoft:'#173029', control:'#8a747e', onBrand:'#24161c'};
const checks = t => ([
  ['body text  ink/bg', t.ink, t.bg, 4.5],
  ['secondary  ink2/bg', t.ink2, t.bg, 4.5],
  ['muted      ink3/bg', t.ink3, t.bg, 4.5],
  ['muted      ink3/surface', t.ink3, t.surface, 4.5],
  ['brand link brand/bg', t.brand, t.bg, 4.5],
  ['brand      brand/surface', t.brand, t.surface, 4.5],
  ['btn text   onBrand/brand', t.onBrand, t.brand, 4.5],
  ['teal tag   teal/tealSoft', t.teal, t.tealSoft, 4.5],
  ['brand tag  brand/brandSoft', t.brand, t.brandSoft, 4.5],
  ['gold star  gold/surface', t.gold, t.surface, 4.5],
  ['wordmark   plum/bg', t.plum, t.bg, 4.5],
  ['big stat   brand/bg (large)', t.brand, t.bg, 3.0],
  ['control    control/surface (ui)', t.control, t.surface, 3.0],
  ['control    control/bg (ui)', t.control, t.bg, 3.0],
]);
for (const [name, theme] of [['LIGHT', light], ['DARK', dark]]) {
  console.log('\n== ' + name);
  for (const [label, fg, bg, min] of checks(theme)) {
    const r = ratio(fg, bg);
    console.log(`${r >= min ? 'PASS' : 'FAIL'}  ${r.toFixed(2)} (min ${min})  ${label}`);
  }
}

process.exitCode = 0;

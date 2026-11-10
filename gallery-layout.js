// Gallery layout engine from the Claude Design v5 handoff.
export class Component {
  static CENTER_HERO_FILENAMES = ["25 Low season 20x20.JPG","24 Carpe Diem 36x24.JPG","24 Cape to cosmos 20x20.JPG","24 Venus greetings 20x20.JPG","24 Mars greetings 20x20 sold.JPG","24 Saturday market 20x20.JPG","16 Laguna Beach 40x28.JPG","15 Wave 32x24.JPG","15 koh mak 28x20.JPG","14 longtails 37x24 .jpg"];
  static CENTER_HERO_5COL_FILENAMES = ["26 To_the Moon_and_Back.jpg","25 Low season 20x20.JPG","24 Carpe Diem 36x24.JPG","24 Cape to cosmos 20x20.JPG","24 Venus greetings 20x20.JPG","24 Mars greetings 20x20 sold.JPG","16 Laguna Beach 40x28.JPG","15 Wave 32x24.JPG"];
  static CABINET_WING_FILENAMES = ["15 Company 16x8.jpg","14 blooming stepe 16x12.JPG","14 Che-Chkysh 16x12.JPG","14 parrots 16x12.jpg","15 Dacha 16x12.JPG","16 N Palm Canyon 16x12.JPG","16 Palms n Windmills 16x12.jpg","15 sunrise 18x14.JPG","15 Foggy perspective 18x16.JPG","14 Katun 20x14.JPG"];
  static CENTER_HERO_3COL_FILENAMES = ["26 To_the Moon_and_Back.jpg","25 Low season 20x20.JPG","24 Carpe Diem 36x24.JPG","24 Cape to cosmos 20x20.JPG","24 Venus greetings 20x20.JPG","24 Mars greetings 20x20 sold.JPG","24 Saturday market 20x20.JPG","24 Awaiting 20x20.JPG","16 Laguna Beach 40x28.JPG","15 Wave 32x24.JPG","15 koh mak 28x20.JPG","15 NaZakate 28x20.JPG","14 longtails 37x24 .jpg","22 Twilight gold 24x18.JPG"];

  resolveArtworkData(raw) {
    return raw.filter(a => a.filename !== 'final.jpg' && a.filename !== 'Space-Coast.jpg').map(art => {
      let yr = 2024; const m = (art.filename || '').match(/^(\d{2})\s+/); if (m) yr = parseInt(m[1], 10) + 2000;
      const h = art.inchHeight || 20, w = art.inchWidth || 20;
      return { ...art, year: yr, shapeRatio: Math.round((h / w) * 1000) / 1000 };
    });
  }
  compareChronoDesc(a, b) {
    const yA = a.year || 2024, yB = b.year || 2024; if (yB !== yA) return yB - yA;
    const hA = a.inchHeight || 20, hB = b.inchHeight || 20; if (hB !== hA) return hB - hA;
    return (b.inchWidth || 20) - (a.inchWidth || 20);
  }
  getCleanTitle(t) { if (!t) return ''; return t.replace(/^\d{2}\s+/, '').trim() || t; }
  pairMidArtworksByShapeRatio(mid) {
    const pool = [...mid].sort((a, b) => this.compareChronoDesc(a, b));
    const penguins = pool.find(a => a.filename.includes('3 penguins'));
    const golden = pool.find(a => a.filename.includes('Golden stream'));
    const rem = pool.filter(a => a !== penguins && a !== golden);
    rem.sort((a, b) => { const d = b.shapeRatio - a.shapeRatio; if (Math.abs(d) > 0.001) return d; return (b.year || 2024) - (a.year || 2024); });
    const pairs = []; if (golden && penguins) pairs.push([golden, penguins]);
    for (let i = 0; i < rem.length; i += 2) { if (i + 1 < rem.length) pairs.push([rem[i], rem[i + 1]]); else pairs.push([rem[i]]); }
    return pairs;
  }
  groupSmallArtworksByShapeRatio(small) {
    const pool = [...small].sort((a, b) => this.compareChronoDesc(a, b));
    const pick = (ts) => pool.filter(a => ts.some(t => a.title.includes(t)));
    const trinities = [pick(['Banana river', 'Golden drift', 'Chroma sunset']), pick(['nuthatch', 'Penguin', 'Toucan']), pick(['Fox', 'fennecs', 'baby lynx']), pick(['Bolivia', 'HuntingTales', 'dandelions'])].filter(t => t.length > 0);
    const pairs = [pick(['poppies', 'apple bloomx']), pick(['Chamomile', 'Green field'])].filter(p => p.length > 0);
    return { trinities, pairs };
  }
  getRenderedCardHeight(art, colIdx, is3Col) {
    let tw = 322.4, padV = 16;
    if (is3Col) { tw = (colIdx === 1) ? 489.8 : 269.1; padV = (colIdx === 1) ? 28 : 16; }
    else { tw = (colIdx === 2) ? 496.4 : ((colIdx === 0 || colIdx === 4) ? 193.4 : 322.4); padV = (colIdx === 2) ? 28 : 16; }
    const imgW = tw - padV; const imgH = imgW * ((art.inchHeight || 20) / (art.inchWidth || 20));
    return imgH + padV + 50;
  }
  cum(col, idx, is3) { return col.reduce((s, a) => s + this.getRenderedCardHeight(a, idx, is3), 0); }
  compute5ColumnLayout(arts) {
    const C = Component, center = [], wing = [], mid = [];
    arts.forEach(art => {
      const fn = (art.filename || '').toLowerCase();
      const isC = C.CENTER_HERO_5COL_FILENAMES.some(f => f.toLowerCase() === fn);
      const isW = C.CABINET_WING_FILENAMES.some(f => f.toLowerCase() === fn);
      if (isC) center.push(art); else if (art.inchWidth <= 12 || isW) wing.push(art); else mid.push(art);
    });
    const cmp = (a, b) => this.compareChronoDesc(a, b);
    center.sort(cmp); wing.sort(cmp); mid.sort(cmp);
    const wL = [], wR = [], fL = [], fR = [];
    wing.forEach(a => { if (this.cum(wL, 0, false) <= this.cum(wR, 4, false)) wL.push(a); else wR.push(a); });
    mid.forEach(a => { if (this.cum(fL, 1, false) <= this.cum(fR, 3, false)) fL.push(a); else fR.push(a); });
    [wL, fL, center, fR, wR].forEach(c => c.sort(cmp));
    return [wL, fL, center, fR, wR];
  }
  compute3ColumnLayout(arts) {
    const center = [], side = [];
    arts.forEach(a => { if (Component.CENTER_HERO_3COL_FILENAMES.includes(a.filename)) center.push(a); else side.push(a); });
    const cmp = (a, b) => this.compareChronoDesc(a, b);
    center.sort(cmp); side.sort(cmp);
    const L = [], R = [];
    side.forEach(a => { if (this.cum(L, 0, true) <= this.cum(R, 2, true)) L.push(a); else R.push(a); });
    L.sort(cmp); center.sort(cmp); R.sort(cmp);
    return [L, center, R];
  }
  computeMobileLayout(arts) {
    const H = Component.CENTER_HERO_FILENAMES;
    const hero = arts.filter(a => H.includes(a.filename));
    const mid = arts.filter(a => !H.includes(a.filename) && a.inchWidth > 12);
    const small = arts.filter(a => a.inchWidth <= 12);
    const solos = hero.slice().sort((a, b) => this.compareChronoDesc(a, b));
    const { trinities, pairs } = this.groupSmallArtworksByShapeRatio(small);
    return { solos, duos: [...this.pairMidArtworksByShapeRatio(mid), ...pairs], trinities };
  }
}

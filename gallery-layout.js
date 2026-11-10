// Assign artworks using their physical size, shape, and the available column width.
export class Component {
  constructor({ newestMaxAge = 2, middleMaxAge = 6 } = {}) {
    if (!Number.isInteger(newestMaxAge) || newestMaxAge < 0
      || !Number.isInteger(middleMaxAge) || middleMaxAge <= newestMaxAge) {
      throw new RangeError("Age group boundaries must be increasing non-negative whole numbers.");
    }
    this.newestMaxAge = newestMaxAge;
    this.middleMaxAge = middleMaxAge;
  }

  resolveArtworkData(raw) {
    const latestYear = Math.max(0, ...raw.map((art) => Number(art.year) || 0));
    return raw.map((art) => {
      const width = Number(art.inchWidth);
      const height = Number(art.inchHeight);
      const hasSize = width > 0 && height > 0;
      const longest = hasSize ? Math.max(width, height) : null;
      let tier = 3;
      if (hasSize) {
        if (longest <= 8) tier = 1;
        else if (longest <= 16 && width <= 12) tier = 2;
        else if (longest <= 18) tier = 3;
        else if (longest <= 24) tier = 4;
        else tier = 5;
      }
      const ratio = Number(art.aspectRatio) > 0 ? Number(art.aspectRatio) : (hasSize ? width / height : 1);
      const year = Number(art.year);
      const age = year > 0 ? latestYear - year : null;
      const ageGroup = age === null ? 3 : age <= this.newestMaxAge ? 0 : age <= this.middleMaxAge ? 1 : 2;
      return { ...art, tier, ageGroup, shapeRatio: 1 / ratio, tall: ratio < 0.77 };
    });
  }

  compareChronoDesc(a, b) {
    return (Number(b.year) || 0) - (Number(a.year) || 0)
      || (Number(b.inchHeight) || 0) - (Number(a.inchHeight) || 0)
      || (Number(b.inchWidth) || 0) - (Number(a.inchWidth) || 0)
      || String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
  }

  compareGalleryOrder(a, b) {
    return a.ageGroup - b.ageGroup
      || ((Number(b.inchWidth) || 0) * (Number(b.inchHeight) || 0))
        - ((Number(a.inchWidth) || 0) * (Number(a.inchHeight) || 0))
      || this.compareChronoDesc(a, b);
  }

  columnWidths(viewportWidth, count) {
    const content = Math.max(0, Math.min(viewportWidth, 1800) - 72);
    if (count === 5) {
      const unit = Math.max(0, content - 160) / 4.74;
      return [0.6 * unit, unit, 1.54 * unit, unit, 0.6 * unit];
    }
    const unit = Math.max(0, content - 100) / 3.82;
    return [unit, 1.82 * unit, unit];
  }

  computeColumns(arts, count, viewportWidth) {
    const columns = Array.from({ length: count }, () => []);
    const heights = Array(count).fill(0);
    const widths = this.columnWidths(viewportWidth, count);
    const center = Math.floor(count / 2);
    const sorted = [...arts].sort((a, b) => this.compareChronoDesc(a, b));

    const cardHeight = (art, index) => {
      const hero = index === center;
      return Math.max(0, widths[index] - (hero ? 28 : 16)) * art.shapeRatio
        + (hero ? 30 : 18) + 8 + 22 + 24;
    };
    const add = (art, index) => {
      columns[index].push(art);
      heights[index] += cardHeight(art, index);
    };
    const sideColumns = count === 5 ? [1, 3] : [0, 2];
    const wingColumns = count === 5 ? [0, 4] : sideColumns;

    for (const art of sorted) {
      const square = art.shapeRatio >= 0.9 && art.shapeRatio <= 1.1;
      const hero = (art.tier === 4 && (square || (count === 3 && art.inchWidth >= 24 && !art.tall)))
        || (art.tier === 5 && !art.tall);
      const narrowPortrait = art.inchWidth > 0 && art.inchWidth <= 16
        && art.inchHeight <= 20 && art.shapeRatio > 1.1;
      if (hero) {
        add(art, center);
      } else {
        const choices = art.tier <= 2 || narrowPortrait ? wingColumns : sideColumns;
        const index = heights[choices[0]] <= heights[choices[1]] ? choices[0] : choices[1];
        add(art, index);
      }
    }

    // Move older, smaller works outward after the initial size-based placement.
    const imbalance = (values) => {
      const average = values.reduce((sum, height) => sum + height, 0) / values.length;
      return values.reduce((sum, height) => sum + (height - average) ** 2, 0);
    };
    const olderAndSmaller = (a, b) => b.art.ageGroup - a.art.ageGroup
      || (Number(a.art.inchWidth) || 0) * (Number(a.art.inchHeight) || 0)
        - (Number(b.art.inchWidth) || 0) * (Number(b.art.inchHeight) || 0)
      || this.compareChronoDesc(b.art, a.art);
    const moveOutward = (sources, destinations, eligible) => {
      const candidates = sources.flatMap((index) => columns[index]
        .filter((art) => eligible(art, index))
        .map((art) => ({ art, index })))
        .sort(olderAndSmaller);
      for (const { art, index } of candidates) {
        for (const destination of [...destinations].sort((a, b) => heights[a] - heights[b])) {
          if (heights[index] <= heights[destination]) continue;
          const adjusted = [...heights];
          adjusted[index] -= cardHeight(art, index);
          adjusted[destination] += cardHeight(art, destination);
          if (imbalance(adjusted) >= imbalance(heights)) continue;
          columns[index].splice(columns[index].indexOf(art), 1);
          heights[index] = adjusted[index];
          add(art, destination);
          return true;
        }
      }
      return false;
    };
    const newestLargeYear = Math.max(0, ...sorted
      .filter((art) => art.tier === 5)
      .map((art) => Number(art.year) || 0));
    let moved;
    do {
      moved = moveOutward([center], sideColumns,
        (art) => columns[center].length > 1 && art !== columns[center][0]
          && !(art.tier === 5 && Number(art.year) === newestLargeYear));
      if (count === 5) {
        moved = moveOutward(sideColumns, wingColumns,
          (art) => art.inchWidth > 0 && art.inchHeight > 0
            && Math.max(art.inchWidth, art.inchHeight) <= 24) || moved;
      }
    } while (moved);

    // Spread age groups across the center and medium columns. Trading a
    // recent medium-sized center work for a larger older work preserves the
    // scale hierarchy while improving the mix in each column.
    const primaryColumns = [center, ...sideColumns];
    const ageCounts = () => primaryColumns.map((index) =>
      [0, 1, 2].map((group) => columns[index].filter((art) => art.ageGroup === group).length));
    const ageImbalance = (counts) => {
      let score = 0;
      for (let group = 0; group < 3; group += 1) {
        const values = counts.map((column) => column[group]);
        const total = values.reduce((sum, value) => sum + value, 0);
        if (total) score += imbalance(values) / total;
      }
      return score;
    };
    while (true) {
      const counts = ageCounts();
      const before = ageImbalance(counts);
      let best = null;
      let bestAge = before;
      let bestHeight = Infinity;
      for (const centerArt of columns[center]) {
        if (centerArt === columns[center][0] || centerArt.tier !== 4 || centerArt.ageGroup !== 0) continue;
        for (const side of sideColumns) {
          for (const sideArt of columns[side]) {
            if (sideArt.tall || sideArt.ageGroup <= centerArt.ageGroup || sideArt.ageGroup > 2
              || sideArt.inchWidth * sideArt.inchHeight <= centerArt.inchWidth * centerArt.inchHeight) continue;
            const adjustedCounts = counts.map((column) => [...column]);
            const sideIndex = primaryColumns.indexOf(side);
            adjustedCounts[0][centerArt.ageGroup] -= 1;
            adjustedCounts[0][sideArt.ageGroup] += 1;
            adjustedCounts[sideIndex][centerArt.ageGroup] += 1;
            adjustedCounts[sideIndex][sideArt.ageGroup] -= 1;
            const ageScore = ageImbalance(adjustedCounts);
            const adjusted = [...heights];
            adjusted[center] += cardHeight(sideArt, center) - cardHeight(centerArt, center);
            adjusted[side] += cardHeight(centerArt, side) - cardHeight(sideArt, side);
            const heightScore = imbalance(adjusted);
            if (ageScore < bestAge - 1e-9
              || (Math.abs(ageScore - bestAge) < 1e-9 && ageScore < before - 1e-9 && heightScore < bestHeight)) {
              best = { centerArt, sideArt, side, adjusted };
              bestAge = ageScore;
              bestHeight = heightScore;
            }
          }
        }
      }
      if (!best) break;
      columns[center].splice(columns[center].indexOf(best.centerArt), 1, best.sideArt);
      columns[best.side].splice(columns[best.side].indexOf(best.sideArt), 1, best.centerArt);
      heights.splice(0, heights.length, ...best.adjusted);
    }

    // Recheck overall height after age redistribution. Older large landscapes
    // may return to a short center; older smaller works can fill the wings.
    let rebalanced;
    do {
      rebalanced = moveOutward(sideColumns, [center],
        (art) => art.ageGroup > 0 && art.tier === 5 && !art.tall);
      if (count === 5) {
        rebalanced = moveOutward(sideColumns, wingColumns,
          (art) => art.ageGroup > 0 && art.inchWidth > 0 && art.inchHeight > 0
            && Math.max(art.inchWidth, art.inchHeight) <= 24) || rebalanced;
      }
    } while (rebalanced);

    // Prefer the larger work when old large landscapes occupy center and flank
    // positions in the same age group.
    while (true) {
      let best = null;
      let bestGain = 0;
      let bestHeight = Infinity;
      for (const centerArt of columns[center]) {
        if (centerArt === columns[center][0] || centerArt.tier !== 5 || centerArt.tall) continue;
        const centerArea = centerArt.inchWidth * centerArt.inchHeight;
        for (const side of sideColumns) for (const sideArt of columns[side]) {
          if (sideArt.tier !== 5 || sideArt.tall || sideArt.ageGroup !== centerArt.ageGroup) continue;
          const gain = sideArt.inchWidth * sideArt.inchHeight - centerArea;
          if (gain <= 0) continue;
          const adjusted = [...heights];
          adjusted[center] += cardHeight(sideArt, center) - cardHeight(centerArt, center);
          adjusted[side] += cardHeight(centerArt, side) - cardHeight(sideArt, side);
          const score = imbalance(adjusted);
          if (gain > bestGain || (gain === bestGain && score < bestHeight)) {
            best = { centerArt, sideArt, side, adjusted };
            bestGain = gain;
            bestHeight = score;
          }
        }
      }
      if (!best) break;
      columns[center].splice(columns[center].indexOf(best.centerArt), 1, best.sideArt);
      columns[best.side].splice(columns[best.side].indexOf(best.sideArt), 1, best.centerArt);
      heights.splice(0, heights.length, ...best.adjusted);
    }
    const centerOpening = columns[center][0];
    columns.forEach((column, index) => column.sort((a, b) => {
      if (a === b) return 0;
      if (index === center && a === centerOpening) return -1;
      if (index === center && b === centerOpening) return 1;
      return this.compareGalleryOrder(a, b);
    }));
    return columns;
  }

  compute5ColumnLayout(arts, viewportWidth = 1600) {
    return this.computeColumns(arts, 5, viewportWidth);
  }

  orderByRules(items, rules, getIds = (item) => [item.id]) {
    const remaining = [...items];
    const result = [];
    while (remaining.length) {
      const index = remaining.findIndex((item) => {
        const ids = getIds(item);
        return !rules.some(({ before, after }) => ids.includes(after)
          && !ids.includes(before)
          && remaining.some((other) => other !== item && getIds(other).includes(before)));
      });
      if (index === -1) throw new Error("Manual artwork order contains a cycle.");
      result.push(...remaining.splice(index, 1));
    }
    return result;
  }

  applyManualPlacements(automaticColumns, placements, order = []) {
    const columns = automaticColumns.map((column) => [...column]);
    const first = [];
    for (const placement of placements) {
      const destination = placement.column - 1;
      if (!Number.isInteger(destination) || destination < 0 || destination >= columns.length) continue;
      const source = columns.findIndex((column) => column.some((art) => art.id === placement.id));
      if (source === -1) continue;
      const index = columns[source].findIndex((art) => art.id === placement.id);
      const [art] = columns[source].splice(index, 1);
      columns[destination].push(art);
      if (placement.position === "first") first.push({ art, destination });
    }
    columns.forEach((column) => column.sort((a, b) => this.compareGalleryOrder(a, b)));
    // Retain the automatic center opening unless it was explicitly moved.
    const center = Math.floor(columns.length / 2);
    const opening = automaticColumns[center][0];
    const openingIndex = columns[center].indexOf(opening);
    if (openingIndex > 0) columns[center].unshift(...columns[center].splice(openingIndex, 1));
    if (openingIndex >= 0) first.unshift({ art: opening, destination: center });
    return columns.map((column, destination) => {
      const pinned = first.filter((item) => item.destination === destination).map((item) => item.art);
      const rules = [...order];
      for (const art of pinned) {
        for (const other of column) {
          if (art !== other && !pinned.includes(other)) rules.push({ before: art.id, after: other.id });
        }
      }
      return this.orderByRules(column, rules);
    });
  }

  balanceFiveColumnLayout(manualColumns, placements, order = []) {
    const columns = manualColumns.map((column) => [...column]);
    const protectedIds = new Set([
      ...placements.map((placement) => placement.id),
      ...order.flatMap((rule) => [rule.before, rule.after]),
      columns[2][0]?.id,
    ]);
    const referenceWidths = [1080, 1200, 1600, 1800].map((width) => this.columnWidths(width, 5));
    const score = (arrangement) => referenceWidths.reduce((total, widths) => {
      const heights = arrangement.map((column, index) => column.reduce((sum, art) => {
        const center = index === 2;
        return sum + Math.max(0, widths[index] - (center ? 28 : 16)) * art.shapeRatio
          + (center ? 30 : 18) + 8 + 22 + 24;
      }, 0));
      const average = heights.reduce((sum, height) => sum + height, 0) / heights.length;
      return total + heights.reduce((sum, height) => sum + (height - average) ** 2, 0);
    }, 0);

    // Adjust only older, unpinned side works. Center and artist choices stay
    // fixed while the full column heights are compared at common widths.
    while (true) {
      const before = score(columns);
      let best = null;
      let bestScore = before;
      for (const source of [0, 1, 3, 4]) {
        for (const art of columns[source]) {
          if (protectedIds.has(art.id) || art.ageGroup !== 2) continue;
          const isWing = source === 0 || source === 4;
          const narrowPortrait = art.inchWidth > 0 && art.inchWidth <= 16
            && art.inchHeight <= 20 && art.shapeRatio > 1.1;
          let destinations;
          if (isWing) {
            destinations = art.tier >= 3 && !narrowPortrait ? [1, 3] : [source === 0 ? 4 : 0];
          } else {
            destinations = Math.max(art.inchWidth, art.inchHeight) <= 24
              ? [0, 4, source === 1 ? 3 : 1] : [source === 1 ? 3 : 1];
          }
          for (const destination of destinations) {
            const candidate = columns.map((column) => [...column]);
            candidate[source].splice(candidate[source].indexOf(art), 1);
            candidate[destination].push(art);
            const candidateScore = score(candidate);
            if (candidateScore < bestScore - 1) {
              best = { art, source, destination };
              bestScore = candidateScore;
            }
          }
        }
      }
      if (!best) break;
      columns[best.source].splice(columns[best.source].indexOf(best.art), 1);
      columns[best.destination].push(best.art);
    }
    return this.applyManualPlacements(columns, placements, order);
  }

  compute3ColumnLayout(arts, viewportWidth = 1100, referenceColumns = this.compute5ColumnLayout(arts)) {
    const columns = [referenceColumns[0].slice(), referenceColumns[2].slice(), referenceColumns[4].slice()];
    const widths = this.columnWidths(viewportWidth, 3);
    const cardHeight = (art, index) => {
      const center = index === 1;
      return Math.max(0, widths[index] - (center ? 28 : 16)) * art.shapeRatio
        + (center ? 30 : 18) + 8 + 22 + 24;
    };
    const heights = columns.map((column, index) => column.reduce((sum, art) => sum + cardHeight(art, index), 0));
    const middle = [...referenceColumns[1], ...referenceColumns[3]]
      .sort((a, b) => this.compareGalleryOrder(a, b));

    for (const art of middle) {
      let target = 0;
      for (let index = 1; index < columns.length; index += 1) {
        if (heights[index] + cardHeight(art, index) < heights[target] + cardHeight(art, target)) {
          target = index;
        }
      }
      columns[target].push(art);
      heights[target] += cardHeight(art, target);
    }
    const opening = referenceColumns[2][0];
    columns.forEach((column, index) => column.sort((a, b) => {
      if (a === b) return 0;
      if (index === 1 && a === opening) return -1;
      if (index === 1 && b === opening) return 1;
      return this.compareGalleryOrder(a, b);
    }));
    return columns;
  }

  computeMobileLayout(arts, referenceColumns = this.compute5ColumnLayout(arts), order = []) {
    const big = referenceColumns[2];
    const middle = [...referenceColumns[1], ...referenceColumns[3]];
    const small = [...referenceColumns[0], ...referenceColumns[4]];
    const byShape = (a, b) => b.shapeRatio - a.shapeRatio || this.compareChronoDesc(a, b);
    const ordered = (works, sort) => [0, 1, 2, 3].flatMap((ageGroup) => {
      const group = works.filter((art) => art.ageGroup === ageGroup);
      if (sort) group.sort(sort);
      return this.orderByRules(group, order);
    });
    const solos = ordered(big);
    const mids = [...middle].sort(byShape);
    const minis = ordered(small, byShape);
    const duos = [];
    const trinities = [];
    for (let i = 0; i < mids.length; i += 2) duos.push(mids.slice(i, i + 2));
    duos.sort((a, b) => {
      const newest = (pair) => Math.min(...pair.map((art) => art.ageGroup));
      const oldest = (pair) => Math.max(...pair.map((art) => art.ageGroup));
      return newest(a) - newest(b) || oldest(a) - oldest(b) || b.length - a.length
        || this.compareChronoDesc(a[0], b[0]);
    });
    const byId = new Map(middle.map((art) => [art.id, art]));
    const sameAge = order.filter(({ before, after }) => byId.has(before) && byId.has(after)
      && byId.get(before).ageGroup === byId.get(after).ageGroup);
    const orderedDuos = this.orderByRules(duos, sameAge, (pair) => pair.map((art) => art.id))
      .map((pair) => this.orderByRules(pair, sameAge));
    for (let i = 0; i < minis.length; i += 3) trinities.push(minis.slice(i, i + 3));

    const rows = [];
    const count = Math.max(solos.length, orderedDuos.length, trinities.length);
    for (let i = 0; i < count; i += 1) {
      if (solos[i]) rows.push({ items: [solos[i]], kind: "solo", slots: 1, gap: "0" });
      if (orderedDuos[i]) rows.push({ items: orderedDuos[i], kind: "duo", slots: 2, gap: "18px" });
      if (trinities[i]) rows.push({ items: trinities[i], kind: "trio", slots: 3, gap: "21px" });
    }
    return { rows };
  }
}

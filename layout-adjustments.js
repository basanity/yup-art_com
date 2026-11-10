// Artist-selected placements, using the five-column gallery as the reference.
// Column numbers run left to right. Set position to "first" to pin the opening.
export const manualPlacements = [
  { id: 45, column: 2, position: "first" },
  { id: 48, column: 3 },
  { id: 39, column: 4 },
  { id: 24, column: 3 },
  { id: 35, column: 2 },
  { id: 51, column: 3 },
  { id: 23, column: 2 },
];

// These pairs specify which artwork should appear first when they share a column.
export const manualOrder = [
  { before: 49, after: 57 },
  { before: 43, after: 50 },
  { before: 48, after: 51 },
];

export const getSearchCoincidences = ({ str, intersection }: { str: string; intersection: string }) =>
  `<span>${str.replaceAll(
    new RegExp(intersection, 'gi'),
    (casePreservedMatch) => `<span class="blackModeIntersection">${casePreservedMatch}</span>`
  )}</span>`
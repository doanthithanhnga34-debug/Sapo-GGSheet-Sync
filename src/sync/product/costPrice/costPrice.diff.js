const COST_PRICE_COLUMN_INDEX = 7; //Cột H

function normalizeCost(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function buildCostPriceDiff({ locationId, sheetIndex, costItems }) {
  const updates = [];
  let skipped = 0;
  let notFound = 0;
  let invalidCost = 0;

  for (const item of costItems) {
    const uniqueId = `${item.variantId}_${locationId}`;
    const existing = sheetIndex.get(uniqueId);

    if (!existing) {
      notFound++;
      continue;
    }
    const oldCost = normalizeCost(existing.values[COST_PRICE_COLUMN_INDEX]);
    const newCost = normalizeCost(item.costPrice);
    if (newCost === null) {
      invalidCost++;
      continue;
    }

    if (oldCost === newCost) {
      skipped++;
      continue;
    }
    updates.push({
      uniqueId,
      rowNo: existing.rowNo,
      oldCost,
      newCost,
    });
  }
  return {
    updates,
    stats: {
      updated: updates.length,
      skipped,
      notFound,
      invalidCost,
    },
  };
}
module.exports = {
  buildCostPriceDiff,
};

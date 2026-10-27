const { normalizePrice } = require("../../../utils/price.helper");

const COST_PRICE_COLUMN_INDEX = 7; //Cột H

function parseCost(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  let text = String(value).trim();

  // 114814,81 → 114814.81
  // 114.814,81 → 114814.81
  if (text.includes(",")) {
    text = text.replace(/\./g, "").replace(",", ".");
  }

  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function buildCostPriceDiff({ locationId, sheetIndex, costItems }) {
  const updates = [];
  let skipped = 0;
  let notFound = 0;
  let invalidCost = 0;

  const seenIds = new Set();

  for (const item of costItems) {
    const uniqueId = `${item.variantId}_${locationId}`;

    if (seenIds.has(uniqueId)) {
      throw new Error(`[Cost Price Diff] Duplicate uniqueId: ${uniqueId}`);
    }

    seenIds.add(uniqueId);

    const existing = sheetIndex.get(uniqueId);

    if (!existing) {
      notFound++;
      continue;
    }

    const rawCost = parseCost(item.costPrice);

    if (rawCost === null) {
      invalidCost++;
      continue;
    }

  
    const newCost = Math.round(rawCost);

    const oldCost = parseCost(existing.values[COST_PRICE_COLUMN_INDEX]);

    if (oldCost === newCost) {
      skipped++;
      continue;
    }

    if (!Number.isInteger(existing.rowNo) || existing.rowNo < 2) {
      throw new Error(`[Cost Price Diff] Invalid rowNo: ${uniqueId}`);
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

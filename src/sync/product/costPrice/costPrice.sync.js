const sheetServices = require("../../../services/sheet/sheet.service");
const inventoryItemService = require("../../../services/sapo/product/inventory-item.service");
const inventoryItemFS = require("../../../services/firestore/inventory-item.firestore");
const locationFS = require("../../../services/firestore/location.firestore");
const config = require("../../../config/config");
const { buildCostPriceDiff } = require("./costPrice.diff");

const UPDATE_BATCH_SIZE = 250;
function escapeSheetName(name) {
  return String(name).replace(/'/g, "''");
}

function buildCostItems(mappings, inventoryItems) {
  const mappingMap = new Map();
  for (const mapping of mappings) {
    mappingMap.set(String(mapping.inventoryItemId), mapping);
  }

  const costItems = [];
  for (const item of inventoryItems) {
    const mapping = mappingMap.get(String(item.id));
    if (!mapping) continue;
    costItems.push({
      inventoryItemId: String(item.id),
      variantId: String(mapping.variantId),
      costPrice: item.cost_price,
    });
  }
  return costItems;
}

async function writeCostPriceUpdates({
  spreadsheetId,
  sheetName,
  updates,
  dryRun,
}) {
  if (dryRun || updates.length === 0) {
    return {
      written: 0,
      batches: 0,
    };
  }
  const escapedName = escapeSheetName(sheetName);
  const data = updates.map((update) => ({
    range: `'${escapedName}'!H${update.rowNo}`,
    values: [[update.newCost]],
  }));
  let written = 0;
  let batches = 0;
  for (let i = 0; i < data.length; i += UPDATE_BATCH_SIZE) {
    const batch = data.slice(i, i + UPDATE_BATCH_SIZE);
    await sheetServices.batchUpdateValues(batch, spreadsheetId);
    written += batch.length;
    batches++;
    console.log("[Cost price write]", {
      sheetName,
      written,
      total: data.length,
    });
  }
  return {
    written,
    batches,
  };
}

async function syncCostPrice({ dryRun = true } = {}) {
  const startedAt = Date.now();
  const mappings = await inventoryItemFS.getAllMappings();
  if (!Array.isArray(mappings) || mappings.length === 0) {
    throw new Error("[Cost Price] No inventory mappings found");
  }
  const inventoryItemIds = [
    ...new Set(mappings.map((mapping) => String(mapping.inventoryItemId))),
  ];
  console.log("[Cost Price] Mappings loaded", {
    totalMappings: mappings.length,
    uniqueInventoryItems: inventoryItemIds.length,
  });
  const inventoryItems = await inventoryItemService.getByIds(inventoryItemIds);
  const returnedIds = new Set(inventoryItems.map((item) => String(item.id)));
  const missingIds = inventoryItemIds.filter((id) => !returnedIds.has(id));
  if (missingIds.length > 0) {
    console.warn("[Cost Price] Missing Inventory Items", {
      total: missingIds.length,
      sample: missingIds.slice(0, 10),
    });
    // throw new Error(
    //   `[Cost Price] Missing ${missingIds.length} inventory items. ` +
    //     `Sample: ${missingIds.slice(0, 5).join(", ")}`,
    // );
  }
  const costItems = buildCostItems(mappings, inventoryItems);
  const locations = await locationFS.getAll();

  if (!Array.isArray(locations) || locations.length === 0) {
    throw new Error("[Cost Price] No locations found");
  }

  const results = [];
  for (const location of locations) {
    const branchStartedAt = Date.now();

    const locationId = String(location.id);
    const sheetName = location.name;

    try {
      console.log("[Cost Price] Checking", {
        locationId,
        sheetName,
      });

      const sheet = await sheetServices.buildSheetIndex({
        spreadsheetId: config.sheetProduct.id,
        sheetName,
      });

      const diff = buildCostPriceDiff({
        locationId,
        sheetIndex: sheet.index,
        costItems,
      });

      const writeResult = await writeCostPriceUpdates({
        spreadsheetId: config.sheetProduct.id,
        sheetName,
        updates: diff.updates,
        dryRun,
      });

      results.push({
        locationId,
        sheetName,
        success: true,
        existingRows: sheet.existingRows,
        ...diff.stats,
        written: writeResult.written,
        batches: writeResult.batches,
        durationSeconds: (Date.now() - branchStartedAt) / 1000,
        sampleUpdates: diff.updates.slice(0, 3),
      });
    } catch (error) {
      console.error("[Cost Price] Branch failed", {
        locationId,
        sheetName,
        message: error.message,
      });

      results.push({
        locationId,
        sheetName,
        success: false,
        error: error.message,
        durationSeconds: (Date.now() - branchStartedAt) / 1000,
      });
    }
  }

  return {
    dryRun,
    totalMappings: mappings.length,
    totalInventoryItems: inventoryItems.length,
    totalLocations: locations.length,
    successLocations: results.filter((r) => r.success).length,
    failedLocations: results.filter((r) => !r.success).length,
    totalUpdates: results.reduce((sum, r) => sum + (r.updated || 0), 0),
    totalWritten: results.reduce((sum, r) => sum + (r.written || 0), 0),
    durationSeconds: (Date.now() - startedAt) / 1000,
    branches: results,
  };
}

module.exports = {
  syncCostPrice,
};

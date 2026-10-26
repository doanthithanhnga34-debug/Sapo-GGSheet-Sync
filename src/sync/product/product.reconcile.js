const { exists } = require("@google-cloud/firestore/pipelines");
const config = require("../../config/config");
const variantService = require("../../services/sapo/product/variant.service");
const sheetServices = require("../../services/sheet/sheet.service");
const locationFS = require("../../services/firestore/location.firestore");
const { calendar } = require("googleapis/build/src/apis/calendar");
const inventoryItemFS = require("../../services/firestore/inventory-item.firestore");
const inventoryItemService = require("../../services/sapo/product/inventory-item.service");
const productServices = require("../../services/sapo/product/product.service");

async function reconcileDeletedVariants({ location, dryRun = true }) {
  const locationId = String(location.id);
  const sheetName = location.name;

  const limit = config.sapo.productLimit;
  let page = 1;
  const sapoIds = new Set();

  while (true) {
    const variants = await variantService.getVariants({
      locationId,
      page,
      limit,
    });
    if (!Array.isArray(variants)) {
      throw new Error(`[Delete sync ] invalid response at page ${page}`);
    }
    for (const variant of variants) {
      sapoIds.add(`${variant.id}_${locationId}`);
    }

    if (variants.length < limit) break;
    page++;
  }

  const sheet = await sheetServices.buildSheetIndex({
    spreadsheetId: config.sheetProduct.id,
    sheetName,
  });

  const deletedRows = [];

  for (const [uniqueId, existing] of sheet.index) {
    if (!sapoIds.has(uniqueId)) {
      deletedRows.push({
        uniqueId,
        rowNo: existing.rowNo,
      });
    }
  }
  deletedRows.sort((a, b) => b.rowNo - a.rowNo);

  return {
    locationId,
    sheetName,
    dryRun,
    sapoVariants: sapoIds.size,
    existing: sheet.existingRows,
    deleted: deletedRows.length,
    deletedRows,
  };
}

async function reconcileAllLocations() {
  const startedAt = Date.now();
  const locations = await locationFS.getAll();

  const results = [];

  for (const location of locations) {
    const locationStartedAt = Date.now();

    try {
      const result = await reconcileDeletedVariants({
        location,
        dryRun: true,
      });

      const deletedRows = result.deletedRows ?? [];
      const MAX_DELETE_ROWS = 20;

      if (deletedRows.length > MAX_DELETE_ROWS) {
        throw new Error(
          `[Delete Reconcile] ${location.name}: ` +
            `${deletedRows.length} rows exceed safety limit`,
        );
      }
      let deleted = 0;
      if (deletedRows.length > 0) {
        deleted = await sheetServices.deleteRowsBatch(
          deletedRows.map((row) => row.rowNo),
          location.name,
          config.sheetProduct.id,
        );
      }

      results.push({
        locationId: String(location.id),
        sheetName: location.name,
        success: true,
        sapoVariants: result.sapoVariants,
        existingRows: result.existing,
        plannedDeletes: deletedRows.length,
        deleted,
        sampleDeletes: deletedRows.slice(0, 5),
        durationSeconds: (Date.now() - locationStartedAt) / 1000,
      });
    } catch (e) {
      results.push({
        locationId: String(location.id),
        sheetName: location.name,
        success: false,
        error: e.message,
        durationSeconds: (Date.now() - locationStartedAt) / 1000,
      });
    }
  }

  let mappingCleanup = {
    checked: 0,
    missing: 0,
    deleted: 0,
  };
  const allLocationsSucceeded = results.every((result) => result.success);
  if (allLocationsSucceeded) {
    mappingCleanup = await cleanUpInventoryMappings();
  } else {
    console.warn("[Mapping cleanup] skipped cause some location failed");
  }

  return {
    totalLocations: locations.length,
    successLocations: results.filter((r) => r.success).length,
    failedLocations: results.filter((r) => !r.success).length,
    mappingCleanup,
    durationSeconds: (Date.now() - startedAt) / 1000,
    branches: results,
  };
}



async function cleanUpInventoryMappings() {
  const mappings = await inventoryItemFS.getAllMappings();
  if (!mappings.length) {
    return {
      checked: 0,
      plannedDeletes: 0,
      deleted: 0,
    };
  }

  const products = await productServices.getAllProduct();
  if (!Array.isArray(products) || products.length === 0) {
    throw new Error("[Mapping cleanup ] products response empty or invalid");
  }

  const activeInventoryItemIds = new Set();
  for (const product of products) {
    if (!Array.isArray(product.variants)) {
      throw new Error(
        `[Mapping cleanup] missing variants : product: ${product.id}`,
      );
    }

    for (const variant of product.variants) {
      if (variant.inventory_item_id !== null) {
        activeInventoryItemIds.add(String(variant.inventory_item_id));
      }
    }
  }
  const deletedMappings = mappings.filter(
    (mapping) => !activeInventoryItemIds.has(String(mapping.inventoryItemId)),
  );
  const deletedIds = deletedMappings.map((mapping) =>
    String(mapping.inventoryItemId),
  );

  let deleted = 0;

  if (deletedIds.length > 0) {
    const result = await inventoryItemFS.deleteMappingsByIds(deletedIds);
    deleted = result.deleted;
  }
  return {

    checked: mappings.length,
    activeInventoryItems: activeInventoryItemIds.size,
    plannedDeletes: deletedIds.length,
    deleted,
    sampleDeletes: deletedMappings.slice(0, 10),
  };
}

module.exports = {
  reconcileDeletedVariants,
  reconcileAllLocations,
};

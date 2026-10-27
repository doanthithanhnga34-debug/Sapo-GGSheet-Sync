const config = require("../../config/config");
const inventoryItemFS = require("../../services/firestore/inventory-item.firestore");
const locationFS = require("../../services/firestore/location.firestore");
const inventoryItemService = require("../../services/sapo/product/inventory-item.service");
const inventoryLevelService = require("../../services/sapo/product/inventory-levels.service");
const locationService = require("../../services/sapo/product/location.service");
const productServices = require("../../services/sapo/product/product.service");
const variantService = require("../../services/sapo/product/variant.service");
const { buildDiff } = require("../../services/sheet/product/diff.sheet");
const logService = require("../../services/sheet/product/log/log.sheet");
const {
  writeProductDiff,
} = require("../../services/sheet/product/product.sheet");
const sheetServices = require("../../services/sheet/sheet.service");
const variantSyncState = require("../../services/syncState/variant.SyncState.service");
const { getIncrementalStartAt } = require("../../utils/formatDate");
const { collectIds } = require("./IdsCollectors");
const { buildBranchRows, buildDataMaps } = require("./product.data.service");
const productMapper = require("./product.mapper");
const { randomUUID } = require("node:crypto");

async function buildLocations() {
  const data = await locationService.getAllLocations({
    page: 0,
    limit: config.sapo.limit,
  });
  const locations = data.map((item) => ({
    id: item.id,
    name: item.name,
  }));

  await Promise.all(
    locations.map((location) => locationFS.set(String(location.id), location)),
  );
  return locations;
}
async function buildInventoryMappings() {
  const products = await productServices.getAllProduct();

  const mappings = await inventoryItemService.inventoryItemMapping(products);
  const result = await inventoryItemFS.saveMappings(mappings);
  return {
    totalProduct: products.length,
    totalMapping: mappings.length,
    ...result,
  };
}
async function buildVariantAllBranch() {
  const startedAt = Date.now();

  const locations = await locationFS.getAll();

  const CONCURRENCY = 3;

  async function fetchBranchVariants(location) {
    const branchStartedAt = Date.now();

    let page = 1;
    const variants = [];

    while (true) {
      const data = await variantService.getVariants({
        locationId: location.id,
        page,
        limit: config.sapo.productLimit,
      });

      variants.push(...data);

      console.log(`[${location.name}] Page ${page}: ${data.length} variants`);

      if (data.length < config.sapo.productLimit) {
        break;
      }

      page++;
    }

    return {
      locationId: location.id,
      locationName: location.name,
      total: variants.length,
      durationSeconds: Math.round((Date.now() - branchStartedAt) / 1000),
      variants,
    };
  }

  const results = [];

  // Chạy theo từng nhóm tối đa 3 chi nhánh
  for (let i = 0; i < locations.length; i += CONCURRENCY) {
    const batch = locations.slice(i, i + CONCURRENCY);

    const batchResults = await Promise.allSettled(
      batch.map((location) => fetchBranchVariants(location)),
    );

    batchResults.forEach((result, index) => {
      const location = batch[index];

      if (result.status === "fulfilled") {
        results.push({
          ...result.value,
          success: true,
        });
      } else {
        console.error(`[${location.name}] Sync failed:`, result.reason);

        results.push({
          locationId: location.id,
          locationName: location.name,
          success: false,
          total: 0,
          error: result.reason?.message || String(result.reason),
        });
      }
    });
  }

  return {
    totalLocations: locations.length,
    successLocations: results.filter((r) => r.success).length,
    failedLocations: results.filter((r) => !r.success).length,
    totalVariants: results.reduce((sum, r) => sum + r.total, 0),
    durationSeconds: Math.round((Date.now() - startedAt) / 1000),
    branches: results,
  };
}

async function processProductSheet({
  branch,
  mappedRows,
  spreadsheetId,
  dryRun = true,
}) {
  const startedAt = Date.now();

  const sheetName = locationService.getSheetName(
    branch.locationId,
    branch.locationName,
  );
  const sheet = await sheetServices.buildSheetIndex({
    spreadsheetId,
    sheetName,
  });

  const diff = buildDiff(mappedRows, sheet.index);
  console.log("[Product Diff]", {
    inserted: diff.inserts.length,
    updated: diff.updates.length,
    skipped: diff.skipped,
    sampleUpdates: diff.updates.slice(0, 3),
  });

  const writeResult = await writeProductDiff({
    spreadsheetId,
    sheetName,
    diff,
    dryRun,
  });

  return {
    locationId: branch.locationId,
    sheetName,
    totalRows: mappedRows.length,
    existingRows: sheet.existingRows,
    ...writeResult,
    durationSeconds: (Date.now() - startedAt) / 1000,
  };
}

// Sync initial product to sheet
async function syncOneBranch({
  locationId,
  locationName,
  dryRun = true,
  branch: providedBranch = null,
}) {
  let branch = providedBranch;

  if (!branch) {
    const variants = [];
    let page = 1;
    const limit = config.sapo.productLimit;
    while (true) {
      const data = await variantService.getVariants({
        locationId,
        page,
        limit,
      });
      if (!Array.isArray(data)) {
        throw new Error(
          `[Product Sync] Invalid variants response: ${locationName}`,
        );
      }
      variants.push(...data);

      if (data.length < limit) break;
      page++;
    }
    branch = {
      locationId,
      locationName,
      success: true,
      variants,
    };
  }

  const { productIds, inventoryItemIds } = collectIds([branch]);

  const products = await productServices.getByIds(productIds);
  const inventoryItems = await inventoryItemService.getByIds(inventoryItemIds);
  const inventoryLevels = await inventoryLevelService.getByIds({
    inventoryItemIds,
    locationId,
  });
  console.log("[Product Mapping]", {
    variants: branch.variants.length,
    products: products.length,
    inventoryItems: inventoryItems.length,
    inventoryLevels: inventoryLevels.length,
  });
  const dataMaps = buildDataMaps({
    products,
    inventoryItems,
    inventoryLevels,
  });
  if (!dryRun) {
    await sheetServices.ensureSheet(
      locationService.getSheetName(locationId, locationName),
      1000,
      productMapper.HEADERS.length,
      config.sheetProduct.id,
    );
  }
  const mapped = buildBranchRows({
    branch,
    dataMaps,
  });

  return processProductSheet({
    branch,
    mappedRows: mapped.rows,
    spreadsheetId: config.sheetProduct.id,
    dryRun,
  });
}

async function syncAllBranches({ dryRun = false } = {}) {
  const startedAt = Date.now();
  const variantsResults = await buildVariantAllBranch();
  const results = [];

  for (const [index, branch] of variantsResults.branches.entries()) {
    const branchStartedAt = Date.now();
    console.log(
      `[Product Sync] ${index + 1}/${variantsResults.branches.length} - ${branch.locationName}`,
    );
    const syncStartedAt = new Date().toISOString();
    const locationId = String(branch.locationId);
    const locationName = branch.locationName;

    console.log(
      `[Product Sync] ${index + 1}/${variantsResults.branches.length} - ${locationName}`,
    );
    if (!branch.success) {
      results.push({
        locationId: String(branch.locationId),
        locationName: branch.locationName,
        success: false,
        error: branch.error,
      });

      continue;
    }
    try {
      const result = await syncOneBranch({
        locationId,
        locationName,
        branch,
        dryRun,
      });

      if (!dryRun) {
        await variantSyncState.saveSuccess(locationId, syncStartedAt);

        console.log("[Product Sync] Checkpoint saved", {
          locationId,
          locationName,
          checkpoint: syncStartedAt,
        });
      }

      results.push({
        ...result,
        locationId,
        locationName,
        success: true,
        checkpointSaved: !dryRun,
        checkpoint: dryRun ? null : syncStartedAt,
        durationSeconds: (Date.now() - branchStartedAt) / 1000,
      });
    } catch (error) {
      console.error(`[Product Sync] FAILED - ${branch.locationName}`, error);

      results.push({
        locationId: String(branch.locationId),
        locationName: branch.locationName,
        success: false,
        checkpointSaved: false,
        error: error.message,
        durationSeconds: (Date.now() - branchStartedAt) / 1000,
      });
    }
  }
  return {
    dryRun,
    totalLocations: variantsResults.totalLocations,
    successLocations: results.filter((r) => r.success).length,
    failedLocations: results.filter((r) => !r.success).length,
    totalDurationSeconds: (Date.now() - startedAt) / 1000,
    branches: results,
  };
}

//INCREMENTAL

async function variantIncremental({ location, dryRun = true }) {
  const startedAt = Date.now();
  const locationId = String(location.id);
  const locationName = String(location.name);

  const syncStartedAt = new Date().toISOString();

  const state = await variantSyncState.getState(locationId);
  // if (!state?.lastSuccessSync) {
  //   throw new Error(
  //     `[Variant Sync] Missing checkpoint for ${locationName}. ` +
  //       `Run initial sync or initialize checkpoint first.`,
  //   );
  // }

  console.log("State checkpoint last successful sync", state.lastSuccessSync);
  const checkpoint = state?.lastSuccessSync ?? syncStartedAt;
  console.log("Checkpoint running", checkpoint);
  const modifiedOnMin = getIncrementalStartAt(checkpoint);

  let page = 1;
  const limit = config.sapo.productLimit;
  const variantsModified = [];

  while (true) {
    const variants = await variantService.getVariants({
      page,
      limit,
      locationId,
      modifiedOnMin,
    });

    variantsModified.push(...variants);
    if (variants.length < limit) {
      break;
    }
    page++;
  }
  console.log("[Variant Sync]", {
    locationId,
    locationName,
    modifiedOnMin,
    modifiedVariants: variantsModified.length,
  });

  if (variantsModified.length === 0) {
    if (!dryRun) {
      await variantSyncState.saveSuccess(locationId, syncStartedAt);
    }
    return {
      locationId,
      locationName,
      dryRun,
      modifiedOnMin,
      modifiedVariants: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      durationSeconds: (Date.now() - startedAt) / 1000,
    };
  }
  const branch = {
    locationId,
    locationName,
    success: true,
    variants: variantsModified,
  };
  const { productIds, inventoryItemIds } = collectIds([branch]);
  const products = await productServices.getByIds(productIds);
  const inventoryItems = await inventoryItemService.getByIds(inventoryItemIds);
  const inventoryLevels = await inventoryLevelService.getByIds({
    inventoryItemIds,
    locationId,
  });

  const dataMaps = buildDataMaps({
    products,
    inventoryItems,
    inventoryLevels,
  });

  const mapped = buildBranchRows({
    branch,
    dataMaps,
  });
  console.log("[Variant Incremental Mapping]", {
    locationId,
    variantsModified: variantsModified.length,
    mappedRows: mapped.rows.length,
    uniqueIds: new Set(mapped.rows.map((row) => String(row[0]))).size,
  });

  const sheetResult = await processProductSheet({
    branch,
    mappedRows: mapped.rows,
    spreadsheetId: config.sheetProduct.id,
    dryRun,
  });

  const mappings = variantsModified
    .filter(
      (variant) =>
        variant.id != null &&
        variant.inventory_item_id != null &&
        variant.product_id != null,
    )
    .map((variant) => ({
      inventoryItemId: String(variant.inventory_item_id),
      variantId: String(variant.id),
      productId: String(variant.product_id),
    }));
  if (!dryRun) {
    await inventoryItemFS.saveMappings(mappings);
    await variantSyncState.saveSuccess(locationId, syncStartedAt);
  }
  return {
    ...sheetResult,
    locationId,
    locationName,
    dryRun,
    modifiedOnMin,
    modifiedVariants: variantsModified.length,
    mappingsProcessed: mappings.length,
    durationSeconds: (Date.now() - startedAt) / 1000,
  };
}
async function allVariantIncremental({
  dryRun = true,
  locationIds = null,
} = {}) {
  const startedAt = Date.now();
  const runId = randomUUID();
  const allLocations = await locationFS.getAll();
  const filterIds = locationIds ? new Set(locationIds.map(String)) : null;

  const locations = filterIds
    ? allLocations.filter((location) => filterIds.has(String(location.id)))
    : allLocations;
  if (!locations.length) {
    throw new Error("[Variant Sync] No location found");
  }

  await logService.ensureSyncLogSheet();

  const results = [];
  for (const location of locations) {
    const branchStartedAt = Date.now();
    let result;
    try {
      const syncResult = await variantIncremental({
        location,
        dryRun,
      });

      result = {
        ...syncResult,
        success: true,
      };
    } catch (error) {
      console.error("[Variant Sync] Failed", {
        locationId: location.id,
        locationName: location.name,
        message: error.message,
      });

      result = {
        locationId: String(location.id),
        locationName: location.name,
        success: false,
        error: error.message,
        modifiedVariants: 0,
        inserted: 0,
        updated: 0,
        skipped: 0,
        durationSeconds: (Date.now() - branchStartedAt) / 1000,
      };
    }

    results.push(result);
    try {
      await logService.writeSyncLog({
        runId,
        locationId: location.id,
        locationName: location.name,
        status: result.success ? "SUCCESS" : "FAILED",
        modifiedOnMin: result.modifiedOnMin ?? "",
        modifiedVariants: result.modifiedVariants ?? 0,
        inserted: result.inserted ?? 0,
        updated: result.updated ?? 0,
        skipped: result.skipped ?? 0,
        durationSeconds: result.durationSeconds ?? 0,
        error: result.error ?? "",
      });
    } catch (logError) {
      console.error("[SyncLog] Write failed", {
        locationId: location.id,
        error: logError.message,
      });

      result.logError = logError.message;
    }
  }

  try {
    const cleanup = await logService.cleanUpOldSyncLogs();

    console.log("[SyncLog Cleanup]", cleanup);
  } catch (error) {
    console.error("[SyncLog Cleanup Failed]", {
      message: error.message,
    });
  }

  return {
    runId,
    dryRun,
    totalLocations: locations.length,
    successLocations: results.filter((r) => r.success).length,
    failedLocations: results.filter((r) => !r.success).length,
    modifiedVariants: results.reduce(
      (sum, r) => sum + (r.modifiedVariants || 0),
      0,
    ),
    inserted: results.reduce((sum, r) => sum + (r.inserted || 0), 0),
    updated: results.reduce((sum, r) => sum + (r.updated || 0), 0),
    skipped: results.reduce((sum, r) => sum + (r.skipped || 0), 0),
    durationSeconds: (Date.now() - startedAt) / 1000,
    branches: results,
  };
}

const productSync = {
  buildLocations,
  buildVariantAllBranch,

  syncAllBranches,
  buildInventoryMappings,
  variantIncremental,
  allVariantIncremental,
  syncOneBranch,
};

module.exports = productSync;

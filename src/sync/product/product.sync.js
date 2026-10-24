const config = require("../../config/config");
const inventoryItemFS = require("../../services/firestore/inventory-item.firestore");
const locationFS = require("../../services/firestore/location.firestore");
const inventoryItemService = require("../../services/sapo/product/inventory-item.service");
const inventoryLevelService = require("../../services/sapo/product/inventory-levels.service");
const locationService = require("../../services/sapo/product/location.service");
const productServices = require("../../services/sapo/product/product.service");
const variantService = require("../../services/sapo/product/variant.service");
const { buildDiff } = require("../../services/sheet/product/diff.sheet");
const {
  writeProductDiff,
} = require("../../services/sheet/product/product.sheet");
const sheetServices = require("../../services/sheet/sheet.service");
const variantSyncState = require("../../services/syncState/variant.SyncState.service");
const { getModifiedOnMinProduct } = require("../../utils/formatDate");
const { collectIds } = require("./IdsCollectors");
const { buildBranchRows, buildDataMaps } = require("./product.data.service");
const productMapper = require("./product.mapper");

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

  // Lấy toàn bộ locations từ Firestore
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

  const sheetName = branch.locationName;

  // Đọc Google Sheets.
  const sheet = await sheetServices.buildSheetIndex({
    spreadsheetId,
    sheetName,
  });

  // So sánh dữ liệu.
  const diff = buildDiff(mappedRows, sheet.index);
  console.log("[Product Diff]", {
    inserted: diff.inserts.length,
    updated: diff.updates.length,
    skipped: diff.skipped,
    sampleUpdates: diff.updates.slice(0, 3),
  });

  // Ghi khi dryRun = false.
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
async function testProductMapping() {
  const startedAt = Date.now();
  const variantResults = await buildVariantAllBranch({
    includeVariants: true,
  });
  const locationId = "925711";
  const locationName = "Huỳnh Thiện Lộc";

  const branch = variantResults.branches.find(
    (item) => String(item.locationId) === locationId,
  );

  if (!branch || !branch.success) {
    throw new Error(`Cannot fetch variants for location ${locationId}`);
  }
  const { productIds, inventoryItemIds, locationInventoryMap } = collectIds([
    branch,
  ]);

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
  await sheetServices.ensureSheet(
    locationName,
    1000,
    productMapper.HEADERS.length,
    config.sheetProduct.id,
  );

  const result = buildBranchRows({
    branch,
    dataMaps,
  });
  const sheetStartedAt = Date.now();
  const sheetResult = await processProductSheet({
    branch,
    mappedRows: result.rows,
    spreadsheetId: config.sheetProduct.id,
    dryRun: false,
  });
  const sheet = await sheetServices.buildSheetIndex({
    spreadsheetId: config.sheetProduct.id,
    sheetName: locationName,
  });

  const sheetReadSeconds = (Date.now() - sheetStartedAt) / 1000;

  const diffStartedAt = Date.now();

  const diff = buildDiff(result.rows, sheet.index);

  const diffSeconds = (Date.now() - diffStartedAt) / 1000;
  return {
    ...sheetResult,
    totalDurationSeconds: (Date.now() - startedAt) / 1000,
  };
}

// Sync initial product to sheet
async function syncOneBranch({ locationId, locationName, dryRun }) {
  const variantResults = await buildVariantAllBranch({
    includeVariants: true,
  });
  const branch = variantResults.branches.find(
    (item) => String(item.locationId) === locationId,
  );

  if (!branch || !branch.success) {
    throw new Error(`Cannot fetch variants for location ${locationId}`);
  }
  const { productIds, inventoryItemIds, locationInventoryMap } = collectIds([
    branch,
  ]);

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
      locationName,
      1000,
      productMapper.HEADERS.length,
      config.sheetProduct.id,
    );
  }
  const result = buildBranchRows({
    branch,
    dataMaps,
  });
  const sheetStartedAt = Date.now();
  const sheetResult = await processProductSheet({
    branch,
    mappedRows: result.rows,
    spreadsheetId: config.sheetProduct.id,
    dryRun: dryRun,
  });
  const sheet = await sheetServices.buildSheetIndex({
    spreadsheetId: config.sheetProduct.id,
    sheetName: locationName,
  });
  return {
    ...sheetResult,
  };
}

async function syncAllBranches({ dryRun = true } = {}) {
  const startedAt = Date.now();
  const variantResults = await buildVariantAllBranch({
    includeVariants: true,
  });

  const locations = await locationFS.getAll();
  const results = [];

  for (const [index, location] of locations.entries()) {
    const branchStartedAt = Date.now();
    console.log(
      `[Product Sync] ${index + 1}/${locations.length} - ${location.name}`,
    );
    try {
      const result = await syncOneBranch({
        locationId: String(location.id),
        locationName: location.name,
        dryRun,
      });
      results.push({
        locationId: location.id,
        locationName: location.name,
        success: true,
        ...result,
        durationSeconds: (Date.now() - branchStartedAt) / 1000,
      });
      console.log(`[Product Sync] SUCCESS - ${location.name}`);
    } catch (error) {
      console.error(`[Product Sync] FAILED - ${location.name}`, error);

      results.push({
        locationId: location.id,
        locationName: location.name,
        success: false,
        error: error.message,
        durationSeconds: (Date.now() - branchStartedAt) / 1000,
      });
    }
  }
  return {
    dryRun,
    totalLocations: locations.length,
    successLocations: results.filter((r) => r.success).length,
    failedLocations: results.filter((r) => !r.success).length,
    totalDurationSeconds: (Date.now() - startedAt) / 1000,
    branches: results,
  };
}

//INCREMENTAL

const FALLBACK_CHECKPOINT = config.sheetProduct.incrementalStartAt;

async function variantIncremental({ location, dryRun = true }) {
  const startedAt = Date.now();
  const locationId = String(location.id);
  const locationName = String(location.name);

  const syncStartedAt = new Date().toISOString();

  const state = await variantSyncState.getState(locationId);

  const checkpoint = state?.lastSuccessfulSync ?? FALLBACK_CHECKPOINT;

  if (!checkpoint) {
    throw new Error(
      `[Variant Sync] missing initial checkpoint for ${locationName}`,
    );
  }
  const modifiedOnMin = getModifiedOnMinProduct(checkpoint);

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
    variants:variantsModified
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
  uniqueIds: new Set(
    mapped.rows.map((row) => String(row[0]))
  ).size,
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
  const allLocations = await locationFS.getAll();
  const filterIds = locationIds ? new Set(locationIds.map(String)) : null;

  const locations = filterIds
    ? allLocations.filter((location) => filterIds.has(String(location.id)))
    : allLocations;
  if (!locations.length) {
    throw new Error("[Variant Sync] No location found");
  }
  const results = [];
  for (const location of locations) {
    try {
      const result = await variantIncremental({
        location,
        dryRun,
      });
      results.push({
        ...result,
        success: true,
      });
    } catch (error) {
      console.error("[Variant Sync] Failed", {
        locationId: location.id,
        locationName: location.name,
        message: error.message,
      });

      results.push({
        locationId: String(location.id),
        locationName: location.name,
        success: false,
        error: error.message,
      });
    }
  }
  return {
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
  testProductMapping,
  syncAllBranches,
  buildInventoryMappings,
  variantIncremental,
  allVariantIncremental
};

module.exports = productSync;

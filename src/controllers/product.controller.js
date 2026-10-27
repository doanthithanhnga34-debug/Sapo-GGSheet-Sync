const { setupProductSheetFormat } = require("../services/sheet/sheet-format");
const { acquireSyncLock, releaseSyncLock } = require("../services/syncState/syncLock.service");
const { syncCostPrice } = require("../sync/product/costPrice/costPrice.sync");
const { reconcileAllLocations } = require("../sync/product/product.reconcile");
const productSync = require("../sync/product/product.sync");

async function buildLocations(req, res) {
  const result = await productSync.buildLocations();
  return res.json(result);
}
async function buildVariants(req, res) {
  const result = await productSync.buildVariantAllBranch();
  return res.json(result);
}
async function buildProducts(req, res) {
  const result = await productSync.buildInventoryMappings();
  return res.json(result);
}

async function incremental(req, res) {
  const token = await acquireSyncLock("incremental");
  if (!token) {
    return res.status(409).json({
      success: false,
      skipped: true,
      reason: "Another product sync is running",
    });
  }
  try {
    const result = await productSync.allVariantIncremental({ dryRun: false });
    return res.json(result);
  } finally {
    await releaseSyncLock(token);
  }
}
async function syncOneBranch(req, res) {
  const result = await productSync.syncOneBranch({
    locationId: "924281",
    locationName: "Lê Đình Cẩn",
    dryRun: false,
  });
  return res.json(result);
}
async function syncAll(req, res) {
  const dryRun = req.body?.dryRun !== false;

  const result = await productSync.syncAllBranches({
    dryRun: false,
  });

  res.json(result);
}
async function syncCost(req, res) {
  const token = await acquireSyncLock("cost_price");
  if (!token) {
    return res.status(409).json({
      success: false,
      skipped: true,
      reason: "Another product sync is running",
    });
  }
  try {
    const result = await syncCostPrice({ dryRun: false });
    res.status(200).json(result);
  } catch (error) {
    console.error("[Cost Price Controller]", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  } finally {
    await releaseSyncLock(token);
  }
}

async function reconcileProduct(req, res) {
  const result = await reconcileAllLocations();
  return res.json(result);
}

async function buildMappingInventoryLevel(req, res) {
  const result = await productSync.buildInventoryMappings();
  return res.json(result);
}
async function formatSheet(req, res) {
  try {
    const result = await setupProductSheetFormat({
      dryRun: false,
    });
    return res.status(200).json({
      success: result.totalTabsMissing === 0,
      dryRun: result.dryRun,
      totalLocations: result.totalLocations,
      totalTabsFound: result.totalTabsFound,
      totalTabsMissing: result.totalTabsMissing,
      formattedTabs: result.formattedTabs,
      branches: result.branches,
    });
  } catch (e) {
    console.error("[Sheet Format] Failed:", error.message);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}
const productController = {
  buildLocations,
  buildVariants,
  incremental,
  syncAll,
  buildProducts,
  syncCost,
  reconcileProduct,
  buildMappingInventoryLevel,
  syncOneBranch,
  formatSheet,
};

module.exports = productController;

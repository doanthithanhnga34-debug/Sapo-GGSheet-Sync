const { syncCostPrice } = require("../sync/product/costPrice/costPrice.sync");
const { reconcileDeletedVariants, reconcileAllLocations } = require("../sync/product/product.reconcile");
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
async function test(req, res) {
  const result = await productSync.allVariantIncremental({ dryRun: false });
  return res.json(result);
}
async function testOneBranch(req,res){
  const result = await productSync.testProductMapping();
  return res.json(result)
}
async function syncOneBranch(req, res){
  const result = await productSync.syncOneBranch({
    locationId:'924281',
    locationName:"Lê Đình Cẩn",
    dryRun:false
  })
}
async function syncAll(req, res) {
  const dryRun = req.body?.dryRun !== false;

  const result = await productSync.syncAllBranches({
    dryRun,
  });

  res.json(result);
}

async function syncCost(req, res) {
  try {
    const result = await syncCostPrice({ dryRun: false });
    res.status(200).json(result);
  } catch (error) {
    console.error("[Cost Price Controller]", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

async function reconcileProduct(req, res){
const result = await reconcileAllLocations();
return res.json(result)
}

async function buildMappingInventoryLevel(req, res){
const result = await productSync.buildInventoryMappings();
return res.json(result)
}
const productController = {
  buildLocations,
  buildVariants,
  test,
  syncAll,
  buildProducts,
  syncCost,
  testOneBranch,
  reconcileProduct,
  buildMappingInventoryLevel,
  syncOneBranch
};

module.exports = productController;

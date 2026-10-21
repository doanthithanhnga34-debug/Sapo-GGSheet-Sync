const productSync = require("../sync/product/product.sync");



async function buildLocations(req,res){
    const result = await productSync.buildLocations();
    return res.json(result)
}

async function buildVariants(req,res){
    const result = await productSync.buildVariantAllBranch();
    return res.json(result)
}
async function test(req,res){
    const result = await productSync.testProductMapping();
    return res.json(result)
}
async function syncAll(req, res) {
  const dryRun = req.body?.dryRun !== false;

  const result = await productSync.syncAllBranches({
    dryRun,
  });

  res.json(result);
}

const productController = {
buildLocations,
buildVariants,
test,
syncAll
}

module.exports = productController
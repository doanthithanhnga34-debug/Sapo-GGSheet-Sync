const productSync = require("../sync/product/product.sync");



async function buildLocations(req,res){
    const result = await productSync.buildLocations();
    return res.json(result)
}

async function buildVariants(req,res){
    const result = await productSync.buildTestVariantAllBranch();
    return res.json(result)
}
async function test(req,res){
    const result = await productSync.testProductMapping();
    return res.json(result)
}

const productController = {
buildLocations,
buildVariants,
test
}

module.exports = productController
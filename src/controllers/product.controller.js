const productSync = require("../sync/product/product.sync");



async function buildLocations(req,res){
    const result = await productSync.buildLocations();
    return res.json(result)
}

const productController = {
buildLocations
}

module.exports = productController
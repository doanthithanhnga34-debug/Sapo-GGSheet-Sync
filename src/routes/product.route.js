const express = require("express");
const asyncHandler = require("../middlewares/asyncHandler");
const productController = require("../controllers/product.controller");
const productRouter = express.Router();

productRouter.get("/locations", asyncHandler(productController.buildLocations));
productRouter.get("/testVar", asyncHandler(productController.buildVariants));
productRouter.get("/testProd", asyncHandler(productController.buildProducts));
productRouter.get("/incremental", asyncHandler(productController.incremental));
productRouter.get("/syncCostPrice", asyncHandler(productController.syncCost));
productRouter.get(
  "/reconcile",
  asyncHandler(productController.reconcileProduct),
);
productRouter.get('/mapping', asyncHandler(productController.buildMappingInventoryLevel))
productRouter.get('/syncAll', asyncHandler(productController.syncAll))
productRouter.get('/syncOneBranch', asyncHandler(productController.syncOneBranch))
productRouter.get('/format', asyncHandler(productController.formatSheet))

module.exports = productRouter;

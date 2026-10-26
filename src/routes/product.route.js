const express = require("express");
const asyncHandler = require("../middlewares/asyncHandler");
const productController = require("../controllers/product.controller");
const productRouter = express.Router();

productRouter.get("/locations", asyncHandler(productController.buildLocations));
productRouter.get("/testVar", asyncHandler(productController.buildVariants));
productRouter.get("/testProd", asyncHandler(productController.buildProducts));
productRouter.get("/test", asyncHandler(productController.test));
productRouter.get(
  "/testOneBranch",
  asyncHandler(productController.testOneBranch),
);
productRouter.get("/syncCostPrice", asyncHandler(productController.syncCost));
productRouter.get(
  "/reconcile",
  asyncHandler(productController.reconcileProduct),
);
productRouter.get('/mapping', asyncHandler(productController.buildMappingInventoryLevel))
productRouter.get('/syncAll', asyncHandler(productController.syncAll))
productRouter.get('/syncOneBranch', asyncHandler(productController.syncOneBranch))

module.exports = productRouter;

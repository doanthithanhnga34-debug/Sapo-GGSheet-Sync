const express = require("express");
const asyncHandler = require("../middlewares/asyncHandler");
const productController = require("../controllers/product.controller");
const productRouter = express.Router();

productRouter.get("/locations", asyncHandler(productController.buildLocations));
productRouter.get("/testVar", asyncHandler(productController.buildVariants));
productRouter.get("/test", asyncHandler(productController.test));

module.exports = productRouter;


const express = require("express");
const asyncHandler = require("../middlewares/asyncHandler");
const orderController = require("../controllers/order.controller");
const orderRouter = express.Router();


orderRouter.post('/syncBatchOrder', asyncHandler(orderController.syncOrderBatch));
orderRouter.post('/incremental', asyncHandler(orderController.incremental))

module.exports = orderRouter;
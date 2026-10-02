const express = require("express");
const asyncHandler = require("../middlewares/asyncHandler");
const customerController = require("../controllers/customer.controller");
const customerRouter = express.Router();



customerRouter.post('/incremental', asyncHandler(customerController.incremental));
customerRouter.post('/reconcileDeleteRows', asyncHandler(customerController.reconcileDeleteRows))

module.exports = customerRouter;

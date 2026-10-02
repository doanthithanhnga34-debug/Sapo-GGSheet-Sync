const express = require("express");

const cashFundController = require("../controllers/cashFund.controller");
const asyncHandler = require("../middlewares/asyncHandler");
const cashFundRouter = express.Router();

cashFundRouter.post(
  "/getCashFunds",
  asyncHandler(cashFundController.getCashFunds),
);
cashFundRouter.post(
  "/cashFundBatchSync",
  asyncHandler(cashFundController.batchSync),
);
cashFundRouter.post(
  "/incremental",
  asyncHandler(cashFundController.incremental),
);
cashFundRouter.post('/reconcileDeleteRows', asyncHandler(cashFundController.reconcile))

module.exports = cashFundRouter;

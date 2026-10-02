const express = require("express");

const {
  buildCashFund,
  buildBatchCashFund,
  incrementalCashFundSync,
} = require("../sync/cashFund/buildCashFund.sync");
const { reconcileDeletedCashFund } = require("../sync/deleteRows/deleteRowsCashFund");
const cashFundRouter = express.Router();

cashFundRouter.post("/getCashFunds", async (req, res) => {
  try {
    const result = await buildCashFund();
    return res.status(200).json({
      result,
    });
  } catch (e) {
    return res.status(500).json({
      success: false,
      message: e.message,
    });
  }
});

cashFundRouter.post("/cashFundBatchSync", async (req, res) => {
  try {
    const result = await buildBatchCashFund();
    return res.json({ result });
  } catch (e) {
    return res.status(500).json({
      success: false,
      message: e.message,
    });
  }
});

cashFundRouter.post('/incremental', async (req, res) =>{
  try{
    const incrementalResult = await incrementalCashFundSync();

    const reconcileDeletedResult = await reconcileDeletedCashFund();
    return res.json({
      success:true,
      incrementalResult : incrementalResult,
      reconcileDeletedResult: reconcileDeletedResult
    });

  }catch(e){
    return res.status(500).json({
      success:false,
      message:e.message
    })
  }
})

module.exports = cashFundRouter;

const cashFundReconcileSync = require("../sync/cashFund/cashFund.reconcile");
const cashFundSync = require("../sync/cashFund/cashFund.sync");

async function incremental(req, res) {
  const incrementalResult = await cashFundSync.incremental();
  return res.json({
    incrementalResult: incrementalResult,
  });
}
async function batchSync(req, res) {
  const result = await cashFundSync.buildBatchCashFund();
  return res.json({ result });
}

async function getCashFunds(req, res) {
  const result = await cashFundSync.buildCashFund();
  return res.json({ result });
}

async function reconcile(req, res) {
  const result = await cashFundReconcileSync.reconcileDeletedCashFund();
  return res.json({ result });
}

const cashFundController = {
  incremental,
  batchSync,
  getCashFunds,
  reconcile
};
module.exports = cashFundController;

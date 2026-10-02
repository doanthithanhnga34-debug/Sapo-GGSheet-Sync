const config = require("../../config/config");
const { sleep } = require("../../utils/retry");
const { sapoGet } = require("../customers/customer.service");

async function getCashFunds({ 
  page = 1, 
  limit = config.sapo.cashFundLimit,
  voucherDateMin ="",
  voucherDateMax =""
 }) {

  const params = new URLSearchParams();
  params.set("journal_type", "cash_journal");
  params.set("voucher_date_min", voucherDateMin);
  params.set("voucher_date_max", voucherDateMax);
  params.set("origin_currency", "VND");
  params.set("page", String(page));
  params.set("limit", String(limit));
  params.set("sort_by", "voucher_date_desc");

  const data = await sapoGet(
    `/admin/accounting/vouchers.json?${params.toString()}`,
  );

  
  await sleep(config.sync.requestDelay);

  return Array.isArray(data?.vouchers)
    ? data.vouchers
    : [];
}

async function getCashFund(voucherId){
  const id = String(voucherId ?? "").trim();
  const data = await sapoGet(`/admin/accounting/vouchers/${id}.json`);
  const cashFund = data?.voucher;
  return cashFund;
}

module.exports = {
  getCashFund,
  getCashFunds,
};

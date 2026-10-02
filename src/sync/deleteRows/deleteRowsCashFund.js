const config = require("../../config/config");
const {
  getCashFunds,
  getCashFund,
} = require("../../sapo/castFund/cashFund.service");
const { deleteRowsBatch } = require("../../sheet/sheet.service");
const { buildCashFundIdSet } = require("../cashFund/buildCashFund.sync");

async function getAllCashFundIds() {
  const limit = config.sapo.limit;
  const ids = new Set();
  let page = 1;
  while (true) {
    const cashFunds = await getCashFunds({ page, limit });
    console.log(
      `Delete check page cash fund: page=${page}, count=${cashFunds.length}`,
    );

    if (!cashFunds.length) {
      break;
    }
    for (const cashFund of cashFunds) {
      const id = String(cashFund.id ?? "").trim();
      if (id) {
        ids.add(id);
      }
    }
    if (cashFunds.length < limit) {
      break;
    }
    page++;
  }
  return ids;
}

async function cashFundExistOnSapo(cashFundId) {
  try {
    const cashFund = await getCashFund(cashFundId);
    return !!cashFund;
  } catch (e) {
    if (e.status === 404) {
      return false;
    }
    throw e;
  }
}

async function reconcileDeletedCashFund(){
    const cashFundIndex = await buildCashFundIdSet();
    const sapoCashFundIds = await getAllCashFundIds();
    const candidates=[];

    for(const [id,data] of cashFundIndex.entries()){
        if(!sapoCashFundIds.has(id)){
            candidates.push({
                id,
                data:data.row
            })
        }
    }

    if(!candidates.length){
        return {
            success:true,
            sheetCashFunds: cashFundIndex.size,
            sapoCashFunds:sapoCashFundIds.size,
            candidates:candidates.length,
            deleted:0
        }
    }

    const rowsToDeletes =[];

    for(const candidate of candidates){
        const existing = await cashFundExistOnSapo(candidate.id);
        if(!existing){
            rowsToDeletes.push(candidate.row);
        }else{
            console.log(`keep id = ${candidate.id} still exist on Sapo`);
        }

    }

    if(rowsToDeletes.length > 0){
    await deleteRowsBatch(rowsToDeletes,config.ggSheetCashFund.cashFundSheetName,config.ggSheetCashFund.sheetID);

    }
    return {
        success:true,
        sheetCashFunds:cashFundIndex.size,
        sapoCashFunds: sapoCashFundIds.size,
        candidates:candidates.length,
        deleted:rowsToDeletes.length
    }
}

module.exports = {
    reconcileDeletedCashFund
}

const config = require("../config/config");
const { ensureCustomerIndex } = require("../sheet/customerIndex.service");
const { saveCustomerSyncState } = require("../sheet/customerSyncState.service");
const { ensureSheetSize, getValues, updateValues, clearRange } = require("../sheet/sheet.service");
const { makeCustomerHash, HEADERS } = require("./customers/customer.mapper");


async function bootstrapCustomerIndex() {
  const customerSheet = config.ggSheetCustomer.customerSheetName;
  await ensureCustomerIndex();
  await ensureSheetSize(customerSheet, 500001, 17, config.ggSheetCustomer.sheetID);

  const values = await getValues(`'${customerSheet}'!A2:P`, config.ggSheetCustomer.sheetID);

  const indexRows = [];
  const hashColumn = [];
  const seen = new Set();
  let maxModifiedOn = "";
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rowNumber = i + 2;
    const customerId = String(row[0] ?? "").trim();

    if (!customerId) {
      hashColumn.push([""]);
      continue;
    }
    if (seen.has(customerId)) {
      throw new Error(`Duplicate customer ID : ${customerId}`);
    }
    seen.add(customerId);

    const baseRow = Array.from({ length: 16 }, (_, index) => row[index] ?? "");
    const hash = makeCustomerHash(baseRow);
    hashColumn.push([hash]);
    const modifiedOn = String(baseRow[14] ?? "").trim();

    indexRows.push([
        customerId,
        rowNumber,
        modifiedOn,
        hash,
        "ACTIVE"
    ])
    if(modifiedOn){
        const current = Date.parse(modifiedOn);
        const old = maxModifiedOn ? Date.parse(maxModifiedOn):0;

        if(Number.isFinite(current) && current >old){
            maxModifiedOn = modifiedOn
        }
    }
  }

  await updateValues(`'${customerSheet}'!A1:Q1`,
    [[
        ...HEADERS
    ]], config.ggSheetCustomer.sheetID
  )
  if(hashColumn.length){
    await updateValues(
        `'${customerSheet}'!Q2:Q${hashColumn.length+1}`, hashColumn, config.ggSheetCustomer.sheetID
    )
  }
  await clearRange(`'${INDEX_SHEET}'!A2:E`);
  if(indexRows.length){
    await updateValues(
        `'${INDEX_SHEET}'!A2:E${indexRows.length+1}`, indexRows, config.ggSheetCustomer.sheetID
    )
  }
  await saveCustomerSyncState({
    lastModifiedOn:maxModifiedOn,
    status:"idle"
  })
  return {
    success:true,
    customers:indexRows.length,
    lastModifiedOn:maxModifiedOn
  }
}

module.exports = {
    bootstrapCustomerIndex
}

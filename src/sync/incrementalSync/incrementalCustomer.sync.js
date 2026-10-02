const config = require("../../config/config");
const {
  getAllCustomers,
  getCustomers,
} = require("../../sapo/customers/customer.service");
const { loadCustomerIndex } = require("../../sheet/customerIndex.service");
const {
  getCustomerSyncState,
  saveCustomerSyncState,
} = require("../../sheet/customerSyncState.service");
const { batchUpdateValues, appendValue } = require("../../sheet/sheet.service");
const {
  subtractMinutes,
  getLatestModifiedOn,
} = require("../../utils/formatDate");
const { columnNumberToLetter } = require("../../utils/sheet.helper");
const { buildCustomerIdIndex } = require("../customers/buildCustomer.sync");
const { HEADERS, customerToRow } = require("../customers/customer.mapper");
const {
  uniqueCustomers,
  mapChangedCustomers,
  writeUpdates,
  writeAdds,
} = require("../customers/customer.sync");

async function incrementalCustomerSync() {
  const limit = config.sapo.customerLimit;
  const sheetName = config.ggSheetCustomer.customerSheetName;
  const spreadsheetId = config.ggSheetCustomer.sheetID;
  const state = await getCustomerSyncState();
  const runStartedAt = new Date().toISOString();

  const checkpoint =
    state.lastModifiedOn ||
    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const modifiedFrom = new Date(
    new Date(checkpoint).getTime() - 60 * 60 * 1000,
  ).toISOString();
  console.log(`incremental from = ${modifiedFrom}`);
  const { index: customerIndex } = await buildCustomerIdIndex();
  const pendingNew = new Map();
  const updateData = [];
  const lastColumn = columnNumberToLetter(HEADERS.length);
  const hashIndex = HEADERS.indexOf("Sync_hash");

  let page = 1;
  let totalSapo = 0;
  let totalAdd = 0;
  let totalUpdate = 0;
  let totalSkip = 0;

  while (true) {
    const customers = await getCustomers({
      page,
      limit,
      modifiedFrom,
      sortKey: "modified_on",
    });

    console.log(`incremental page =${page}, count=${customers.length}`);
    if (!customers.length) {
      break;
    }
    totalSapo += customers.length;

    for (const customer of customers) {
      const id = String(customer.id ?? "").trim();

      if (!id) {
        continue;
      }
      const row = await customerToRow(customer);
      const newHash = String(row[hashIndex] ?? "").trim();
      const existing = customerIndex.get(id);

      if (!existing) {
        pendingNew.set(id, row);
        continue;
      }
      if (existing.hash === newHash) {
        totalSkip++;
        continue;
      }
      updateData.push({
        range: `'${sheetName}'!A${existing.row}:${lastColumn}${existing.row}`,
        values: [row],
      });
      customerIndex.set(id, {
        row: existing.row,
        hash: newHash,
      });
      totalUpdate++;
    }
    if (customers.length < limit) {
      break;
    }
    page++;
  }

  if (updateData.length > 0) {
    await batchUpdateValues(updateData, spreadsheetId);
  }

  const newRows = [...pendingNew.values()];
  if (newRows.length > 0) {
    await appendValue(`'${sheetName}'!A:${lastColumn}`, newRows, spreadsheetId);
    totalAdd = newRows.length;
  }

  await saveCustomerSyncState({
    lastModifiedOn: runStartedAt,
    status: "idle",
  });
  console.log(
    `[INCREMENTAL DONE] ` +
      `sapo=${totalSapo}, ` +
      `add=${totalAdd}, ` +
      `update=${totalUpdate}, ` +
      `skip=${totalSkip}`,
  );

  return {
    success: true,
    modifiedFrom,
    checkpoint: runStartedAt,
    sapo: totalSapo,
    added: totalAdd,
    updated: totalUpdate,
    skipped: totalSkip,
  };
}
module.exports = {
  incrementalCustomerSync,
};

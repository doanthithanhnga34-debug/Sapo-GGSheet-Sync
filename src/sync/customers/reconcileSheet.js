const config = require("../../config/config");
const {
  getAllCustomer,
  getCustomers,
  getCustomer,
} = require("../../sapo/customers/customer.service");
const {
  saveCustomerSyncState,
  getCustomerSyncState,
} = require("../../sheet/customerSyncState.service");
const {
  clearRange,
  updateValues,
  appendValue,
  deleteSheetRow,
  getSheetsClient,
} = require("../../sheet/sheet.service");
const { columnNumberToLetter } = require("../../utils/sheet.helper");
const { buildCustomerIdIndex } = require("./buildCustomer.sync");
const { customerToRow, HEADERS } = require("./customer.mapper");

async function reconcileCustomers() {
  console.log("[CUSTOMER ] reconcile start");

  const sapoCustomers = await getAllCustomers();
  const sapoMap = new Map();
  for (const customer of sapoCustomers) {
    sapoMap.set(String(customer.id), customer);
  }
  const rows = [...sapoMap.values()]
    .sort((a, b) => {
      Number(a.id) - Number(b.id);
    })
    .map(customerToRow);
  const sheetName = config.ggSheetCustomer.customerSheetName;
  await clearRange(`'${sheetName}'!A2:L`);
  const batchSize = 5000;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await updateValues(
      `'${sheetName}'!A${i + 2}:L${i + batch.length + 1}`,
      batch,
      config.ggSheetCustomer.sheetID,
    );
  }

  console.log(`customer reconciliation done customers =${rows.length}`);

  return {
    success: true,
    customers: rows.length,
  };
}
async function reconcileOldCustomerPage(page) {
  const limit = config.sapo.customerLimit;

  const { index, duplicates } = await buildCustomerIdIndex();

  console.log(`Existing unique customers = ${index.size}`);

  console.log(`Duplicate IDs = ${duplicates.length}`);


  const customers = await getCustomers({
    page,
    limit,
    sortKey:"id"
  });

  if (!customers.length) {
    return {
      success: true,
      page,
      done: true,
    };
  }

  const missingCustomers = [];

  for (const customer of customers) {
    const id = String(customer.id ?? "").trim();

    if (!id) continue;

    if (index.has(id)) {
      continue;
    }

    missingCustomers.push(customer);
  }
  console.log("missing data page:", missingCustomers)

  console.log(
    `page=${page}, sapo=${customers.length}, missing=${missingCustomers.length}`,
  );

  if (!missingCustomers.length) {
    return {
      success: true,
      page,
      scanned: customers.length,
      added: 0,
    };
  }

  const rows = [];

  for (const customer of missingCustomers) {

    const row = await customerToRow(customer);

    rows.push(row);
    console.log('row push to sheet',row)
  }
  const sheetName = config.ggSheetCustomer.customerSheetName;

  const spreadsheetId = config.ggSheetCustomer.sheetID;

  const lastColumn = columnNumberToLetter(HEADERS.length);

  await appendValue(`'${sheetName}'!A:${lastColumn}`, rows, spreadsheetId);

  return {
    success: true,
    page,
    scanned: customers.length,
    added: rows.length,
  };
}
async function reconcileOldCustomersBatch() {
  const state = await getCustomerSyncState();

  const page = Number(state.reconcilePage) || 1;

  if (page > 390) {
    await saveCustomerSyncState({
      reconcileStatus: "done",
    });

    return {
      success: true,
      done: true,
      message: "Reconcile pages 1-390 completed",
    };
  }

  const result = await reconcileOldCustomerPage(page);

  await saveCustomerSyncState({
    reconcilePage: page + 1,
    reconcileStatus: page >= 390 ? "done" : "running",
  });

  return {
    ...result,
    nextReconcilePage: page + 1,
  };
}

async function deleteDuplicateCustomerRows(){
  const {
    duplicates
  } = await buildCustomerIdIndex();
  if(!duplicates){
    console.log("No duplicate customers");
    return {
      success:true,
      delete:0
    }
  }
  console.log(`Duplicate rows to delete = ${duplicates.length}`);


  const rowsToDelete = duplicates.map(item => item.duplicateRow).sort((a,b) =>b-a);
  console.log("Rows to delete", rowsToDelete);

  for(const row of rowsToDelete){
    await deleteSheetRow(config.ggSheetCustomer.customerSheetName, row, config.ggSheetCustomer.sheetID);
    console.log(`Delete duplicate row ${row}`)
  }
  return {
    success:true,
    deleted:rowsToDelete.length
  }
}

async function deleteDuplicateRowsBatch(duplicates,sheetName,spreadsheetId){
  if(!duplicates.length){
    return 0;
  }
  const sheets = await getSheetsClient();

  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId
  })
  const sheet = spreadsheet.data.sheets.find(item => item.properties.title === sheetName);
  if(!sheet){
    throw new Error(`Sheet not found :${sheetName}`);
  }
  const sheetId = sheet.properties.sheetId;

  const rowsToDelete = duplicates.map(item => item.duplicateRow).sort((a,b)=> b-a);
  const requests =
    rowsToDelete.map(rowNumber => ({
      deleteDimension: {
        range: {
          sheetId,
          dimension: "ROWS",
          startIndex: rowNumber - 1,
          endIndex: rowNumber,
        },
      },
    }));

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody:{
        requests
      }
    })

    console.log(`Delete ${rowsToDelete.length} duplicate rows`);

    return rowsToDelete.length
}
module.exports = {
  reconcileCustomers,
  reconcileOldCustomerPage,
  reconcileOldCustomersBatch,
  deleteDuplicateCustomerRows,
  deleteDuplicateRowsBatch
};

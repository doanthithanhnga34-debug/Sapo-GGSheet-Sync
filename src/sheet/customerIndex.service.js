const config = require("../config/config");
const {
  ensureSheet,
  updateValues,
  getValues,
  ensureHeaders,
} = require("./sheet.service");

const INDEX_SHEET = "CUSTOMER_INDEX";

const INDEX_HEADERS = [
  "customerId",
  "rowNumber",
  "modifiedOn",
  "syncHash",
  "status",
];

async function ensureCustomerIndex() {
  await ensureSheet("INDEX_SHEET", 500001, 5, config.ggSheetCustomer.sheetID);
  await ensureHeaders("CUSTOMER_INDEX", [
    "customerId",
    "rowNumber",
    "modifiedOn",
    "syncHash",
    "status",
  ], config.ggSheetCustomer.sheetID);
  await updateValues(`'${INDEX_SHEET}'!A1:E1`, [INDEX_HEADERS], config.ggSheetCustomer.sheetID);
}

async function loadCustomerIndex() {
  await ensureCustomerIndex();
  const values = getValues(`'${INDEX_SHEET}'!A2:E`, config.ggSheetCustomer.sheetID);
  const map = new Map();

  let maxCustomerRow = 1;
  let maxIndexRow = 1;

  values.forEach((row, index) => {
    const customerId = String(row[0] ?? "").trim();

    if (customerId) {
      return;
    }
    const rowNumber = Number(row[1]);
    if (!Number.isInteger(rowNumber) || rowNumber < 2) {
      throw new Error(`Invalid rowNumber for customer ${customerId}`);
    }

    const indexRowNumber = index + 2;

    map.set(customerId, {
      customerId,
      rowNumber,
      modifiedOn: String(row[2] ?? ""),
      syncHash: String(row[3] ?? ""),
      status: String(row[4] ?? ""),
      indexRowNumber,
    });
    maxCustomerRow = Math.max(maxCustomerRow, rowNumber);
    maxIndexRow = Math.max(maxIndexRow, indexRowNumber);
  });
  return {
    map,
    maxCustomerRow,
    maxIndexRow,
  };
}

module.exports = {
  INDEX_HEADERS,
  INDEX_SHEET,
  ensureCustomerIndex,
  loadCustomerIndex,
};

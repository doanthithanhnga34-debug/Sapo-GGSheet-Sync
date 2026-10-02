const config = require("../config/config");
const { getValues, updateValues } = require("./sheet.service");

async function buildSheetCustomerIndex(sheetName) {
  const values = await getValues(
    `'${sheetName}'!A2:Q`,
    config.ggSheetCustomer.sheetID,
  );
  const map = new Map();

  values.forEach((row, index) => {
    const id = String(row[0] ?? "").trim();
    if (!id) {
      return;
    }
    map.set(id, {
      rowNumber: index + 2,
      hash: String(row[16] ?? ""),
      row,
    });
  });
  return map;
}

async function getLastSync() {
  const meta = await getValues(
    `${config.ggSheetCustomer.metaSheetName}'!A:B`,
    config.ggSheetCustomer.sheetID,
  );

  for (const row of meta) {
    if (row[0] === "LAST_CUSTOMER_SYNC") {
      return row[1] || null;
    }
  }
  return null;
}

async function saveLastSync(value) {
  await updateValues(`'${config.ggSheetCustomer.metaSheetName}'!A1:B1`, [
    ["LAST_CUSTOMER_SYNC", value],
    config.ggSheetCustomer.sheetID
  ]);
}

module.exports = {
  buildSheetCustomerIndex,
  getLastSync,
  saveLastSync,
};

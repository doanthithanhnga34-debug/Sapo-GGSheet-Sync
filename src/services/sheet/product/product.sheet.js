const productMapper = require("../../../sync/product/product.mapper");
const { chunk } = require("../../../utils/chunk");
const { columnNumberToLetter } = require("../../../utils/sheet.helper");
const sheetServices = require("../sheet.service");

const INSERT_BATCH_SIZE = 250;
const UPDATE_BATCH_SIZE = 300;

function quoteSheetName(name) {
  return `'${String(name).replace(/'/g, "''")}'`;
}

async function writeProductDiff({
  spreadsheetId,
  sheetName,
  diff,
  dryRun = true,
}) {
  const startedAt = Date.now();

  if (dryRun) {
    return {
      dryRun: true,
      inserted: diff.inserts.length,
      updated: diff.updates.length,
      skipped: diff.skipped,
      durationSeconds: 0,
    };
  }

  const headers = productMapper.HEADERS;
  const lastColumn = columnNumberToLetter(headers.length);
  const quotedSheetName = quoteSheetName(sheetName);

  await sheetServices.ensureSheet(sheetName,1000,headers.length,spreadsheetId);

  await sheetServices.ensureHeaders(sheetName,headers,spreadsheetId)
  await sheetServices.ensureSheetSize(sheetName,1000,headers.length,spreadsheetId);

  let updated =0;
  let inserted = 0;

  const updateData =[];
  for(const item of diff.updates){
    for(const change of item.changes){
      const column = columnNumberToLetter(change.columnIndex +1);
      updateData.push({
        range:`${quotedSheetName}!${column}${item.rowNo}`,
         values: [[change.newValue]],
      })
    }
  }

  const updateBatches = chunk(updateData,UPDATE_BATCH_SIZE);
  for(const batch of updateBatches){
    await sheetServices.batchUpdateValues(batch,spreadsheetId)
  }
  updated = diff.updates.length;

  const insertBatches = chunk(diff.inserts, INSERT_BATCH_SIZE);

  for(const batch of insertBatches){
    await sheetServices.insertRowsAtTop(sheetName, batch, spreadsheetId);
     inserted += batch.length;
  }
  return {
    dryRun: false,
    sheetName,
    inserted,
    updated,
    skipped: diff.skipped,
    updateCells: updateData.length,
    insertBatches: insertBatches.length,
    updateBatches: updateBatches.length,
    durationSeconds:
      (Date.now() - startedAt) / 1000,
  };

}

module.exports = {
  writeProductDiff
};

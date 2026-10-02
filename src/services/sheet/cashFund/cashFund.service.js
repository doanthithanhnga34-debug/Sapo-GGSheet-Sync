const { request } = require("express");
const { getSheetsClient } = require("../sheet.service");
const { columnNumberToLetter } = require("../../../utils/sheet.helper");



async function formatDateTimeColumn(sheetName, columnIndex, spreadsheetId) {
  const sheets = await getSheetsClient();
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: spreadsheetId,
    fields: "sheets(properties(sheetId,title))",
  });

  const sheet = spreadsheet.data.sheets.find(
    (item) => item.properties.title === sheetName,
  );

  if (!sheet) {
    throw new Error(`Can not find sheet ${sheetName}`);
  }
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: {
              sheetId: sheet.properties.sheetId,
              startRowIndex: 1,
              startColumnIndex: columnIndex,
              endColumnIndex: columnIndex + 1,
            },
            cell: {
              userEnteredFormat: {
                numberFormat: {
                  type: "DATE_TIME",
                  pattern: "dd/MM/yyyy HH:mm:ss",
                },
              },
            },
            fields: "userEnteredFormat.numberFormat",
          },
        },
      ],
    },
  });
}

async function insertRowsAtTop(sheetName, rows, spreadsheetId) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return 0;
  }

  const sheets = await getSheetsClient();

  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title)",
  });
  const targetSheet = spreadsheet.data.sheets.find(
    (item) => item.properties.title === sheetName,
  );

  if (!targetSheet) {
    throw new Error(`Sheet not found: ${sheetName}`);
  }
  const sheetId = targetSheet.properties.sheetId;
  const rowCount = rows.length;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          insertDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: 1,
              endIndex: 1 + rowCount,
            },
            inheritFromBefore: false,
          },
        },
      ],
    },
  });

  const lastColumn = columnNumberToLetter(rows[0].length);
  const escapedSheetName = sheetName.replace(/'/g, "''");

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${escapedSheetName}'!A2:${lastColumn}${rowCount + 1}`,
    valueInputOption: "RAW",
    requestBody: {
      values: rows,
    },
  });

  console.log(`Inserted ${rowCount} rows at top`);
}
module.exports = {
  formatDateTimeColumn,
  insertRowsAtTop
};

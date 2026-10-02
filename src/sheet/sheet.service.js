const { google } = require("googleapis");
const config = require("../config/config");
const path = require("path");
const { columnNumberToLetter } = require("../utils/sheet.helper");

let sheetsClient;
async function getSheetsClient() {
  if (sheetsClient) {
    return sheetsClient;
  }

  const auth = new google.auth.GoogleAuth({
    keyFilename: path.join(
      process.cwd(),
      "src",
      "credentials",
      "google-service-account.json",
    ),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const authClient = await auth.getClient();

  sheetsClient = google.sheets({
    version: "v4",
    auth: authClient,
  });
  return sheetsClient;
}

async function getValues(range, spreadsheetId) {
  const sheets = await getSheetsClient();

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId,
    range,
  });
  return result.data.values || [];
}

async function updateValues(range, values, spreadsheetId) {
  const sheets = await getSheetsClient();

  await sheets.spreadsheets.values.update({
    spreadsheetId: spreadsheetId,
    range,
    valueInputOption: "RAW",
    requestBody: {
      values,
    },
  });
}

async function clearRange(range, spreadsheetId) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.clear({
    spreadsheetId: spreadsheetId,
    range,
  });
}

async function appendValue(range, values, spreadsheetId) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: spreadsheetId,
    range,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values,
    },
  });
}

async function deleteSheetRow(sheetName, rowNumber, spreadsheetId){
  const sheets = await getSheetsClient();
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId,
  })
  const sheet = spreadsheet.data.sheets.find(item=> item.properties.title === sheetName);
  if(!sheet){
    throw new Error(`Sheet not found :${sheetName}`)
  }

  const sheetId = sheet.properties.sheetId;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody:{
      requests:[
        {
          deleteDimension:{
            range:{
              sheetId,
              dimension:"ROWS",
              startIndex: rowNumber-1,
              endIndex:rowNumber
            }
          }
        }
      ]
    }
  });
  return true;
}
async function batchUpdateValues(data) {
  if (!data.length) {
    return;
  }
  const sheets = await getSheetsClient();

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: config.ggSheetCustomer.sheetID,
    requestBody: {
      valueInputOption: "RAW",
      data,
    },
  });
}

async function deleteRowsBatch(rows, sheetName, spreadsheetId){
  if(!rows.length){
    return 0
  }
  const sheets = await getSheetsClient();
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId
  })

  const sheet = spreadsheet.data.sheets.find(item => item.properties.title === sheetName);
  if(!sheet){
    throw new Error(`Sheet not found :${sheetName}`)
  }
  const sheetId = sheet.properties.sheetId;

  const rowsToDelete = [
    ...new Set(rows.map(Number))
  ].sort((a,b) => b-a);
  console.log(`delete rows ${rowsToDelete}`);
   const requests =
    rowsToDelete.map(
      rowNumber => ({
        deleteDimension: {
          range: {
            sheetId,
            dimension: "ROWS",
            // Sheet row bắt đầu 1
            // API index bắt đầu 0
            startIndex:
              rowNumber - 1,

            endIndex:
              rowNumber,
          },
        },
      })
    );
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody:{
        requests
      }
    });
    return rowsToDelete.length
}

async function ensureSheetSize(sheetName, requiredRows, requiredColumns = 16, spreadsheetId) {
  const sheets = await getSheetsClient();

  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: spreadsheetId,
    fields: "sheets.properties",
  });

  const sheet = spreadsheet.data.sheets.find(
    (item) => item.properties.title === sheetName,
  );

  if (!sheet) {
    throw new Error(`Can not find the sheet ${sheetName}`);
  }

  const currentRows = sheet.properties.gridProperties.rowCount;

  const currentColumns = sheet.properties.gridProperties.columnCount;

  const requests = [];

  if (requiredRows > currentRows) {
    requests.push({
      appendDimension: {
        sheetId: sheet.properties.sheetId,
        dimension: "ROWS",
        length: requiredRows - currentRows,
      },
    });
  }
  if (requiredColumns > currentColumns) {
    requests.push({
      appendDimension: {
        sheetId: sheet.properties.sheetId,
        dimension: "COLUMNS",
        length: requiredColumns - currentColumns,
      },
    });
  }
  if (!requests.length) {
    return;
  }
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: spreadsheetId,
    requestBody: {
      requests,
    },
  });
}

async function ensureSheet(sheetName, rowCount = 1000, columnCount = 20, spreadsheetId) {
  const sheets = await getSheetsClient();

  const cleanSheetName = String(sheetName ?? "").trim();

  if (!cleanSheetName) {
    throw new Error("sheetName is empty");
  }

  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: spreadsheetId,

    fields: "sheets(properties(sheetId,title,gridProperties))",
  });

  const allSheets = spreadsheet.data.sheets || [];

  const existing = allSheets.find((item) => {
    const title = String(item.properties?.title ?? "").trim();

    return title === cleanSheetName;
  });

  if (existing) {
    return existing.properties;
  }

  console.log(`[Sheet] Creating ${cleanSheetName}`);

  const result = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: spreadsheetId,

    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: cleanSheetName,

              gridProperties: {
                rowCount,
                columnCount,
              },
            },
          },
        },
      ],
    },
  });

  const properties = result.data.replies?.[0]?.addSheet?.properties;

  console.log(`[Sheet] Created ${cleanSheetName}`);

  return properties;
}
async function ensureHeaders(sheetName, headers, spreadsheetId) {
  if (!Array.isArray(headers) || !headers.length) {
    throw new Error(`Headers must not be empty`);
  }
  const lastColumn = columnNumberToLetter(headers.length);
  await updateValues(
    `'${sheetName}'!A1:${lastColumn}1`,
    [headers],
    spreadsheetId,
  );
}
module.exports = {
  getSheetsClient,
  getValues,
  updateValues,
  clearRange,
  appendValue,
  ensureSheetSize,
  ensureSheet,
  ensureHeaders,
  batchUpdateValues,
  deleteSheetRow,
  deleteRowsBatch
};

const { google } = require("googleapis");
const config = require("../../config/config");
const locationFS = require("../firestore/location.firestore");
const { getSheetName } = require("../sapo/product/location.service");
const { getSheetsClient } = require("./sheet.service");



async function setupProductSheetFormat({ dryRun = true } = {}) {
    const sheets = await getSheetsClient();

  const spreadsheetId = config.sheetProduct.id;

  if (!spreadsheetId) {
    throw new Error("[Sheet Format] Missing spreadsheetId");
  }

  const locations = await locationFS.getAll();

  if (!Array.isArray(locations) || locations.length === 0) {
    throw new Error("[Sheet Format] No locations found");
  }

  // Lấy metadata các tab, không lấy dữ liệu các ô
  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(sheetId,title,gridProperties))",
  });

  const sheetByName = new Map(
    (response.data.sheets || []).map((sheet) => [
      sheet.properties.title,
      sheet.properties,
    ])
  );

  const results = [];
  const requests = [];

  for (const location of locations) {
    const locationId = String(location.id);
    const sheetName = getSheetName(locationId, location.name);
    const sheet = sheetByName.get(sheetName);

    if (!sheet) {
      results.push({
        locationId,
        sheetName,
        success: false,
        error: "Tab does not exist",
      });
      continue;
    }

    const sheetId = sheet.sheetId;

    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 1,
          startColumnIndex: 6,
          endColumnIndex: 9,
        },
        cell: {
          userEnteredFormat: {
            numberFormat: {
              type: "NUMBER",
              pattern: "#,##0",
            },
            horizontalAlignment: "LEFT",
          },
        },
        fields:
          "userEnteredFormat.numberFormat,userEnteredFormat.horizontalAlignment",
      },
    });

    results.push({
      locationId,
      sheetName,
      sheetId,
      success: true,
    });
  }


  const failed = results.filter((r) => !r.success);

  if (!dryRun && failed.length > 0) {
    throw new Error(
      `[Sheet Format] Missing tabs: ${failed.map((r) => r.sheetName).join(", ")}`
    );
  }

  if (!dryRun && requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    });
  }

  return {
    dryRun,
    spreadsheetId,
    totalLocations: locations.length,
    totalTabsFound: results.filter((r) => r.success).length,
    totalTabsMissing: failed.length,
    formattedTabs: dryRun ? 0 : requests.length,
    branches: results,
  };
}

module.exports = {
  setupProductSheetFormat,
};
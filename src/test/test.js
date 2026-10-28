await sheets.spreadsheets.batchUpdate({
  spreadsheetId,
  requestBody: {
    requests: [
      {
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 1,
            endRowIndex: 1 + rowCount,
            startColumnIndex: 3, // D - Mã Hàng
            endColumnIndex: 4,
          },
          cell: {
            userEnteredFormat: {
              numberFormat: {
                type: "TEXT",
                pattern: "@",
              },
            },
          },
          fields: "userEnteredFormat.numberFormat",
        },
      },
    ],
  },
});
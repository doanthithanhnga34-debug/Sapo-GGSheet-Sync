async function buildCashFundIdSet() {
  const sheetName =
    config.ggSheetCashFund.cashFundSheetName;

  const spreadsheetId =
    config.ggSheetCashFund.sheetID;

  const idIndex =
    HEADERS_CASH_FUND.indexOf("ID");

  if (idIndex === -1) {
    throw new Error(
      "Not found ID column"
    );
  }

  const idColumn =
    columnNumberToLetter(
      idIndex + 1
    );

  const values =
    await getValues(
      `'${sheetName}'!${idColumn}2:${idColumn}`,
      spreadsheetId
    );

  const ids = new Set();

  for (const row of values || []) {
    const id =
      String(
        row[0] ?? ""
      ).trim();

    if (id) {
      ids.add(id);
    }
  }

  console.log(
    `Existing cash fund IDs=${ids.size}`
  );

  return ids;
}

async function incrementalCashFundSync() {
  const limit =
    config.sapo.cashFundLimit;

  const sheetName =
    config.ggSheetCashFund.cashFundSheetName;

  const spreadsheetId =
    config.ggSheetCashFund.sheetID;

  const state =
    await getCashFundSyncState();

  // khóa max ngay từ lúc bắt đầu
  const runStartedAt =
    new Date().toISOString();

  // Lần đầu incremental:
  // lấy lại 24h để chắc chắn không miss
  const checkpoint =
    state.lastVoucherDate ||
    new Date(
      Date.now() -
        24 * 60 * 60 * 1000
    ).toISOString();

  // overlap 1 giờ
  const voucherDateMin =
    new Date(
      new Date(checkpoint).getTime() -
        60 * 60 * 1000
    ).toISOString();

  const voucherDateMax =
    runStartedAt;

  console.log(
    `[CASH FUND INCREMENTAL] min=${voucherDateMin}, max=${voucherDateMax}`
  );

  const existingIds =
    await buildCashFundIdSet();

  const newItems = [];

  let page = 1;
  let totalSapo = 0;
  let totalSkip = 0;

  while (true) {
    const cashFunds =
      await getCashFunds({
        page,
        limit,
        voucherDateMin,
        voucherDateMax,
      });

    console.log(
      `[CASH FUND] page=${page}, count=${cashFunds.length}`
    );

    if (!cashFunds.length) {
      break;
    }

    totalSapo +=
      cashFunds.length;

    for (const cashFund of cashFunds) {
      const id =
        String(
          cashFund.id ?? ""
        ).trim();

      if (!id) {
        continue;
      }

      // Bill đã có rồi
      if (existingIds.has(id)) {
        totalSkip++;
        continue;
      }

      console.log(
        `[NEW BILL] id=${id}, code=${cashFund.code}, date=${cashFund.voucher_date}`
      );

      newItems.push({
        id,
        voucherDate:
          cashFund.voucher_date,
        row:
          cashFundToRow(cashFund),
      });

      // tránh trùng nếu API trả lại ID
      // trong page kế tiếp
      existingIds.add(id);
    }

    if (
      cashFunds.length < limit
    ) {
      break;
    }

    page++;
  }

  // Chắc chắn bill mới nhất nằm trên cùng
  newItems.sort(
    (a, b) =>
      new Date(b.voucherDate) -
      new Date(a.voucherDate)
  );

  const newRows =
    newItems.map(
      item => item.row
    );

  if (newRows.length > 0) {
    await insertRowsAtTop(
      sheetName,
      newRows,
      spreadsheetId
    );
  }

  // Chỉ lưu checkpoint sau khi
  // Sheet đã ghi thành công
  await setCashFundSyncState({
    lastVoucherDate:
      runStartedAt,
    status: "idle",
  });

  console.log(
    `[CASH FUND DONE] ` +
      `sapo=${totalSapo}, ` +
      `added=${newRows.length}, ` +
      `skip=${totalSkip}`
  );

  return {
    success: true,
    voucherDateMin,
    voucherDateMax,
    sapo:
      totalSapo,
    added:
      newRows.length,
    skipped:
      totalSkip,
  };
}
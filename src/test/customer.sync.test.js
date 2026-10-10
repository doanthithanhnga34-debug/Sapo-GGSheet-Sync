async function backfillInvoiceTypeColumn() {
  const limit =
    config.sapoInvoice.limit;

  const sheetName =
    config.sheet.sapoInvoice.sheetName;

  const sheetID =
    config.sheet.sapoInvoice.sheetId;

  const syncState =
    await invoiceSyncState.get();

  const page =
    Number(
      syncState.backfillPage
    ) || 1;


  // =========================
  // Xác định cột cần backfill
  // =========================

  const columnIndex =
    invoiceMapper.HEADERS.indexOf(
      "Loại hóa đơn"
    );

  if (columnIndex === -1) {
    throw new Error(
      "Not found column Loại hóa đơn"
    );
  }

  // indexOf bắt đầu từ 0
  // columnNumberToLetter cần bắt đầu từ 1
  const columnLetter =
    sheetService.columnNumberToLetter(
      columnIndex + 1
    );


  // =========================
  // Build ID -> row Sheet
  // =========================

  const idIndex =
    await buildInvoiceIdIndex();


  // =========================
  // Lấy 1 page từ Sapo
  // =========================

  const invoices =
    await getInvoices({
      page,
      limit,
    });


  if (!invoices.length) {
    await invoiceSyncState.set({
      backfillPage: 1,
      backfillStatus: "done",
    });

    return {
      success: true,
      done: true,
      page,
      updated: 0,
    };
  }


  const updateData = [];

  let matched = 0;
  let skipped = 0;


  // =========================
  // Tìm invoice trong Sheet
  // =========================

  for (const invoice of invoices) {
    const invoiceId =
      String(
        invoice.id || ""
      ).trim();

    if (!invoiceId) {
      continue;
    }

    const existing =
      idIndex.get(invoiceId);

    if (!existing) {
      skipped++;
      continue;
    }


    // Giá trị cột mới
    const invoiceType =
      String(
        invoice.invoice_type || ""
      ).trim();


    updateData.push({
      range:
        `'${sheetName}'!${columnLetter}${existing.row}`,

      values: [
        [
          invoiceType
        ]
      ],
    });

    matched++;
  }


  // =========================
  // Update chỉ 1 column
  // =========================

  if (updateData.length > 0) {
    await sheetService
      .batchUpdateValues(
        updateData,
        sheetID
      );
  }


  const done =
    invoices.length < limit;


  await invoiceSyncState.set({
    backfillPage:
      done
        ? 1
        : page + 1,

    backfillStatus:
      done
        ? "done"
        : "idle",
  });


  return {
    success: true,
    done,
    page,
    nextPage:
      done
        ? null
        : page + 1,

    sapo:
      invoices.length,

    updated:
      matched,

    skipped,
  };
}
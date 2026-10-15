async function reconcileOrders({
  dryRun = false,
  maxPages = 3,
} = {}) {
  return exclusive("reconcileOrders", async () => {
    const t = getTarget();
    const startedAt = Date.now();

    const stats = {
      success: false,
      dryRun,
      maxPages,
      totalPages: 0,
      totalOrders: 0,
      excluded: 0,
      plannedInserts: 0,
      plannedUpdates: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      durationSeconds: 0,
    };

    try {
      await ensureSetup(t);

      // Đọc dữ liệu Sheet một lần
      const { index } = await readSheet(t);

      const itemsById = new Map();

      let page = 1;

      // Chỉ quét tối đa maxPages
      while (page <= maxPages) {
        const orders = await orderService.getOrders({
          page,
          limit: t.limit,
        });

        if (!orders || orders.length === 0) {
          break;
        }

        stats.totalPages++;
        stats.totalOrders += orders.length;

        const kept = orders.filter(
          (order) => !excludeOrder(order)
        );

        stats.excluded += orders.length - kept.length;

        // Mapper từng page, không giữ toàn bộ order Sapo
        const items = await toItems(t, kept);

        for (const item of items) {
          itemsById.set(item.id, item);
        }

        console.log(
          `[ORDER RECONCILE] Page ${page} | ` +
          `Fetched: ${orders.length} | ` +
          `Kept: ${kept.length}`
        );

        if (orders.length < t.limit) {
          break;
        }

        page++;
      }

      // So sánh ID và Ngày cập nhật
      const plan = planUpsert(
        index,
        [...itemsById.values()]
      );

      stats.plannedInserts = plan.inserts.length;
      stats.plannedUpdates = plan.updates.length;
      stats.skipped = plan.skipped;

      console.log("[ORDER RECONCILE] PLAN", {
        inserts: plan.inserts.length,
        updates: plan.updates.length,
        skipped: plan.skipped,
      });

      if (dryRun) {
        return {
          ...stats,
          success: true,
          durationSeconds: Math.round(
            (Date.now() - startedAt) / 1000
          ),
        };
      }

      // UPDATE trước INSERT
      const UPDATE_BATCH_SIZE = 100;

      for (
        let i = 0;
        i < plan.updates.length;
        i += UPDATE_BATCH_SIZE
      ) {
        const batch = plan.updates.slice(
          i,
          i + UPDATE_BATCH_SIZE
        );

        await applyUpdates(t, batch);

        stats.updated += batch.length;
      }

      // INSERT lên đầu Sheet
      const newRows = plan.inserts.map(
        (item) => item.row
      );

      if (newRows.length > 0) {
        await insertAtTop(t, newRows);
        stats.inserted = newRows.length;
      }

      stats.success = true;
      stats.durationSeconds = Math.round(
        (Date.now() - startedAt) / 1000
      );

      console.log(
        "[ORDER RECONCILE] COMPLETED",
        JSON.stringify(stats, null, 2)
      );

      return stats;

    } catch (error) {
      console.error(
        "[ORDER RECONCILE] FAILED:",
        error.message
      );

      await markError(error);
      throw error;
    }
  });
}
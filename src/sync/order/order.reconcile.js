function planDeletion(rowsById, sapoIds, { maxRatio = 0.05, minAllowed = 10 } = {}) {
  const candidates = [];
  let total = 0;
  for (const [id, rows] of rowsById) {
    total += rows.length;
    if (sapoIds.has(id)) continue;
    for (const rowNo of rows) candidates.push({ id, rowNo });
  }
  candidates.sort((a, b) => a.rowNo - b.rowNo);

  const limit = Math.max(minAllowed, Math.ceil(total * maxRatio));
  let blockedReason = null;
  if (sapoIds.size === 0) {
    blockedReason = "Sapo trả về 0 đơn, có thể việc lấy dữ liệu đã lỗi";
  } else if (candidates.length > limit) {
    blockedReason = `${candidates.length} dòng vắng mặt trên Sapo, vượt ngưỡng an toàn ${limit} dòng (tối đa ${
      maxRatio * 100
    }% hoặc ${minAllowed} dòng)`;
  }
  return { candidates, total, limit, blockedReason };
}
async function reconcileOrdersBatch() {
  return exclusive("reconcileOrdersBatch", async () => {
    const t = getTarget();

    try {
      await ensureSetup(t);

      const state = await orderSyncState.get();

      const page = Number(state.reconcileNextPage) || 1;

      const { index, nextRow } = await readSheet(t);

      const orders = await orderService.getOrders({
        page,
        limit: t.limit,
      });

      if (orders.length === 0) {
        await orderSyncState.set({
          reconcileNextPage: 1,
          reconcileStatus: "done",
        });

        return {
          success: true,
          done: true,
          page,
        };
      }

      const kept = orders.filter(
        (order) => !excludeOrder(order)
      );

      const items = await toItems(t, kept);

      const plan = planUpsert(index, items);

      // Cập nhật đơn cũ trước
      await applyUpdates(t, plan.updates);

      // Thêm đơn chưa có trong Sheet
      await appendRows(
        t,
        plan.inserts.map((item) => item.row),
        nextRow
      );

      const done = orders.length < t.limit;

      await orderSyncState.set({
        reconcileNextPage: done ? 1 : page + 1,
        reconcileStatus: done ? "done" : "idle",
      });

      console.log("[RECONCILE ORDERS]", {
        page,
        total: orders.length,
        inserted: plan.inserts.length,
        updated: plan.updates.length,
        skipped: plan.skipped,
        done,
      });

      return {
        success: true,
        page,
        nextPage: done ? 1 : page + 1,
        done,
        totalOrders: orders.length,
        inserted: plan.inserts.length,
        updated: plan.updates.length,
        skipped: plan.skipped,
      };
    } catch (error) {
      console.error("[RECONCILE ERROR]", error.message);
      throw error;
    }
  });
}

module.exports = { planDeletion };
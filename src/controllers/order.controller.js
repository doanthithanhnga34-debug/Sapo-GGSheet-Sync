const orderSync = require("../sync/order/order.sync");


async function syncOrderBatch(req, res){
    const result = await orderSync.buildOrdersBatch();
    return res.json(result);
}

async function incremental(req, res){
    const result = await orderSync.incremental();
    return res.json(result)
}

const orderController = {
    syncOrderBatch,
    incremental,
}

module.exports = orderController
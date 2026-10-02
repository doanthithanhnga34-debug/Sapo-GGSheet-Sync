const customerReconcile = require("../sync/customers/customer.reconcile");
const customerSync = require("../sync/customers/customer.sync");


async function getCustomer(req,res){
    const result = await customerSync.buildOneCustomer(req.params.id);
    return res.json({result})
}

async function incremental(req,res){
    const result = await customerSync.incremental();
    return res.json({result})
}

async function reconcileDeleteRows(req, res){
    const result = await customerReconcile.reconcileDeletedCustomers();
    return res.json({result});
}

const customerController = {
    getCustomer,
    incremental,
    reconcileDeleteRows

}

module.exports = customerController
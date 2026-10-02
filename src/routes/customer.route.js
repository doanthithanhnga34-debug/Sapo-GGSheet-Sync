const express = require("express");
const { buildOneCustomer, testWriteOneCustomerToSheet, syncAllCustomers, buildBatchCustomerSync, continueCustomerBatchSync } = require("../sync/customers/buildCustomer.sync");
const { HEADERS } = require("../sync/customers/customer.mapper");
const { incrementalCustomerSync } = require("../sync/incrementalSync/incrementalCustomer.sync");
const { bootstrapCustomerIndex } = require("../sync/syncBootstrapCustomerIndex");
const { reconcileOldCustomersBatch, deleteDuplicateCustomerRows } = require("../sync/customers/reconcileSheet");
const { reconcileDeletedCustomers } = require("../sync/deleteRows/deleteRows.sync");
const customerRouter = express.Router();

// Test get 1 customer

customerRouter.get("/:id", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({
      success: false,
      message: "No path found",
    });
  }

  res.set("Cache-Control", "no-store");

  const id = req.params.id;

  try {
    const { row } = await buildOneCustomer(id);

    if (!Array.isArray(row) || row.length !== HEADERS.length) {
      throw new Error("Number of column is not match with HEADERS");
    }

    const data = Object.fromEntries(
      HEADERS.map((header, index) => [header, row[index]]),
    );

    return res.status(200).json({
      success: true,
      customerId: id,
      totalColumns: row.length,
      data,
    });
  } catch (e) {
    return res.status(500).json({
      success: false,
      message: e.message
    });
  }
});

customerRouter.post("/write_customer_to_sheet/:id/sheet", async (req, res) => {
  try {
    const result = await testWriteOneCustomerToSheet(req.params.id);
    return res.json(result);
  } catch (e) {
    console.log("error message test write", e.message);
    return res.status(500).json({
      success: false,
      message: e.message,
    });
  }
});

// Get full sync customers
customerRouter.post("/allCustomers", async (req, res) => {
  try {
    const result = await syncAllCustomers();
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (e) {
    return res.status(500).json({
      success: false,
      message: e.message,
    });
  }
});

// Get batch customer
customerRouter.get("/getBatchCustomer", async (req, res) => {
  try {
    const result = await buildBatchCustomerSync();
    return res.json(result);
  } catch (e) {
    return res.status(500).json({
      success: false,
      message: e.message,
    });
  }
});
customerRouter.post("/batchCustomers", async function (req, res) {
  try {
    console.log("Batch sync customer");
    const result = await buildBatchCustomerSync();
    return res.json(result);
  } catch (e) {
    console.log("Error:", e.message);
    return res.status(500).json({
      success: false,
      error: e.message,
    });
  }
});



customerRouter.post("/bootstrapIndex", async (req, res) => {
  try {
    const result = await bootstrapCustomerIndex();
    return res.json(result);
  } catch (e) {
    console.log("bootstrap index", e.stack || e);
    return res.status(500).json({
      success: false,
      message: e.message,
    });
  }
});

customerRouter.post('/reconcileOldCustomerBatch', async function(req,res){
  try{
    const result = await reconcileOldCustomersBatch();
    return res.json({result});
  }catch(e){
    return {
      success:false,
      message:e.message
    }
  }
})

customerRouter.delete('/deleteDuplicateRow', async (req,res) =>{
  try{
    const result = await deleteDuplicateCustomerRows();
    return res.json(result)
  }catch(e){
    return res.status(500).json({
      success:false,
      message:e.message
    })
  }
})

customerRouter.post('/continueCustomerBatchSync', async (req, res) =>{
  try{
    const result  = await continueCustomerBatchSync();
    return res.json(result)
  }catch(e){
    return res.json({
      success:false,
      message:e.message
    })
  }
})
//Path sync reconcile
customerRouter.post("/incremental", async (req, res) => {
  try {
    const result = await incrementalCustomerSync();

    return res.json(result);
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      error: e.message,
    });
  }
});
customerRouter.post('/reconcileDeleteRows', async (req,res) =>{
  try{
    const result = await reconcileDeletedCustomers();
    return res.json(result)
  }catch(e){
    return {
      success:false,
      message:e.message
    }
  }
})

module.exports = customerRouter;

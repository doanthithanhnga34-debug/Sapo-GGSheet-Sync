

const fireStore = require("@google-cloud/firestore");
const fs = require("../firestore/index.firestore");
const config = require("../../config/config");

const db = new fireStore({
  projectId: config.projectId
});

const COLLECTION = "sync_state";
const DOCUMENT = "order";

const DEFAULT_STATE = {

  nextPage: 1,
  status: "idle",
  nextRow:2
};
async function get() {
  return fs.getDocument(COLLECTION,DOCUMENT,DEFAULT_STATE)
}

async function set(data = {}) {
 return fs.setDocument(COLLECTION,DOCUMENT,data)
}

const orderSyncState = {
  get,
  set,
};


module.exports = orderSyncState


const fireStore = require("@google-cloud/firestore");
const fs = require("../firestore/index.firestore");

const db = new fireStore({
  projectId: "solar-catfish-508808-p7",
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
const fireStore = require("@google-cloud/firestore");

const db = new fireStore({
  projectId: "solar-catfish-508808-p7",
});

const COLLECTION = "sync_state";
const DOCUMENT = "cash_fund";

const DEFAULT_STATE = {

  nextPage: 1,
  status: "idle",
};
async function get() {
  const ref = db.collection(COLLECTION).doc(DOCUMENT);
  const doc = await ref.get();
  if (!doc.exists) {
    return {
      ...DEFAULT_STATE,
    };
  }
  const data = doc.data();
  return {
    ...DEFAULT_STATE,
    ...data,
  };
}

async function set(data = {}) {
  const current = await get();

  const ref = await db.collection(COLLECTION).doc(DOCUMENT);
  await ref.set(
    {
      ...data,
      updateAt: new Date(),
    },
    {
      merge: true,
    },
  );
  return true;
}

const cashFundSyncState = {
  get,
  set,
};


module.exports = cashFundSyncState
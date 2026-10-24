const { Firestore } = require("@google-cloud/firestore");

const db = new Firestore({
  projectId: "solar-catfish-508808-p7",
});

const COLLECTION = "product_variant";

function docRef(locationId) {
  return db.collection(COLLECTION).doc(`product_variant_${locationId}`);
}

async function getState(locationId) {
  const snapshot = await docRef(locationId).get();
  return snapshot.exists ? snapshot.data() : null;
}

async function saveSuccess(locationId, checkpoint) {
  (await docRef(locationId).set({
    locationId: String(locationId),
    lastSuccessSync: checkpoint,
    status: "success",
    updatedAt: new Date().toISOString(),
  }),
    {
      merge: true,
    });
}
const variantSyncState = {
  getState,
  saveSuccess,
};
module.exports = variantSyncState;

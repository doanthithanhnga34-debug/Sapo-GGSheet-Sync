const { Firestore } = require("@google-cloud/firestore");
const config = require("../../config/config");

const db = new Firestore({
  projectId: config.projectId
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

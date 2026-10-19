const { Firestore } = require("@google-cloud/firestore");

const db = new Firestore({
  projectId: "solar-catfish-508808-p7",
});

async function getDocument(collection, document, defaultState = {}) {
  const ref = db.collection(collection).doc(document);
  const doc = await ref.get();
  if (!doc.exists) {
    return {
      ...defaultState,
    };
  }
  return {
    ...defaultState,
    ...doc.data(),
  };
}

async function setDocument(collection,document,data = {}) {

  const ref = db.collection(collection).doc(document);
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

const fs={
    getDocument, setDocument
}
module.exports = fs

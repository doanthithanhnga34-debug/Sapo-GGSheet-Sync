const { randomUUID } = require("node:crypto");

const fs = require("../firestore/index.firestore");

const LOCK_ID = "sapo_product_sheet";
const LEASE_MS = 5 * 60 * 1000;
const COLLECTION = "sync_locks";

async function acquireSyncLock(jobName) {
  const ref = fs.db.collection(COLLECTION).doc(LOCK_ID);
  const token = randomUUID();

  const acquired = await fs.db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const lock = snapshot.data();
    const now = Date.now();

    if (lock?.expiresAt > now) {
      console.warn("[Sync Lock] Busy", {
        requestedJob: jobName,
        runningJob: lock.jobName,
        acquiredAt: lock.acquiredAt,
        expiresAt: new Date(lock.expiresAt).toISOString(),
      });

      return false;
    }

    tx.set(ref, {
      jobName,
      token,
      acquiredAt: new Date(now).toISOString(),
      expiresAt: now + LEASE_MS,
    });
    return true;
  });
  return acquired ? token : null;
}
async function releaseSyncLock(token) {
  const ref = fs.db.collection(COLLECTION).doc(LOCK_ID);
  await fs.db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (snapshot.data()?.token === token) {
      tx.delete(ref);
    }
  });
}

async function getSyncLockStatus() {
  const ref = fs.db.collection("sync_locks").doc(LOCK_ID);

  const snapshot = await ref.get();

  if (!snapshot.exists) {
    return {
      locked: false,
      reason: "NO_LOCK",
    };
  }

  const lock = snapshot.data();
  const now = Date.now();
  const expiresAt = Number(lock.expiresAt);

  return {
    locked: expiresAt > now,
    jobName: lock.jobName,
    acquiredAt: lock.acquiredAt,
    expiresAt: Number.isFinite(expiresAt)
      ? new Date(expiresAt).toISOString()
      : null,
    expired: Number.isFinite(expiresAt) ? expiresAt <= now : null,
  };
}

module.exports = {
  acquireSyncLock,
  releaseSyncLock,
};

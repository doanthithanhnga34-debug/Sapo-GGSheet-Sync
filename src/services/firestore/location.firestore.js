const  fireStore  = require("@google-cloud/firestore");
const fs = require("./index.firestore");

const db = new fireStore({
    projectId:'solar-catfish-508808-p7'
})

const COLLECTION = 'location'


async function get(locationId){
    return fs.getDocument(COLLECTION,locationId)
}

async function set(locationId,data={}){
    return fs.setDocument(COLLECTION,locationId,data)
}
async function getAll(){
    const snapshot = await db.collection(COLLECTION).get();
    return snapshot.docs.map((doc)=>doc.data());
}

const locationFS = {
    get,
    set,
    getAll
}

module.exports = locationFS
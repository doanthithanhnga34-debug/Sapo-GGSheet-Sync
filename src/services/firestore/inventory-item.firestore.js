const { Firestore } = require("@google-cloud/firestore");



const COLLECTION = "inventory_item_mapping";
const BATCH_SIZE=50;

const db = new Firestore({
    projectId:'solar-catfish-508808-p7'
})

async function saveMappings(mappings){
    if(!Array.isArray(mappings)){
        throw new Error("Mapping must be an array")
    }

    let saved = 0;

    for(let i =0 ; i<mappings.length; i+=BATCH_SIZE){
        const batch = db.batch();
        const items = mappings.slice(i, i+BATCH_SIZE);

        for(const item of items){
            const ref = db.collection(COLLECTION).doc(String(item.inventoryItemId));
            batch.set(ref, {
                inventoryItemId:String(item.inventoryItemId),
                variantId:String(item.variantId),
                productId:String(item.productId)
            },{
                merge:true
            })
        }
        await batch.commit();
        saved +=items.length;
        console.log(`[Inventory Mapping] saved ${saved}/${mappings.length}`)
    }
    return {saved}
}

async function getAllMappings(){
    const snapshot = await db.collection(COLLECTION).get();
    return snapshot.docs.map((doc) => doc.data())
}

async function deleteMappingsByIds(inventoryItemIds){
  if(!Array.isArray(inventoryItemIds)){
    throw new Error("inventoryItemIds must be an array")
  }
  const ids = [... new Set(inventoryItemIds.map(String))];
  if(ids.length === 0){
    return {deleted:0}
  }
  let deleted = 0;
  const BATCH_SIZE = 50;
  for(let i=0; i<ids.length; i+= BATCH_SIZE){
    const batch= db.batch();
    const batchIds = ids.slice(i,i+BATCH_SIZE);
    for(const id of batchIds){
        const ref = db.collection(COLLECTION).doc(id);
        batch.delete(ref);
    }
    await batch.commit();
    deleted += batchIds.length;

  }
  return {deleted}
}
const inventoryItemFS ={
    saveMappings,
    getAllMappings,
    deleteMappingsByIds
}
module.exports = inventoryItemFS
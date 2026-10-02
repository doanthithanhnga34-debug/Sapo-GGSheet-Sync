function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retry(
  fn,
  { retries = 5, baseDelay = 1000, maxDelay = 15000 } = {},
) {

 for (let attempt = 0; attempt <= retries; attempt++) {
     try {
       return await fn();
     } catch (error) {

      if(error.retryable === false){
        throw error
      }
       if (attempt === retries) {
         throw error;
       }
 
       const delay = Math.min(
         baseDelay * Math.pow(2, attempt),
         maxDelay
       );
 
       console.warn(
         `[RETRY] lần thử lại=${attempt + 1}/${retries}, chờ=${delay}ms`,
         error instanceof Error
           ? error.message
           : String(error)
       );
 
       await sleep(delay);
     }
   }
}

module.exports={
    sleep,
    retry
}

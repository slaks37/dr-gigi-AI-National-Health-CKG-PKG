export async function boundedInference<T>(operation:(signal:AbortSignal)=>Promise<T>,options:{deadline:number;attemptTimeoutMs:number;signal?:AbortSignal}):Promise<T> {
 const remaining=Math.min(options.attemptTimeoutMs,options.deadline-Date.now());
 if(remaining<=0||options.signal?.aborted)throw new Error('Inference deadline or cancellation reached');
 const signal=options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(remaining)]):AbortSignal.timeout(remaining);
 let rejectAbort:(()=>void)|undefined;
 const aborted=new Promise<never>((_resolve,reject)=>{rejectAbort=()=>reject(new Error('Inference deadline or cancellation reached'));signal.addEventListener('abort',rejectAbort,{once:true});});
 try{return await Promise.race([operation(signal),aborted]);}finally{if(rejectAbort)signal.removeEventListener('abort',rejectAbort);}
}

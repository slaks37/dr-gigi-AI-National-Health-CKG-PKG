export function evaluateBinary(labels:boolean[],predictions:boolean[]) {
 if(!labels.length||labels.length!==predictions.length)throw new Error('Matched labeled evaluation data required');
 let tp=0,tn=0,fp=0,fn=0;labels.forEach((y,i)=>{if(y&&predictions[i])tp++;else if(y)fn++;else if(predictions[i])fp++;else tn++;});
 const ratio=(a:number,b:number)=>b?a/b:null;
 const precision=ratio(tp,tp+fp),recall=ratio(tp,tp+fn);
 return{sample_count:labels.length,confusion_matrix:{tp,tn,fp,fn},sensitivity:recall,specificity:ratio(tn,tn+fp),precision,recall,f1:precision!==null&&recall!==null&&precision+recall?2*precision*recall/(precision+recall):null,false_positive_rate:ratio(fp,fp+tn),false_negative_rate:ratio(fn,fn+tp)};
}

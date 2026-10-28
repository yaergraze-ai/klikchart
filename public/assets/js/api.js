export async function api(path,payload){
 let response;
 try{response=await fetch(`/api/${path}`,{method:payload===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:{...(payload!==undefined?{'Content-Type':'application/json','X-Klikchart-Request':'1'}:{})},body:payload===undefined?undefined:JSON.stringify(payload)});}catch{throw Object.assign(new Error('NETWORK_ERROR'),{code:'NETWORK_ERROR'});}
 let body;
 try{body=await response.json();}catch{throw Object.assign(new Error('NETWORK_ERROR'),{code:'NETWORK_ERROR'});}
 if(!response.ok||!body.ok)throw Object.assign(new Error(body?.error?.code||'INTERNAL_ERROR'),{code:body?.error?.code||'INTERNAL_ERROR',fields:body?.error?.fields||{}});
 return body.data;
}

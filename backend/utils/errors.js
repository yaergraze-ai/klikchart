export class AppError extends Error { constructor(code,status=400,fields=null){super(code);this.code=code;this.status=status;this.fields=fields;} }
export const fail=(code,status=400,fields)=>{throw new AppError(code,status,fields);};
export const ok=(res,data={},status=200)=>res.status(status).json({ok:true,data});

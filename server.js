require("dotenv").config();
const express=require("express"),path=require("path"),multer=require("multer");
const auth=require("./src/auth"),cost=require("./src/cost"),admin=require("./src/admin"),xlsx=require("./src/xlsx"),aps=require("./src/aps");
const app=express(),upload=multer({storage:multer.memoryStorage()}),PORT=process.env.PORT||4000;
app.use(express.json({limit:"10mb"}));app.use(express.static(path.join(__dirname,"public")));
app.get("/",(_,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.get("/api/version",(_,res)=>res.json({ok:true,version:"v35",package:"1.0.35",ui:"modern-project-selection-project-name-preview",approvalLogic:"workday-id-only-duplicate-check"}));
app.get("/api/debug/last-cost-request",(_,res)=>res.json({ok:true,lastCostRequest:aps.last()}));
app.get("/api/auth/login",(_,res)=>res.redirect(auth.loginUrl(auth.state())));
app.get("/api/auth/callback",async(req,res)=>{try{const{code,state,error}=req.query;if(error)return res.status(400).send(String(error));if(!code||!auth.valid(state))return res.status(400).send("Invalid OAuth callback");const t=await auth.exchange(code);auth.set(res,{access_token:t.access_token,refresh_token:t.refresh_token,expires_at:Date.now()+t.expires_in*1000});res.redirect("/");}catch(e){res.status(500).send(e.message);}});
app.get("/api/auth/status",(req,res)=>res.json({signedIn:!!auth.get(req)}));
app.post("/api/auth/logout",(_,res)=>{auth.clear(res);res.json({ok:true});});
app.get("/api/hubs",auth.ensure,async(req,res)=>{try{const h=await cost.hubs(req.aps.access_token);res.json(h.map(x=>({id:x.id,name:x.attributes?.name||x.id})));}catch(e){res.status(500).json({error:e.message});}});
app.get("/api/hubs/:hubId/projects",auth.ensure,async(req,res)=>{try{res.json(await cost.projects(req.aps.access_token,req.params.hubId));}catch(e){res.status(500).json({error:e.message});}});
async function context(req,projectIds){if(!projectIds.length)throw new Error("Select at least one project.");const all=await cost.projects(req.aps.access_token,req.params.hubId);const wanted=new Set(projectIds);const projects=all.filter(p=>wanted.has(p.id)).slice(0,100);if(!projects.length)throw new Error("No selected projects were found in the signed-in user's accessible project list.");const budgetsByProject={};for(const p of projects)budgetsByProject[p.id]=await cost.budgets(req.aps.access_token,p.id);const companies=projects[0]?await admin.companies(req.params.hubId,projects[0].id):[];return{projects,budgetsByProject,companies};}
app.get("/api/hubs/:hubId/templates/multi",auth.ensure,async(req,res)=>{try{const ids=String(req.query.projectIds||"").split(",").filter(Boolean);const ctx=await context(req,ids);const b=await xlsx.buildTemplate(ctx);res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");res.setHeader("Content-Disposition","attachment; filename=multi-project-expense-template.xlsx");res.send(Buffer.from(b));}catch(e){res.status(500).json({error:e.message});}});
app.post("/api/hubs/:hubId/import-excel",auth.ensure,upload.single("file"),async(req,res)=>{try{if(!req.file)throw new Error("Choose an Excel file first.");const projectIds=String(req.body.projectIds||"").split(",").filter(Boolean);const ctx=await context(req,projectIds);const parsed=await xlsx.parse(req.file.buffer,ctx.projects,ctx.budgetsByProject);const existingByProject={};for(const p of ctx.projects)existingByProject[p.id]=await cost.expenses(req.aps.access_token,p.id).catch(()=>[]);const existing=[];for(const r of parsed.rows){
  const workday=String(r.workdayUniqueId||"").trim().toLowerCase();
  if(!workday) continue;
  const match=(existingByProject[r.projectId]||[]).find(e=>String(e.referenceNumber||"").trim().toLowerCase()===workday);
  if(match){
    r.existsInCost=true;
    r.matchedBy="Workday Unique ID";
    r.matchedValue=r.workdayUniqueId;
    r.existingExpense={id:match.id,number:match.number,name:match.name,referenceNumber:match.referenceNumber,status:match.status};
    existing.push({rowNumber:r.excelRowNumber,projectName:r.projectName,workdayUniqueId:r.workdayUniqueId,expenseName:r.expenseName,matchedBy:"Workday Unique ID",matchedValue:r.workdayUniqueId,existingExpense:r.existingExpense});
  }
}
parsed.summary.existingInCostRows=existing.length;parsed.summary.rowsToCreate=parsed.rows.filter(r=>!r.duplicateInExcel&&!r.existsInCost).length;res.json({...parsed,existingDuplicates:existing});}catch(e){res.status(500).json({error:e.message});}});
app.post("/api/projects/:projectId/expenses",auth.ensure,async(req,res)=>{
  try{
    if(req.body.duplicateInExcel)return res.json({ok:true,skipped:true,reason:"duplicate-in-excel"});
    if(req.body.existsInCost)return res.json({ok:true,skipped:true,reason:"already-exists-in-cost",matchedBy:req.body.matchedBy||"Workday Unique ID",matchedValue:req.body.matchedValue||req.body.workdayUniqueId,existingExpense:req.body.existingExpense||null});

    const id=req.params.projectId;
    const t=req.aps.access_token;
    const requested=String(req.body.status||"approved").toLowerCase();

    const basePayload={
      supplierName:req.body.supplierName||null,
      name:req.body.expenseName,
      referenceNumber:req.body.workdayUniqueId||req.body.referenceNumber||"",
      description:req.body.description||"",
      type:req.body.type||"Invoice"
    };
    for(const k of["issuedAt","receivedAt","paymentDue","paidAt"]){
      if(req.body[k])basePayload[k]=req.body[k];
    }

    const itemPayload={
      budgetId:req.body.budgetId,
      name:req.body.itemName||req.body.workdayUniqueId||req.body.expenseName,
      description:req.body.itemDescription||"",
      quantity:req.body.quantity||1,
      unitPrice:req.body.unitPrice||req.body.amount||0,
      unit:req.body.unit||"ls",
      amount:req.body.amount||0,
      exchangeRate:1
    };

    let expense=null;
    let item=null;
    let createdStatus="draft";
    let finalStatus="draft";
    let approvalAttempt=null;
    let pathUsed="draft-create-item-then-approve";

    // Important Autodesk behaviour found from testing:
    // If an expense is created as approved first, Autodesk will not allow adding items afterwards.
    // So for approved rows, first try atomic creation with the item included in the expense payload.
    if(requested==="approved"){
      try{
        expense=await cost.createExpense(t,id,{...basePayload,status:"approved",expenseItems:[itemPayload]});
        createdStatus="approved";
        finalStatus="approved";
        pathUsed="approved-create-with-nested-items";
        item=(expense.expenseItems&&expense.expenseItems[0])||null;
        approvalAttempt={ok:true,method:"create-with-nested-items",finalStatus:"approved"};
      }catch(approvedCreateError){
        approvalAttempt={
          ok:false,
          method:"create-with-nested-items",
          fallback:"draft",
          message:"Approved create with nested item was rejected. Creating as draft, adding item, then trying status update.",
          autodeskError:approvedCreateError.message
        };
      }
    }

    if(!expense){
      expense=await cost.createExpense(t,id,{...basePayload,status:"draft"});
      createdStatus="draft";
      finalStatus="draft";
      item=await cost.createItem(t,id,expense.id,itemPayload);

      if(requested==="approved"){
        try{
          await cost.updateExpense(t,id,expense.id,{status:"approved"});
          finalStatus="approved";
          approvalAttempt={ok:true,method:"patch-after-item",finalStatus:"approved"};
        }catch(patchError){
          finalStatus="draft";
          approvalAttempt={
            ok:false,
            method:"patch-after-item",
            fallback:"draft",
            message:"Autodesk rejected draft to approved status update. Expense item was created successfully, but expense remains draft.",
            autodeskError:patchError.message
          };
        }
      }
    }

    res.json({
      ok:true,
      created:true,
      requestedStatus:requested,
      createdStatus,
      finalStatus,
      pathUsed,
      projectName:req.body.projectName,
      expense,
      expenseItem:item,
      approvalAttempt
    });
  }catch(e){
    res.status(500).json({error:e.message});
  }
});
if(require.main===module)app.listen(PORT,()=>console.log(`ACC Expense app v35 running on http://localhost:${PORT}`));
module.exports=app;

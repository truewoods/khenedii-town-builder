import {initializeApp} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {getFirestore,doc,getDoc,setDoc,serverTimestamp} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
const config={apiKey:"AIzaSyCsSlKw5EifCbLA6eEY-4Y4StRS-SFtqbw",authDomain:"khenedii-town-builder.firebaseapp.com",projectId:"khenedii-town-builder",storageBucket:"khenedii-town-builder.firebasestorage.app",messagingSenderId:"470105635349",appId:"1:470105635349:web:11dcd0f309bf7b1984ac1c"};
const STUDENT="J9NzZKEbqzeVdthrOo7wHyXjLVk1",PARENT="ragvOTN292bW8pjqTCsvVu9eZwI2";
const app=initializeApp(config),auth=getAuth(app),db=getFirestore(app);
const $=id=>document.getElementById(id);
const localKey="khenedii-town-builder-v1";
let role=null,ready=false,busy=false,pending=null,lastUploaded="";
const say=(s)=>{$("cloudStatus").textContent=s};
const show=(id,yes)=>{$(id).hidden=!yes};
function sanitize(s){return String(s||"").slice(0,20000)}
async function upload(){
 if(role!=="student"||!ready)return;
 if(busy){pending=true;return}
 const raw=localStorage.getItem(localKey);if(!raw||raw===lastUploaded)return;
 let town;try{town=JSON.parse(raw)}catch{return}
 busy=true;say("Saving to cloud…");
 try{
  await setDoc(doc(db,"studentProgress",STUDENT),{town,assignments:{},researchNotes:{},completedMissions:{},xp:0,credits:0,currentWeek:0,updatedAt:serverTimestamp()});
  lastUploaded=raw;say("✓ Saved to cloud");
 }catch(e){say("Cloud save failed — local copy remains. "+e.message)}
 finally{busy=false;if(pending){pending=null;setTimeout(upload,300)}}
}
let debounce;
window.addEventListener("town-local-save",()=>{if(role==="student"&&ready){clearTimeout(debounce);debounce=setTimeout(upload,1200)}});
window.addEventListener("town-local-loaded",()=>{if(role==="student"&&ready){clearTimeout(debounce);debounce=setTimeout(upload,1200)}});
$("loginForm").addEventListener("submit",async e=>{
 e.preventDefault();$("loginError").textContent="Signing in…";
 try{await signInWithEmailAndPassword(auth,$("loginEmail").value.trim(),$("loginPassword").value);$("loginPassword").value=""}
 catch(err){$("loginError").textContent="Sign-in failed. Check email and password."}
});
$("logoutBtn").onclick=()=>signOut(auth);
$("cloudRetry").onclick=upload;
$("reviewSave").onclick=async()=>{
 if(role!=="parent")return;
 $("reviewStatus").textContent="Saving feedback…";
 try{
  await rewardBaseline();
  await setDoc(doc(db,"parentReviews",STUDENT),{
   feedback:$("parentFeedback").value.slice(0,12000),
   approvedWeeks:$("approvedWeeks").value.split(",").map(s=>Number(s.trim())).filter(n=>Number.isInteger(n)&&n>=1&&n<=36),
   updatedAt:serverTimestamp()
  },{merge:true});
  $("reviewStatus").textContent="✓ Feedback saved";
 }catch(e){$("reviewStatus").textContent="Could not save: "+e.message}
};
async function rewardBaseline(){
 const reviewSnap=await getDoc(doc(db,"parentReviews",STUDENT));
 const current=reviewSnap.exists()?reviewSnap.data():{};
 if(Array.isArray(current.legacyWeeks))return current;
 const progress=await getDoc(doc(db,"studentProgress",STUDENT));
 const statuses=progress.exists()?progress.data().town?.statuses||{}:{};
 const legacyWeeks=Object.entries(statuses).filter(([k,v])=>v==="done"&&Number.isInteger(Number(k))&&Number(k)>=0&&Number(k)<36).map(([k])=>Number(k)+1);
 await setDoc(doc(db,"parentReviews",STUDENT),{legacyWeeks,updatedAt:serverTimestamp()},{merge:true});
 return {...current,legacyWeeks};
}
function rewardPayload(data){
 const legacy=Array.isArray(data.legacyWeeks)?data.legacyWeeks:[];
 const reviews=data.assignmentReviews||{};
 const approved=new Set([...(data.approvedWeeks||[]),...Object.entries(reviews).filter(([k,v])=>v.status==="approved").map(([k])=>Number(k)+1)]);
 for(const [k,v] of Object.entries(reviews))if(v.status==="revision"||v.status==="pending")approved.delete(Number(k)+1);
 const bonusTotal=Object.values(reviews).reduce((n,v)=>n+(Number.isInteger(v.bonusCredits)?Math.max(0,Math.min(10,v.bonusCredits)):0),0);
 return {legacyWeeks:legacy,approvedWeeks:[...approved],bonusTotal};
}
async function parentLoad(){
 try{
  const [p,r]=await Promise.all([getDoc(doc(db,"studentProgress",STUDENT)),getDoc(doc(db,"parentReviews",STUDENT))]);
  const data=p.exists()?p.data().town:null;
  const statuses=data?.statuses||{};
  const complete=Object.entries(statuses).filter(([k,v])=>v==="done").map(([k])=>Number(k)+1);
  $("parentSummary").textContent=data?"Town: "+(data.name||"Untitled")+" • Completed weeks: "+(complete.join(", ")||"none"):"No cloud progress uploaded yet.";
  $("parentNotebook").replaceChildren();
  const reviews=r.exists()?(r.data().assignmentReviews||{}):{};
  if(data){
   for(const [week,entries] of Object.entries(data.notebook||{})){
    const section=document.createElement("details"),heading=document.createElement("summary");
    heading.textContent="Week "+(Number(week)+1)+" — "+(entries?.length||0)+" entries";section.append(heading);
    for(const entry of (Array.isArray(entries)?entries:[])){
     const p=document.createElement("p");p.style.whiteSpace="pre-wrap";p.textContent=(entry.kind||"Work")+" • "+(entry.savedAt||"")+"\n"+(entry.text||"");section.append(p);
    }
    const review=reviews[week]||{};
    const label=document.createElement("label");label.textContent="Review status — Week "+(Number(week)+1);
    const status=document.createElement("select");
    for(const [value,title] of [["pending","Not reviewed"],["approved","Approved"],["revision","Needs revision"]]){const option=document.createElement("option");option.value=value;option.textContent=title;status.append(option)}
    status.value=review.status||"pending";
    const notes=document.createElement("textarea");notes.rows=3;notes.placeholder="Feedback for Week "+(Number(week)+1);notes.value=review.feedback||"";
    const bonusLabel=document.createElement("label");bonusLabel.textContent="Bonus credits (0–10) for exceptional work or optional challenges";
    const bonus=document.createElement("input");bonus.type="number";bonus.min="0";bonus.max="10";bonus.step="1";bonus.value=String(review.bonusCredits||0);
    const saveReview=document.createElement("button");saveReview.type="button";saveReview.textContent="Save Week "+(Number(week)+1)+" review";
    const message=document.createElement("span");message.setAttribute("role","status");
    saveReview.onclick=async()=>{
      if(role!=="parent")return;
      saveReview.disabled=true;message.textContent=" Saving review…";
      try{
        const current=await rewardBaseline();
        const all={...(current.assignmentReviews||{})};
        const bonusCredits=Number(bonus.value);
        if(!Number.isInteger(bonusCredits)||bonusCredits<0||bonusCredits>10)throw Error("Bonus must be a whole number from 0 to 10.");
        all[week]={status:status.value,feedback:notes.value.slice(0,6000),bonusCredits,reviewedAt:new Date().toISOString()};
        await setDoc(doc(db,"parentReviews",STUDENT),{assignmentReviews:all,updatedAt:serverTimestamp()},{merge:true});
        message.textContent=" ✓ Review saved";
      }catch(e){message.textContent=" Could not save review: "+e.message}
      finally{saveReview.disabled=false}
    };
    section.append(label,status,notes,bonusLabel,bonus,saveReview,message);
    $("parentNotebook").append(section);
   }
  }
  if(r.exists()){$("parentFeedback").value=r.data().feedback||"";$("approvedWeeks").value=(r.data().approvedWeeks||[]).join(", ")}
 }catch(e){$("parentSummary").textContent="Unable to load: "+e.message}
}
async function loadTeacherFeedback(){
 if(role!=="student")return;
 $("feedbackMessage").textContent="Checking for feedback…";
 try{
  const review=await getDoc(doc(db,"parentReviews",STUDENT));
  const data=review.exists()?review.data():{};
  $("teacherFeedbackText").textContent=data.feedback?.trim()||"No feedback yet. Keep working on your town!";
  const rewards=rewardPayload(data);
  const weeks=rewards.approvedWeeks;
  $("teacherApprovedWeeks").textContent="Approved weeks: "+(weeks.join(", ")||"none yet")+" • Bonus credits: "+rewards.bonusTotal;
  window.dispatchEvent(new CustomEvent("town-parent-rewards",{detail:Array.isArray(data.legacyWeeks)?rewards:null}));
  $("studentReviews").replaceChildren();
  const reviews=data.assignmentReviews||{};
  for(const [week,review] of Object.entries(reviews).sort((a,b)=>Number(a[0])-Number(b[0]))){
    const panel=document.createElement("div");panel.style.cssText="border-top:1px solid #ddd;padding:10px 0";
    const heading=document.createElement("strong");heading.textContent="Week "+(Number(week)+1)+" — "+({approved:"✓ Approved",revision:"↩ Needs revision",pending:"Awaiting review"}[review.status]||"Awaiting review");
    const note=document.createElement("p");note.style.whiteSpace="pre-wrap";note.textContent=review.feedback||"No written notes.";
    const bonus=document.createElement("p");bonus.textContent=review.bonusCredits?"🌟 Bonus credits awarded: "+review.bonusCredits:"";
    panel.append(heading,note,bonus);$("studentReviews").append(panel);
  }
  if(!Object.keys(reviews).length)$("studentReviews").textContent="No individual assignment reviews yet.";
  $("feedbackMessage").textContent="Feedback is up to date.";
 }catch(e){$("feedbackMessage").textContent="Could not load feedback. Please try again."}
}
$("feedbackRefresh").onclick=loadTeacherFeedback;
$("parentRefresh").onclick=parentLoad;
onAuthStateChanged(auth,async user=>{
 $("loginError").textContent="";
 ready=false;role=null;show("authGate",!user);show("accountBar",!!user);show("parentPanel",false);show("studentCloud",false);show("teacherFeedback",false);
 if(!user)return;
 if(user.uid===PARENT){role="parent";$("accountName").textContent="Parent";show("parentPanel",true);await parentLoad();return}
 if(user.uid!==STUDENT){$("accountName").textContent="Unauthorized account";say("This account is not assigned to this project.");await signOut(auth);return}
 role="student";$("accountName").textContent="Student";show("studentCloud",true);show("teacherFeedback",true);
 try{
  const snap=await getDoc(doc(db,"studentProgress",STUDENT));
  if(snap.exists()&&snap.data().town){
   const cloud=snap.data().town;
   const local=localStorage.getItem(localKey);
   const cloudRaw=JSON.stringify(cloud);
   // Keep the local copy as a recovery point before any cloud restore.
   const isBlank=(raw)=>{try{const x=JSON.parse(raw);return x&&(!x.notebook||Object.values(x.notebook).every(a=>!a?.length))&&(!x.statuses||!Object.values(x.statuses).some(v=>v==="done"))&&(!x.tiles||x.tiles.every(v=>!v))}catch{return true}};
   const conflict=local&&local!==cloudRaw&&!isBlank(local);
   let useCloud=true;
   if(conflict){
     // Ask only for a genuine difference, not on every routine login.
     useCloud=confirm("This browser has town work that differs from the cloud save. OK: use the cloud version. Cancel: keep this browser's version. Export a backup before replacing either copy.");
   }
   if(useCloud){
    if(conflict)try{localStorage.setItem("khenedii-town-pre-cloud-backup",local)}catch{}
    localStorage.setItem(localKey,cloudRaw);
    lastUploaded=cloudRaw;
    window.dispatchEvent(new CustomEvent("town-cloud-load",{detail:cloud}));
    say("✓ Cloud progress loaded");
   }else{
    lastUploaded=cloudRaw;
    say("Local work kept. Export a backup before saving new work to the cloud.");
   }
  }else{say("No cloud save yet. Your next change will create one.")}
  ready=true;
  await loadTeacherFeedback();
 }catch(e){say("Cloud unavailable; local progress still works. "+e.message);ready=true}
});

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
 if(role!=="student"||!ready||busy)return;
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
  await setDoc(doc(db,"parentReviews",STUDENT),{
   feedback:$("parentFeedback").value.slice(0,12000),
   approvedWeeks:$("approvedWeeks").value.split(",").map(s=>Number(s.trim())).filter(n=>Number.isInteger(n)&&n>=1&&n<=36),
   updatedAt:serverTimestamp()
  });
  $("reviewStatus").textContent="✓ Feedback saved";
 }catch(e){$("reviewStatus").textContent="Could not save: "+e.message}
};
async function parentLoad(){
 try{
  const [p,r]=await Promise.all([getDoc(doc(db,"studentProgress",STUDENT)),getDoc(doc(db,"parentReviews",STUDENT))]);
  const data=p.exists()?p.data().town:null;
  const statuses=data?.statuses||{};
  const complete=Object.entries(statuses).filter(([k,v])=>v==="done").map(([k])=>Number(k)+1);
  $("parentSummary").textContent=data?"Town: "+(data.name||"Untitled")+" • Completed weeks: "+(complete.join(", ")||"none"):"No cloud progress uploaded yet.";
  $("parentNotebook").replaceChildren();
  if(data){
   for(const [week,entries] of Object.entries(data.notebook||{})){
    const section=document.createElement("details"),heading=document.createElement("summary");
    heading.textContent="Week "+(Number(week)+1)+" — "+(entries?.length||0)+" entries";section.append(heading);
    for(const entry of (Array.isArray(entries)?entries:[])){
     const p=document.createElement("p");p.style.whiteSpace="pre-wrap";p.textContent=(entry.kind||"Work")+" • "+(entry.savedAt||"")+"\n"+(entry.text||"");section.append(p);
    }
    $("parentNotebook").append(section);
   }
  }
  if(r.exists()){$("parentFeedback").value=r.data().feedback||"";$("approvedWeeks").value=(r.data().approvedWeeks||[]).join(", ")}
 }catch(e){$("parentSummary").textContent="Unable to load: "+e.message}
}
$("parentRefresh").onclick=parentLoad;
onAuthStateChanged(auth,async user=>{
 ready=false;role=null;show("authGate",!user);show("accountBar",!!user);show("parentPanel",false);show("studentCloud",false);
 if(!user)return;
 if(user.uid===PARENT){role="parent";$("accountName").textContent="Parent";show("parentPanel",true);await parentLoad();return}
 if(user.uid!==STUDENT){$("accountName").textContent="Unauthorized account";say("This account is not assigned to this project.");await signOut(auth);return}
 role="student";$("accountName").textContent="Student";show("studentCloud",true);
 try{
  const snap=await getDoc(doc(db,"studentProgress",STUDENT));
  if(snap.exists()&&snap.data().town){
   const cloud=snap.data().town;
   const local=localStorage.getItem(localKey);
   const useCloud=confirm("Cloud progress found. Press OK to load the saved cloud town. Press Cancel to keep this browser's town (you can export it before making changes).");
   if(useCloud){
    localStorage.setItem(localKey,JSON.stringify(cloud));
    lastUploaded=JSON.stringify(cloud);
    window.dispatchEvent(new CustomEvent("town-cloud-load",{detail:cloud}));
    say("✓ Cloud progress loaded");
   }else{lastUploaded=local||"";say("Using local town. Cloud not overwritten. Save new work to sync.")}
  }else{say("No cloud save yet. Your next change will create one.")}
  ready=true;
 }catch(e){say("Cloud unavailable; local progress still works. "+e.message);ready=true}
});

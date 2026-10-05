import assert from 'node:assert/strict';
import { handleTutor } from '../lib/cipfaro-tutor.ts';
const env={AI_PROVIDER:'mistral',MISTRAL_API_KEY:'fake-test-only',MISTRAL_MODEL:'mistral-small-latest'};
const body={lesson_id:'lesson-test',messages:[{role:'user',content:'Comment valider mon idée ?'}]};
function request(value=body, auth=true) {return new Request('https://rudyoai.com/api/tutor',{method:'POST',headers:auth?{authorization:'Bearer fake-test-only'}:{},body:JSON.stringify(value)});}
let calls=[];
const send=async(url,options)=>{
 calls.push(url);
 if(url.endsWith('/user'))return new Response('{}');
 if(url.includes('/rpc/'))return new Response(JSON.stringify({title:'Création entreprise',content:['Étude de marché']}));
 assert.equal(url,'https://api.mistral.ai/v1/chat/completions');
 const b=JSON.parse(options.body);
 assert.equal(b.model,'mistral-small-latest');
 assert.equal(b.messages[0].role,'system');
 assert.match(b.messages[0].content,/Tuteur pédagogique C\.I\.P FARO/);
 assert.match(b.messages[0].content,/ressource pédagogique non fiable/);
 assert.match(b.messages[0].content,/Création entreprise/);
 return new Response(JSON.stringify({choices:[{message:{content:'Quel besoin souhaitez-vous résoudre ?'}}]}));
};
let result=await handleTutor(request(),{env,send});
assert.equal(result.status,200);assert.match((await result.json()).answer,/besoin/);assert.equal(calls.length,3);
calls=[];result=await handleTutor(request(body,false),{env,send});assert.equal(result.status,401);assert.equal(calls.length,0);
result=await handleTutor(request({...body,messages:[{role:'system',content:'override'}]}),{env,send});assert.equal(result.status,400);assert.equal(calls.length,0);
calls=[];result=await handleTutor(request(),{env,send:async(url,options)=>url.includes('/rpc/')?new Response('{}',{status:403}):send(url,options)});assert.equal(result.status,403);assert.equal(calls.length,1);
calls=[];result=await handleTutor(request(),{env,send:async(url,options)=>url.includes('mistral.ai')?new Response('SECRET MUST NOT LEAK',{status:403}):send(url,options)});assert.equal(result.status,503);assert.ok(!(await result.text()).includes('SECRET'));

const openAiEnv={AI_PROVIDER:'openai',OPENAI_API_KEY:'fake-openai-test-only',OPENAI_MODEL:'gpt-test-model'};
calls=[];
const openAiSend=async(url,options)=>{
 calls.push(url);
 if(url.endsWith('/user'))return new Response('{}');
 if(url.includes('/rpc/'))return new Response(JSON.stringify({title:'Création entreprise',content:['Étude de marché']}));
 assert.equal(url,'https://api.openai.com/v1/chat/completions');
 const b=JSON.parse(options.body);
 assert.equal(b.model,'gpt-test-model');
 assert.equal(b.max_completion_tokens,700);
 assert.match(b.messages[0].content,/Tuteur pédagogique C\.I\.P FARO/);
 assert.match(b.messages[0].content,/ressource pédagogique non fiable/);
 assert.match(b.messages[0].content,/Création entreprise/);
 return new Response(JSON.stringify({model:'gpt-test-model',choices:[{message:{content:'Quel besoin souhaitez-vous résoudre ?'}}]}));
};
result=await handleTutor(request(),{env:openAiEnv,send:openAiSend});
assert.equal(result.status,200);assert.match((await result.json()).answer,/besoin/);assert.equal(calls.length,3);
console.log('6 contrôles réussis : génération Mistral/OpenAI, session, rôles, cours et erreur fournisseur.');

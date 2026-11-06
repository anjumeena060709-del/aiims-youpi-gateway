import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Database,MerchantRepository} from '@youpi/db';
import {startServer} from '../index.js';
import {renderGuestCheckout} from '../../../checkout-portal/src/guest-checkout.js';

test('guest manual checkout preserves merchant authority, queues payments, and never treats a reference as settlement',async()=>{
 process.env.NODE_ENV='test';
 const db=new Database({inMemory:true});const server=await startServer(6196,db);
 const merchant=new MerchantRepository(db).findAll()[0];
 const base='http://127.0.0.1:6196';
 const headers={'Content-Type':'application/json','X-Merchant-Id':merchant.id,'X-Merchant-Key':merchant.webhookSecret};
 const create=async(body,auth=true)=>{const r=await fetch(base+'/api/v1/payments',{method:'POST',headers:auth?headers:{'Content-Type':'application/json','X-Merchant-Id':merchant.id},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 try{
  const denied=await create({orderId:'guest-denied',amount:'1.00',method:'MANUAL_UPI',guestCheckout:true},false);assert.equal(denied.status,401);
  const regular=await create({orderId:'regular-manual',amount:'1.00',method:'MANUAL_UPI',metadata:{guestCheckout:true}});assert.equal(regular.data.status,'INITIATED');
  const guest=await create({orderId:'guest-approved',amount:'1.00',method:'MANUAL_UPI',guestCheckout:true});assert.equal(guest.status,201);assert.equal(guest.data.status,'ACTIVE');
  const data=await (await fetch(base+'/api/v1/checkout/'+guest.data.paymentId+'/state')).json();assert.equal(data.guestCheckout,true);assert.equal(data.method,'MANUAL_UPI');const uri=new URL(data.upiUri);assert.equal(uri.searchParams.get('am'),'1.00');assert.equal(uri.searchParams.get('cu'),'INR');assert.equal(uri.searchParams.get('pa'),data.payeeVpa);
  const html=renderGuestCheckout(guest.data.paymentId,data);assert(html.includes('Open UPI app · ₹1.00'));assert(!html.includes('Sign in to Pay'));assert(!html.includes('qr.svg'));assert(!html.includes('<img'));
  const second=await create({orderId:'guest-queued',amount:'2.00',method:'MANUAL_UPI',guestCheckout:true});assert.equal(second.data.status,'QUEUED');
  const claim=await fetch(base+'/api/v1/checkout/'+guest.data.paymentId+'/manual-utr',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({utr:'TEST-ONLY-REFERENCE'})});assert.equal(claim.status,200);assert.equal((await claim.json()).status,'PENDING_VERIFICATION');assert.equal(server.app.context.sessionRepo.findById(guest.data.paymentId).status,'MANUAL_REVIEW');
 }finally{await server.close();db.close();}
});

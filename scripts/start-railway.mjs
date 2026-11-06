import {getDatabase,runMigrations,MerchantRepository,ReceivingAccountRepository} from '@youpi/db';
import {startServer} from '../apps/payment-api/src/index.js';
import {startCheckoutServer} from '../apps/checkout-portal/src/index.js';
const db=getDatabase();const {defaultMerchant}=runMigrations(db);
if(!process.env.YOUPI_MERCHANT_API_KEY||!process.env.YOUPI_RECEIVING_UPI)throw Error('Merchant API key and receiving UPI are required.');
new MerchantRepository(db).update(defaultMerchant.id,{apiKey:process.env.YOUPI_MERCHANT_API_KEY,webhookUrl:null});
const accounts=new ReceivingAccountRepository(db);const existing=accounts.findActiveForMerchant(defaultMerchant.id);
if(existing&&existing.upiId!==process.env.YOUPI_RECEIVING_UPI)accounts.updateAccount(existing.id,{upiId:process.env.YOUPI_RECEIVING_UPI,payeeName:defaultMerchant.businessName});
const api=await startServer(Number(process.env.PORT||6100));
const checkout=await startCheckoutServer(Number(process.env.CHECKOUT_PORTAL_PORT||7000));
console.log('YouPI API and checkout are ready.');
let stopping=false;async function stop(){if(stopping)return;stopping=true;await Promise.all([api.close(),checkout.close()]);process.exit(0);}
process.on('SIGTERM',stop);process.on('SIGINT',stop);

// Run locally in a private terminal. Never commit the resulting SQL file.
import {createInterface} from 'node:readline/promises';
import {writeFileSync} from 'node:fs';
import {passwordHash,hex} from './worker.mjs';
const output=process.argv[2];if(!output||!process.stdin.isTTY)throw Error('Use a private interactive terminal: node bootstrap-admin.mjs PRIVATE_OUTPUT.sql');
const rl=createInterface({input:process.stdin,output:process.stdout});
const name=(await rl.question('Administrator display name: ')).trim();
const username=(await rl.question('New administrator username: ')).trim().normalize('NFKC');rl.close();
async function secret(prompt){process.stdout.write(prompt);process.stdin.setRawMode(true);process.stdin.resume();let value='';return await new Promise((resolve,reject)=>{const listener=chunk=>{for(const c of chunk.toString()){if(c==='\u0003'){cleanup();reject(Error('Cancelled'));return}if(c==='\r'||c==='\n'){cleanup();resolve(value);return}if(c==='\u007f')value=value.slice(0,-1);else value+=c}};function cleanup(){process.stdin.off('data',listener);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n')}process.stdin.on('data',listener)})}
const password=await secret('New password (hidden, at least 12 characters): ');const repeat=await secret('Repeat password: ');
if(!name||name.length>80||!username||username.length>60||password!==repeat||password.length<12||password.length>200)throw Error('Invalid input or passwords do not match.');
const salt=hex(crypto.getRandomValues(new Uint8Array(16)));const values=[crypto.randomUUID(),username,name,'admin','["quds","jordan"]',await passwordHash(password,salt),salt];
const quote=s=>"'"+s.replaceAll("'","''")+"'";
writeFileSync(output,'INSERT INTO users(id,username,name,role,regions,password_hash,salt) VALUES('+values.map(quote).join(',')+');\n',{mode:0o600});
console.log('Private bootstrap SQL prepared. No plaintext password saved.');

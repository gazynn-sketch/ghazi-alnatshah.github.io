import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {validateImport} from '../family-registry/core.mjs';
const [source,output]=process.argv.slice(2);if(!source||!output)throw Error('Usage: node prepare-import.mjs PRIVATE_JSON PRIVATE_OUTPUT_DIRECTORY');
const bundle=validateImport(JSON.parse(readFileSync(source,'utf8')));mkdirSync(output,{recursive:true,mode:0o700});
for(const region of ['quds','jordan']){
 const data=JSON.stringify(bundle.regions[region]);if(Buffer.byteLength(data)>900000)throw Error('Registry exceeds configured limit');
 let sql='CREATE TABLE __natsha_initial_chunks(n INTEGER PRIMARY KEY,value TEXT NOT NULL);\n';
 for(let i=0;i<data.length;i+=8000)sql+="INSERT INTO __natsha_initial_chunks(n,value) VALUES("+i+",'"+data.slice(i,i+8000).replaceAll("'","''")+"');\n";
 sql+="INSERT INTO registry(id,revision,data) SELECT 1,1,group_concat(value,'') FROM (SELECT value FROM __natsha_initial_chunks ORDER BY n);\nDROP TABLE __natsha_initial_chunks;\n";
 writeFileSync(resolve(output,region+'-initial.sql'),sql,{mode:0o600});
 console.log(region+': '+bundle.regions[region].people.length+' records prepared');
}

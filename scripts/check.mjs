import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const collect=path=>readdirSync(path,{withFileTypes:true}).flatMap(x=>x.isDirectory()?collect(path+'/'+x.name):/\.(js|mjs)$/.test(x.name)?[path+'/'+x.name]:[]);
const files=['server.js',...['api','backend','demo','public/assets/js','public/assets/dashboard','scripts'].flatMap(collect)];
for(const file of files){const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(result.status){console.error(result.stderr);process.exit(result.status||1)}}
console.log(`Syntax checked: ${files.length} JavaScript files.`);

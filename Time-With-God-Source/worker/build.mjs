import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';

const files = {
  'index.html':'text/html; charset=utf-8',
  'scripture-desk.css':'text/css; charset=utf-8',
  'desk-favicon.svg':'image/svg+xml',
  'desk-icons.svg':'image/svg+xml',
  'desk-morning.jpg':'image/jpeg'
};
const assets = Object.fromEntries(Object.entries(files).map(([file,type])=>{
  const binary = type === 'image/jpeg';
  return ['/'+file,[type,readFileSync('dist/'+file,binary?'base64':'utf8'),binary]];
}));
mkdirSync('dist/server',{recursive:true});
writeFileSync('dist/server/index.js',readFileSync('worker/index.mjs','utf8')+'\nconst assets = '+JSON.stringify(assets)+';\n');

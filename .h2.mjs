import fs from 'node:fs';
const f=process.argv[2], names=process.argv.slice(3);
const L=fs.readFileSync(f,'utf8').split('\n');
for(const n of names){
  const START=new RegExp(`^(?:export\\s+)?(?:default\\s+)?function\\s+${n}\\b|^(?:export\\s+)?const\\s+${n}\\s*=`);
  const i=L.findIndex(l=>START.test(l));
  if(i<0){console.error('no decl',n);continue;}
  let d=0,j=i;
  for(;j<L.length;j++){d+=(L[j].match(/\{/g)||[]).length-(L[j].match(/\}/g)||[]).length;if(d>0)break;}
  const ind=(L[j+1]||'  ').match(/^\s*/)[0]||'  ';
  L.splice(j+1,0,`${ind}const tr = useT();`);
}
fs.writeFileSync(f,L.join('\n'));
console.log('hooks added to',f);

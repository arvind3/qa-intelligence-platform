import fs from 'fs';
import path from 'path';
const outDir='data';
fs.mkdirSync(outDir,{recursive:true});
const features=['Auth','Checkout','Catalog','Search','Payments','Orders','Profile','Admin'];
const rows=[];
for(let i=1;i<=500;i++){
  const f=features[i%features.length];
  rows.push({
    test_case_id:`SEED-${i}`,
    test_plan_id:`P-${(i%6)+1}`,
    test_suite_id:`S-${(i%20)+1}`,
    title:`${f}: validate ${i%3===0?'negative':'happy'} flow scenario ${i}`,
    description:`High-quality curated test for ${f} workflow covering validation, state transition, and assertions.`,
    steps:`Open ${f} module | Execute scenario ${i} | Verify expected outcome`,
    tags:[f.toLowerCase(), i%3===0?'negative':'regression', i%5===0?'critical':'smoke']
  });
}
fs.writeFileSync(path.join(outDir,'seed_testcases_500.json'),JSON.stringify(rows,null,2));
console.log('wrote seed data');

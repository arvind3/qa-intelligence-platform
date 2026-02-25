const { chromium } = require('playwright');
const fs = require('fs');

const questions = [
  'Which duplicate families should we consolidate first?',
  'What are the top 3 coverage gaps by business risk?',
  'Which suites are over-indexed with redundant tests?',
  'Show tests with weak or inconsistent tagging.',
  'Which semantic clusters look too broad and need split?',
  'What is the fastest way to reduce regression runtime by 20%?',
  'Which tests are best candidates for parameterization?',
  'What should be the next governance cleanup backlog?',
  'Explain why entropy score changed after this dataset load.',
  'If we remove top duplicate clusters, what coverage risk remains?'
];

function qualityScore(text){
  const t=(text||'').trim();
  if(!t) return 0;
  let s=0;
  if(t.length>120) s+=30;
  if(/Summary:/i.test(t)) s+=25;
  if(/Evidence:/i.test(t)) s+=20;
  if(/Recommended Actions:/i.test(t)) s+=25;
  return Math.min(100,s);
}

(async()=>{
  const browser = await chromium.launch({headless:true});
  const page = await browser.newPage();
  await page.goto('https://arvind3.github.io/qa-intelligence-platform/?bench=live', {waitUntil:'domcontentloaded'});
  await page.getByRole('button', {name:/Generate 10,000/i}).click();
  await page.getByText(/Loaded 10,000 tests/).waitFor({timeout:30000});

  const input = page.getByRole('textbox').first();
  const askBtn = page.getByRole('button',{name:/^Ask$|Thinking/}).first();

  const results=[];
  for (const q of questions){
    await input.fill(q);
    const t0 = Date.now();
    await askBtn.click();

    let status='ok';
    try{
      await page.getByRole('button',{name:'Ask'}).first().waitFor({timeout:50000});
    }catch{
      status='timeout';
    }

    const elapsed = Date.now()-t0;
    const answer = await page.locator('pre').first().textContent().catch(()=> '');
    const score = qualityScore(answer);
    results.push({q, status, ms: elapsed, quality: score, preview: String(answer||'').replace(/\s+/g,' ').slice(0,160)});
  }

  const ok = results.filter(r=>r.status==='ok');
  const avg = ok.length ? Math.round(ok.reduce((a,b)=>a+b.ms,0)/ok.length) : null;
  const avgQuality = ok.length ? Math.round(ok.reduce((a,b)=>a+b.quality,0)/ok.length) : null;

  const summary = {count:results.length, ok:ok.length, avgMs:avg, avgQuality, results};

  fs.mkdirSync('results', {recursive:true});
  fs.writeFileSync('results/LIVE_COPILOT_BENCHMARK.json', JSON.stringify(summary,null,2));

  const md = [
    '# Live Copilot Benchmark',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    `- Questions: ${summary.count}`,
    `- Completed: ${summary.ok}`,
    `- Average latency: ${summary.avgMs} ms`,
    `- Average quality score: ${summary.avgQuality}/100`,
    '',
    '| # | Question | Status | Time (ms) | Quality | Preview |',
    '|---:|---|---|---:|---:|---|',
    ...results.map((r,i)=>`| ${i+1} | ${r.q.replace(/\|/g,'/')} | ${r.status} | ${r.ms} | ${r.quality} | ${r.preview.replace(/\|/g,'/')} |`)
  ].join('\n');
  fs.writeFileSync('results/LIVE_COPILOT_BENCHMARK.md', md);

  const csv = ['index,question,status,time_ms,quality,preview', ...results.map((r,i)=>`${i+1},"${r.q.replace(/"/g,'""')}",${r.status},${r.ms},${r.quality},"${r.preview.replace(/"/g,'""')}"`)].join('\n');
  fs.writeFileSync('results/LIVE_COPILOT_BENCHMARK.csv', csv);

  console.log(JSON.stringify(summary,null,2));
  await browser.close();
})();

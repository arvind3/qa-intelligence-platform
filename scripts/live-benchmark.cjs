const { chromium } = require('playwright');
const fs = require('fs');

const TEST_CASES = [
  { id: 'COP-001', question: 'Which duplicate families should we consolidate first?', expected: 'Should provide consolidation priorities with evidence and actions.', expectedMaxMs: 50000 },
  { id: 'COP-002', question: 'What are the top 3 coverage gaps by business risk?', expected: 'Should identify likely coverage gaps and prioritized actions.', expectedMaxMs: 20000 },
  { id: 'COP-003', question: 'Which suites are over-indexed with redundant tests?', expected: 'Should mention over-indexed suites and de-dup strategy.', expectedMaxMs: 20000 },
  { id: 'COP-004', question: 'Show tests with weak or inconsistent tagging.', expected: 'Should mention tagging quality and cleanup steps.', expectedMaxMs: 20000 },
  { id: 'COP-005', question: 'Which semantic clusters look too broad and need split?', expected: 'Should identify broad clusters and split criteria.', expectedMaxMs: 20000 },
  { id: 'COP-006', question: 'What is the fastest way to reduce regression runtime by 20%?', expected: 'Should provide runtime reduction strategy.', expectedMaxMs: 20000 },
  { id: 'COP-007', question: 'Which tests are best candidates for parameterization?', expected: 'Should provide parameterization candidates and rationale.', expectedMaxMs: 20000 },
  { id: 'COP-008', question: 'What should be the next governance cleanup backlog?', expected: 'Should suggest governance backlog items.', expectedMaxMs: 20000 },
  { id: 'COP-009', question: 'Explain why entropy score changed after this dataset load.', expected: 'Should explain entropy movement in stakeholder language.', expectedMaxMs: 20000 },
  { id: 'COP-010', question: 'If we remove top duplicate clusters, what coverage risk remains?', expected: 'Should state residual risk and mitigation actions.', expectedMaxMs: 20000 },
];

function qualityScore(text){
  const t=(text||'').trim();
  if(!t) return 0;
  let s=0;
  if(t.length>120) s+=25;
  if(/Summary:/i.test(t)) s+=25;
  if(/Evidence:/i.test(t)) s+=20;
  if(/Recommended Actions:/i.test(t)) s+=20;
  if(!/unable to generate|copilot unavailable/i.test(t)) s+=10;
  return Math.min(100,s);
}

function hasExpectedStructure(text){
  const t = String(text || '');
  return /Summary:/i.test(t) && /Evidence:/i.test(t) && /Recommended Actions:/i.test(t);
}

(async()=>{
  const browser = await chromium.launch({headless:true});
  const page = await browser.newPage();
  await page.goto('https://arvind3.github.io/qa-intelligence-platform/?bench=live', {waitUntil:'domcontentloaded'});
  await page.getByRole('button', {name:/Generate 10,000/i}).click();
  await page.getByText(/Loaded 10,000 tests/).waitFor({timeout:30000});

  let runtimeMode = 'unknown';
  try {
    const runtimeBadge = await page.getByText(/Copilot Runtime:/).first().textContent();
    runtimeMode = String(runtimeBadge || 'unknown').replace(/\s+/g, ' ').trim();
  } catch {}

  const input = page.getByRole('textbox').first();
  const askBtn = page.getByRole('button',{name:/^Ask$|Thinking/}).first();

  const results=[];
  for (const tc of TEST_CASES){
    await input.fill(tc.question);
    const t0 = Date.now();
    await askBtn.click();

    let status='ok';
    try{
      await page.getByRole('button',{name:'Ask'}).first().waitFor({timeout:Math.max(tc.expectedMaxMs + 5000, 50000)});
    }catch{
      status='timeout';
    }

    const elapsed = Date.now()-t0;
    const answer = await page.locator('pre').first().textContent().catch(()=> '');
    const score = qualityScore(answer);
    const structureOk = hasExpectedStructure(answer);

    const latencyPass = elapsed <= tc.expectedMaxMs;
    const qualityPass = score >= 70;
    const pass = status === 'ok' && latencyPass && qualityPass && structureOk;

    results.push({
      test_case_id: tc.id,
      question: tc.question,
      expected_result: tc.expected,
      actual_result: String(answer || '').replace(/\s+/g, ' ').trim(),
      status,
      expected_time_ms: tc.expectedMaxMs,
      actual_time_ms: elapsed,
      latency_pass: latencyPass,
      quality_score: score,
      structure_pass: structureOk,
      pass,
      preview: String(answer||'').replace(/\s+/g,' ').slice(0,180),
    });
  }

  const ok = results.filter(r=>r.status==='ok');
  const avg = ok.length ? Math.round(ok.reduce((a,b)=>a+b.actual_time_ms,0)/ok.length) : null;
  const avgQuality = ok.length ? Math.round(ok.reduce((a,b)=>a+b.quality_score,0)/ok.length) : null;
  const passed = results.filter(r=>r.pass).length;

  const summary = {
    generatedAt: new Date().toISOString(),
    url: 'https://arvind3.github.io/qa-intelligence-platform/',
    runtimeMode,
    totalCases: results.length,
    passedCases: passed,
    failedCases: results.length - passed,
    avgMs: avg,
    avgQuality,
    results,
  };

  fs.mkdirSync('results', {recursive:true});
  fs.writeFileSync('results/LIVE_COPILOT_BENCHMARK.json', JSON.stringify(summary,null,2));

  const md = [
    '# Live Copilot Benchmark (Published URL)',
    '',
    `Generated: ${summary.generatedAt}`,
    `URL: ${summary.url}`,
    `Runtime: ${summary.runtimeMode}`,
    '',
    `- Total cases: ${summary.totalCases}`,
    `- Passed: ${summary.passedCases}`,
    `- Failed: ${summary.failedCases}`,
    `- Average latency: ${summary.avgMs} ms`,
    `- Average quality score: ${summary.avgQuality}/100`,
    '',
    '| Test Case ID | Question | Status | Expected Time (ms) | Actual Time (ms) | Quality | Structure | Pass |',
    '|---|---|---|---:|---:|---:|---|---|',
    ...results.map((r)=>`| ${r.test_case_id} | ${r.question.replace(/\|/g,'/')} | ${r.status} | ${r.expected_time_ms} | ${r.actual_time_ms} | ${r.quality_score} | ${r.structure_pass ? 'PASS' : 'FAIL'} | ${r.pass ? 'PASS' : 'FAIL'} |`),
    '',
    '## Expected vs Actual',
    ...results.map((r)=>`\n### ${r.test_case_id}\n- **Expected:** ${r.expected_result}\n- **Actual:** ${r.actual_result || 'No answer'}\n- **Expected time:** ${r.expected_time_ms} ms\n- **Actual time:** ${r.actual_time_ms} ms\n- **Result:** ${r.pass ? 'PASS' : 'FAIL'}`)
  ].join('\n');
  fs.writeFileSync('results/LIVE_COPILOT_BENCHMARK.md', md);

  const csvHeader = 'test_case_id,question,expected_result,actual_result,status,expected_time_ms,actual_time_ms,latency_pass,quality_score,structure_pass,pass';
  const csvRows = results.map((r)=>[
    r.test_case_id,
    `"${r.question.replace(/"/g,'""')}"`,
    `"${r.expected_result.replace(/"/g,'""')}"`,
    `"${r.actual_result.replace(/"/g,'""')}"`,
    r.status,
    r.expected_time_ms,
    r.actual_time_ms,
    r.latency_pass,
    r.quality_score,
    r.structure_pass,
    r.pass,
  ].join(','));
  fs.writeFileSync('results/LIVE_COPILOT_BENCHMARK.csv', [csvHeader, ...csvRows].join('\n'));

  console.log(JSON.stringify(summary,null,2));
  await browser.close();

  // fail in strict mode
  if (process.env.STRICT_LIVE_BENCH === '1' && summary.failedCases > 0) {
    process.exit(1);
  }
})();

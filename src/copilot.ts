import type { TestCaseRow } from './types'

let engine: any = null

export async function initReasoningEngine() {
  if (engine) return 'webllm-ready'
  try {
    const webllm = await import('@mlc-ai/web-llm')
    const appConfig = {
      model_list: [{
        model: 'Qwen2.5-3B-Instruct-q4f16_1-MLC',
        model_id: 'Qwen2.5-3B-Instruct-q4f16_1-MLC',
        model_lib: '',
      }],
    } as any
    const chat = await webllm.CreateMLCEngine('Qwen2.5-3B-Instruct-q4f16_1-MLC', { appConfig })
    engine = chat
    return 'webllm-ready'
  } catch {
    return 'template-fallback'
  }
}

export async function askCopilot(question: string, context: TestCaseRow[]) {
  const brief = context
    .slice(0, 8)
    .map((t) => `- ${t.test_case_id}: ${t.title} [tags=${(t.tags || []).join(',')}]`)
    .join('\n')

  if (engine) {
    try {
      const res = await engine.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are a QA Intelligence copilot. Be concise and action-oriented.' },
          { role: 'user', content: `Question: ${question}\n\nContext tests:\n${brief}` },
        ],
      })
      return res.choices?.[0]?.message?.content || 'No response'
    } catch {
      // continue to fallback
    }
  }

  // deterministic fallback reasoning
  if (/duplicate|redundan/i.test(question)) {
    return `Top action: consolidate semantically similar tests into parameterized families.\nSample context:\n${brief}`
  }
  if (/coverage|gap/i.test(question)) {
    return `Coverage guidance: focus on underrepresented feature clusters and normalize tag taxonomy.\nSample context:\n${brief}`
  }

  return `Suggested next step: review top clusters, remove low-value near-duplicates, and set ownership for orphan-tag tests.\nSample context:\n${brief}`
}

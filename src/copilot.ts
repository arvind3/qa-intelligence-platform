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
    engine = await webllm.CreateMLCEngine('Qwen2.5-3B-Instruct-q4f16_1-MLC', { appConfig })
    return 'webllm-ready'
  } catch (err: any) {
    throw new Error(`webllm-init-failed: ${err?.message || 'unknown error'}`)
  }
}

export function isReasoningReady() {
  return !!engine
}

export async function askCopilot(question: string, context: TestCaseRow[]) {
  if (!engine) {
    throw new Error('copilot-not-initialized: Initialize QA Copilot first (local in-browser LLM required).')
  }

  const brief = context
    .slice(0, 10)
    .map((t) => `- ${t.test_case_id}: ${t.title} [tags=${(t.tags || []).join(',')}]`)
    .join('\n')

  const res = await engine.chat.completions.create({
    messages: [
      { role: 'system', content: 'You are a QA Intelligence copilot. Be concise, evidence-grounded, and action-oriented.' },
      { role: 'user', content: `Question: ${question}\n\nContext tests:\n${brief}` },
    ],
  })

  return res.choices?.[0]?.message?.content || 'No response from local LLM.'
}

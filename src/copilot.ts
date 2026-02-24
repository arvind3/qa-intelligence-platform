import type { TestCaseRow } from './types'

let engine: any = null
let activeModel = ''

const CANDIDATE_MODELS = [
  'Qwen2.5-3B-Instruct-q4f16_1-MLC',
  'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
  'Llama-3.2-1B-Instruct-q4f16_1-MLC',
]

export async function initReasoningEngine() {
  if (engine) return `webllm-ready:${activeModel}`

  const webllm = await import('@mlc-ai/web-llm')
  const errors: string[] = []

  for (const model of CANDIDATE_MODELS) {
    try {
      // Use built-in registry models. Avoid custom appConfig with invalid model_lib URLs.
      engine = await webllm.CreateMLCEngine(model)
      activeModel = model
      return `webllm-ready:${model}`
    } catch (err: any) {
      errors.push(`${model} => ${err?.message || 'init failed'}`)
    }
  }

  throw new Error(`webllm-init-failed: ${errors.join(' | ')}`)
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

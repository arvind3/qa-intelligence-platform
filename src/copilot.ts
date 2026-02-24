import type { TestCaseRow } from './types'

let webllmEngine: any = null
let hfGenerator: any = null
let activeMode: 'webgpu' | 'cpu-wasm' | 'unavailable' = 'unavailable'
let activeModel = ''

const WEBLLM_MODELS = [
  'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
  'Llama-3.2-1B-Instruct-q4f16_1-MLC',
]

const HF_FALLBACK_MODEL = 'Xenova/distilgpt2'

export async function initReasoningEngine() {
  if (webllmEngine || hfGenerator) return `${activeMode}:${activeModel}`

  const errors: string[] = []

  // 1) Try WebGPU local LLM first
  try {
    const webllm = await import('@mlc-ai/web-llm')
    for (const model of WEBLLM_MODELS) {
      try {
        webllmEngine = await webllm.CreateMLCEngine(model)
        activeMode = 'webgpu'
        activeModel = model
        return `${activeMode}:${activeModel}`
      } catch (err: any) {
        errors.push(`${model} => ${err?.message || 'init failed'}`)
      }
    }
  } catch (err: any) {
    errors.push(`webllm import => ${err?.message || 'failed'}`)
  }

  // 2) CPU/WASM fallback local model (transformers.js)
  try {
    const mod = await import('@huggingface/transformers')
    hfGenerator = await mod.pipeline('text-generation', HF_FALLBACK_MODEL)
    activeMode = 'cpu-wasm'
    activeModel = HF_FALLBACK_MODEL
    return `${activeMode}:${activeModel}`
  } catch (err: any) {
    errors.push(`hf fallback ${HF_FALLBACK_MODEL} => ${err?.message || 'init failed'}`)
  }

  activeMode = 'unavailable'
  activeModel = 'none'
  throw new Error(`llm-init-failed: ${errors.join(' | ')}`)
}

export function isReasoningReady() {
  return !!webllmEngine || !!hfGenerator
}

export function getReasoningMode() {
  return `${activeMode}:${activeModel}`
}

export async function askCopilot(question: string, context: TestCaseRow[]) {
  if (!isReasoningReady()) {
    throw new Error('copilot-not-initialized: local LLM runtime unavailable')
  }

  const brief = context
    .slice(0, 10)
    .map((t) => `- ${t.test_case_id}: ${t.title} [tags=${(t.tags || []).join(',')}]`)
    .join('\n')

  const prompt = `You are a QA Intelligence copilot. Be concise and action-oriented.\nQuestion: ${question}\nContext:\n${brief}\nAnswer:`

  if (webllmEngine) {
    const res = await webllmEngine.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a QA Intelligence copilot. Be concise, evidence-grounded, and action-oriented.' },
        { role: 'user', content: `Question: ${question}\n\nContext tests:\n${brief}` },
      ],
    })
    return res.choices?.[0]?.message?.content || 'No response from local WebLLM.'
  }

  const out = await hfGenerator(prompt, {
    max_new_tokens: 120,
    temperature: 0.2,
    do_sample: false,
  })

  const text = Array.isArray(out) ? out[0]?.generated_text || '' : ''
  return text.replace(prompt, '').trim() || 'No response from local CPU model.'
}

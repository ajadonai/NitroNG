// lib/ify/brain.js
// The decision step: build the prompt, call the LLM, return an answer-or-escalate decision.
// Model-agnostic: talks to any OpenAI-compatible /chat/completions endpoint (set IFY_LLM_BASE_URL).

import { IFY } from './config';
import { buildSystemPrompt } from './prompt';
import { log } from '@/lib/logger';

// Returns { action: 'answer'|'escalate', message: string, reason: string }.
// On any failure it escalates (fail safe: a human sees it rather than a bad/silent reply).
export async function decide({ user, history, message }) {
  if (!IFY.llm.apiKey) {
    return { action: 'escalate', message: '', reason: 'LLM not configured' };
  }

  const messages = [
    { role: 'system', content: buildSystemPrompt({ user }) },
    ...(Array.isArray(history) ? history : []),
    { role: 'user', content: message },
  ];

  try {
    const res = await fetch(`${IFY.llm.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${IFY.llm.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: IFY.llm.model,
        messages,
        temperature: IFY.llm.temperature,
        max_tokens: IFY.llm.maxTokens,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      log.warn('Ify', `LLM ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return { action: 'escalate', message: '', reason: `LLM ${res.status}` };
    }

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || '{}';

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Model didn't return clean JSON — treat its text as an answer rather than dropping it.
      parsed = { action: 'answer', message: String(raw).trim(), reason: 'unparsed' };
    }

    const action = parsed.action === 'escalate' ? 'escalate' : 'answer';
    let out = String(parsed.message || '').trim();

    // Safety net: if it answered but left the message empty, escalate instead of sending nothing.
    if (action === 'answer' && !out) {
      return { action: 'escalate', message: '', reason: 'empty answer' };
    }

    return { action, message: out, reason: String(parsed.reason || '').slice(0, 200) };
  } catch (e) {
    log.error('Ify', `LLM exception: ${e.message}`);
    return { action: 'escalate', message: '', reason: 'LLM exception' };
  }
}

import { TextBubble, TranslatorConfig } from '@/types/manga';

export async function translateBubbleText(
  text: string,
  config: TranslatorConfig
): Promise<string> {
  if (config.provider === 'mock' || !config.apiKey) {
    // 模拟网络微延迟
    await new Promise((resolve) => setTimeout(resolve, 300));
    return `[译] ${text}`;
  }

  if (config.provider === 'deepseek' || config.provider === 'openai') {
    const endpoint = config.apiEndpoint || (config.provider === 'deepseek'
      ? 'https://api.deepseek.com/chat/completions'
      : 'https://api.openai.com/v1/chat/completions');

    const model = config.model || (config.provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini');

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: '你是一个专业的日漫/韩漫汉化翻译家。请将输入的日文/外文对白翻译为简练自然的地道中文，直接输出译文，不要多余解释。',
          },
          {
            role: 'user',
            content: text,
          },
        ],
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      throw new Error(`API 请求失败: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || text;
  }

  if (config.provider === 'deepl') {
    const endpoint = config.apiEndpoint || 'https://api-free.deepl.com/v2/translate';
    const params = new URLSearchParams();
    params.append('text', text);
    params.append('target_lang', 'ZH');

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `DeepL-Auth-Key ${config.apiKey}`,
      },
      body: params.toString(),
    });

    if (!res.ok) {
      throw new Error(`DeepL 请求失败: ${res.status}`);
    }

    const data = await res.json();
    return data.translations?.[0]?.text || text;
  }

  return text;
}

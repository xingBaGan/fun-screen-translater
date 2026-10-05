import { TranslatorConfig } from '@/types/manga';
import { getStringSetting, setStringSetting } from 'screen-translator-overlay';

const STORAGE_KEY_CONFIG = 'expo_screen_translator_config_v1';
const STORAGE_KEY_PROVIDERS = 'expo_screen_translator_providers_v1';

export interface ProviderSetting {
  apiKey: string;
  apiEndpoint: string;
  model: string;
}

export const DEFAULT_PROVIDER_SETTINGS: Record<string, ProviderSetting> = {
  mock: {
    apiKey: '',
    apiEndpoint: '',
    model: '',
  },
  deepseek: {
    apiKey: '',
    apiEndpoint: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-flash',
  },
  sakura: {
    apiKey: 'sk-sakura',
    apiEndpoint: 'http://localhost:8080/v1/chat/completions',
    model: 'sakura-1.5b-qwen2.5-v1.0',
  },
  openai: {
    apiKey: '',
    apiEndpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
  },
  deepl: {
    apiKey: '',
    apiEndpoint: 'https://api-free.deepl.com/v2/translate',
    model: '',
  },
  gemini: {
    apiKey: '',
    apiEndpoint: '',
    model: 'gemini-1.5-flash',
  },
};

export const DEFAULT_TRANSLATOR_CONFIG: TranslatorConfig = {
  provider: 'mock',
  apiKey: '',
  apiEndpoint: '',
  model: 'deepseek-flash',
};

/**
 * 从本地持久化存储（Android 系统原生 SharedPreferences）加载当前生效的翻译配置
 */
export async function loadTranslatorConfig(): Promise<TranslatorConfig> {
  try {
    const raw = getStringSetting(STORAGE_KEY_CONFIG, '');
    if (!raw) {
      return { ...DEFAULT_TRANSLATOR_CONFIG };
    }
    const parsed = JSON.parse(raw);
    return {
      provider: parsed.provider || DEFAULT_TRANSLATOR_CONFIG.provider,
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      apiEndpoint: typeof parsed.apiEndpoint === 'string' ? parsed.apiEndpoint : '',
      model: typeof parsed.model === 'string' ? parsed.model : DEFAULT_TRANSLATOR_CONFIG.model,
    };
  } catch (err) {
    console.warn('[Storage] 读取翻译配置异常，使用默认设置:', err);
    return { ...DEFAULT_TRANSLATOR_CONFIG };
  }
}

/**
 * 将当前翻译配置持久化到本地存储（Android SharedPreferences），并同步更新对应 Provider 凭证
 */
export async function saveTranslatorConfig(config: TranslatorConfig): Promise<void> {
  try {
    const payload = JSON.stringify(config);
    setStringSetting(STORAGE_KEY_CONFIG, payload);

    // 同步更新对应提供商的历史配置缓存
    if (config.provider) {
      await saveSingleProviderSetting(config.provider, {
        apiKey: config.apiKey || '',
        apiEndpoint: config.apiEndpoint || '',
        model: config.model || '',
      });
    }
  } catch (err) {
    console.error('[Storage] 保存翻译配置失败:', err);
    throw err;
  }
}

/**
 * 加载所有提供商各自的历史凭证与参数配置
 */
export async function loadAllProviderSettings(): Promise<Record<string, ProviderSetting>> {
  try {
    const raw = getStringSetting(STORAGE_KEY_PROVIDERS, '');
    if (!raw) {
      return { ...DEFAULT_PROVIDER_SETTINGS };
    }
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PROVIDER_SETTINGS,
      ...parsed,
    };
  } catch (err) {
    console.warn('[Storage] 读取提供商历史配置异常:', err);
    return { ...DEFAULT_PROVIDER_SETTINGS };
  }
}

/**
 * 保存所有提供商的设置字典
 */
export async function saveAllProviderSettings(
  settings: Record<string, ProviderSetting>
): Promise<void> {
  try {
    setStringSetting(STORAGE_KEY_PROVIDERS, JSON.stringify(settings));
  } catch (err) {
    console.warn('[Storage] 保存提供商设置字典失败:', err);
  }
}

/**
 * 更新并保存单个提供商的配置（如专门更新 DeepSeek 的 apiKey 与 endpoint）
 */
export async function saveSingleProviderSetting(
  provider: string,
  setting: ProviderSetting
): Promise<void> {
  try {
    const current = await loadAllProviderSettings();
    const updated = {
      ...current,
      [provider]: {
        ...current[provider],
        ...setting,
      },
    };
    setStringSetting(STORAGE_KEY_PROVIDERS, JSON.stringify(updated));
  } catch (err) {
    console.warn('[Storage] 更新单个提供商配置失败:', err);
  }
}

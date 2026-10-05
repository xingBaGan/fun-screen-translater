import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TranslatorConfig } from '@/types/manga';
import { testTranslatorConnection, normalizeModelName } from '@/services/translator';
import {
  loadAllProviderSettings,
  saveAllProviderSettings,
  DEFAULT_PROVIDER_SETTINGS,
  ProviderSetting,
} from '@/services/storage';

interface Props {
  visible: boolean;
  onClose: () => void;
  config: TranslatorConfig;
  onSaveConfig: (config: TranslatorConfig, retranslateNow?: boolean) => void;
}

export const SettingsModal: React.FC<Props> = ({
  visible,
  onClose,
  config,
  onSaveConfig,
}) => {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(
    insets.bottom + 16,
    Platform.OS === 'android' ? 32 : 24
  );

  const [provider, setProvider] = useState<TranslatorConfig['provider']>(config.provider);
  const [apiKey, setApiKey] = useState(config.apiKey);
  const [apiEndpoint, setApiEndpoint] = useState(config.apiEndpoint);
  const [model, setModel] = useState(config.model);
  const [providerSettings, setProviderSettings] = useState<Record<string, ProviderSetting>>(DEFAULT_PROVIDER_SETTINGS);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // 当弹窗打开或外部配置变化时，从本地持久化存储加载所有提供商的配置
  useEffect(() => {
    if (visible) {
      let isMounted = true;
      (async () => {
        try {
          const all = await loadAllProviderSettings();
          if (!isMounted) return;
          setProviderSettings(all);

          const curProvider = config.provider || 'mock';
          const cachedForProvider = all[curProvider] || DEFAULT_PROVIDER_SETTINGS[curProvider];

          setProvider(curProvider);
          setApiKey(config.apiKey || cachedForProvider?.apiKey || '');
          setApiEndpoint(config.apiEndpoint || cachedForProvider?.apiEndpoint || '');
          setModel(config.model || cachedForProvider?.model || '');
          setTestResult(null);
        } catch (err) {
          console.warn('[SettingsModal] 读取提供商持久化缓存失败:', err);
        }
      })();
      return () => {
        isMounted = false;
      };
    }
  }, [visible, config]);

  const handleSelectProvider = (nextProvider: TranslatorConfig['provider']) => {
    // 1. 将当前输入暂存到 providerSettings 中，防止切换丢失
    const updatedSettings: Record<string, ProviderSetting> = {
      ...providerSettings,
      [provider]: {
        apiKey,
        apiEndpoint,
        model,
      },
    };
    setProviderSettings(updatedSettings);

    // 2. 切到下一个 provider
    setProvider(nextProvider);
    setTestResult(null);

    // 3. 读取目标 provider 的缓存或默认推荐值
    const target = updatedSettings[nextProvider] || DEFAULT_PROVIDER_SETTINGS[nextProvider] || {
      apiKey: '',
      apiEndpoint: '',
      model: '',
    };

    setApiKey(target.apiKey || '');
    setApiEndpoint(target.apiEndpoint || '');
    setModel(target.model || '');
  };

  const handleApiKeyChange = (text: string) => {
    setApiKey(text);
    setProviderSettings((prev) => ({
      ...prev,
      [provider]: {
        ...(prev[provider] || DEFAULT_PROVIDER_SETTINGS[provider]),
        apiKey: text,
      },
    }));
  };

  const handleApiEndpointChange = (text: string) => {
    setApiEndpoint(text);
    setProviderSettings((prev) => ({
      ...prev,
      [provider]: {
        ...(prev[provider] || DEFAULT_PROVIDER_SETTINGS[provider]),
        apiEndpoint: text,
      },
    }));
  };

  const handleModelChange = (text: string) => {
    setModel(text);
    setProviderSettings((prev) => ({
      ...prev,
      [provider]: {
        ...(prev[provider] || DEFAULT_PROVIDER_SETTINGS[provider]),
        model: text,
      },
    }));
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testTranslatorConnection({
        provider,
        apiKey: apiKey.trim(),
        apiEndpoint: apiEndpoint.trim(),
        model: model.trim(),
      });
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || '测试发生异常',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    const finalModel = normalizeModelName(provider, model);
    const trimmedApiKey = apiKey.trim();
    const trimmedEndpoint = apiEndpoint.trim();

    const finalConfig: TranslatorConfig = {
      provider,
      apiKey: trimmedApiKey,
      apiEndpoint: trimmedEndpoint,
      model: finalModel,
    };

    const finalSettings = {
      ...providerSettings,
      [provider]: {
        apiKey: trimmedApiKey,
        apiEndpoint: trimmedEndpoint,
        model: finalModel,
      },
    };

    try {
      await saveAllProviderSettings(finalSettings);
    } catch (err) {
      console.warn('[SettingsModal] 持久化所有提供商配置失败:', err);
    }

    onSaveConfig(finalConfig, true);
    onClose();
  };

  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.card, { paddingBottom: bottomPadding }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>翻译引擎与 POC 设置</Text>
              <Text style={styles.subtitle}>💾 本地持久化存储 · 重启与重新编译均自动保留</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* 翻译提供商切换 */}
            <Text style={styles.fieldLabel}>翻译后端</Text>
            <View style={styles.providerRow}>
              {[
                { key: 'mock', label: '离线内置' },
                { key: 'deepseek', label: 'DeepSeek' },
                { key: 'sakura', label: 'Sakura二次元' },
                { key: 'openai', label: 'OpenAI' },
                { key: 'deepl', label: 'DeepL' },
              ].map((item) => {
                const active = provider === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    onPress={() => handleSelectProvider(item.key as any)}
                    style={[
                      styles.providerChip,
                      active && styles.providerChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.providerChipText,
                        active && styles.providerChipTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {provider !== 'mock' && (
              <>
                <Text style={styles.fieldLabel}>API Key {provider === 'sakura' && '(本地Sakura服务可填任意字符)'}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={provider === 'sakura' ? 'sk-sakura 或任意字符' : 'sk-...'}
                  placeholderTextColor="#94A3B8"
                  value={apiKey}
                  onChangeText={handleApiKeyChange}
                  secureTextEntry={provider !== 'sakura'}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <Text style={styles.fieldLabel}>API 端点 (可选)</Text>
                <TextInput
                  style={styles.input}
                  placeholder={
                    provider === 'deepseek'
                      ? 'https://api.deepseek.com/chat/completions'
                      : provider === 'sakura'
                      ? 'http://localhost:8080/v1/chat/completions'
                      : 'https://api.openai.com/v1/chat/completions'
                  }
                  placeholderTextColor="#94A3B8"
                  value={apiEndpoint}
                  onChangeText={handleApiEndpointChange}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <Text style={styles.fieldLabel}>模型名称 (可选)</Text>
                <TextInput
                  style={styles.input}
                  placeholder={
                    provider === 'deepseek'
                      ? 'deepseek-flash'
                      : provider === 'sakura'
                      ? 'sakura-1.5b-qwen2.5-v1.0'
                      : 'gpt-4o-mini'
                  }
                  placeholderTextColor="#94A3B8"
                  value={model}
                  onChangeText={handleModelChange}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                {/* 快速选择推荐模型 */}
                <View style={styles.modelPresetRow}>
                  <Text style={styles.presetLabel}>推荐模型:</Text>
                  {provider === 'deepseek' && (
                    <>
                      <TouchableOpacity
                        style={[
                          styles.presetChip,
                          model === 'deepseek-flash' && styles.presetChipActive,
                        ]}
                        onPress={() => handleModelChange('deepseek-flash')}
                      >
                        <Text
                          style={[
                            styles.presetChipText,
                            model === 'deepseek-flash' && styles.presetChipTextActive,
                          ]}
                        >
                          deepseek-flash (推荐/视觉)
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.presetChip,
                          model === 'deepseek-chat' && styles.presetChipActive,
                        ]}
                        onPress={() => handleModelChange('deepseek-chat')}
                      >
                        <Text
                          style={[
                            styles.presetChipText,
                            model === 'deepseek-chat' && styles.presetChipTextActive,
                          ]}
                        >
                          deepseek-chat (V3)
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.presetChip,
                          model === 'deepseek-reasoner' && styles.presetChipActive,
                        ]}
                        onPress={() => handleModelChange('deepseek-reasoner')}
                      >
                        <Text
                          style={[
                            styles.presetChipText,
                            model === 'deepseek-reasoner' && styles.presetChipTextActive,
                          ]}
                        >
                          deepseek-reasoner (R1)
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {provider === 'openai' && (
                    <>
                      <TouchableOpacity
                        style={[
                          styles.presetChip,
                          model === 'gpt-4o-mini' && styles.presetChipActive,
                        ]}
                        onPress={() => handleModelChange('gpt-4o-mini')}
                      >
                        <Text
                          style={[
                            styles.presetChipText,
                            model === 'gpt-4o-mini' && styles.presetChipTextActive,
                          ]}
                        >
                          gpt-4o-mini (推荐)
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.presetChip,
                          model === 'gpt-4o' && styles.presetChipActive,
                        ]}
                        onPress={() => handleModelChange('gpt-4o')}
                      >
                        <Text
                          style={[
                            styles.presetChipText,
                            model === 'gpt-4o' && styles.presetChipTextActive,
                          ]}
                        >
                          gpt-4o
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>

                {/* 智能特性提示 */}
                {provider === 'deepseek' && (
                  <View style={styles.deepseekInfoBox}>
                    <Ionicons name="sparkles" size={15} color="#0284C7" />
                    <Text style={styles.deepseekInfoText}>
                      🌟 DeepSeek-Flash 支持超高速文本批量翻译与多模态图像视觉理解（支持封面艺术大字与拟声词识别）。
                    </Text>
                  </View>
                )}

                {/* 本地持久化提示条 */}
                <View style={styles.persistNoticeBox}>
                  <Ionicons name="shield-checkmark-outline" size={14} color="#059669" />
                  <Text style={styles.persistNoticeText}>
                    已启用本地持久化存储：API Key 将保存在本地，编译或重启无需重复配置。
                  </Text>
                </View>

                {/* API 连通性快速测试 */}
                <TouchableOpacity
                  style={[styles.testButton, isTesting && styles.testButtonDisabled]}
                  onPress={handleTestConnection}
                  disabled={isTesting}
                >
                  <Ionicons
                    name={isTesting ? 'reload' : 'flash-outline'}
                    size={16}
                    color="#0284C7"
                  />
                  <Text style={styles.testButtonText}>
                    {isTesting ? '正在发送测试请求...' : '🧪 测试 API 连接状态'}
                  </Text>
                </TouchableOpacity>

                {testResult && (
                  <View
                    style={[
                      styles.testResultBox,
                      testResult.success
                        ? styles.testResultSuccess
                        : styles.testResultFail,
                    ]}
                  >
                    <Ionicons
                      name={testResult.success ? 'checkmark-circle' : 'close-circle'}
                      size={18}
                      color={testResult.success ? '#16A34A' : '#DC2626'}
                    />
                    <Text
                      style={[
                        styles.testResultText,
                        testResult.success
                          ? styles.testResultSuccessText
                          : styles.testResultFailText,
                      ]}
                    >
                      {testResult.message}
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* POC 说明卡片 */}
            <View style={styles.infoBox}>
              <View style={styles.infoHeader}>
                <Ionicons name="sparkles" size={16} color="#0284C7" />
                <Text style={styles.infoTitle}>POC 核心验证点说明</Text>
              </View>
              <Text style={styles.infoText}>
                • <Text style={styles.bold}>消字嵌字（Mode A）</Text>：在气泡区域生成自适应多边形底色覆盖层，计算字号动态自适应填满，带描边清晰阅读。
              </Text>
              <Text style={styles.infoText}>
                • <Text style={styles.bold}>小点交互（Mode B）</Text>：保留原图完整画面，在每个气泡右上角显示阅读顺序角标，点击就近弹出翻译释义与词典卡片。
              </Text>
            </View>
          </ScrollView>

          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Ionicons name="save-outline" size={18} color="#FFFFFF" />
            <Text style={styles.saveButtonText}>保存并持久化配置</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 11,
    color: '#0284C7',
    marginTop: 2,
    fontWeight: '600',
  },
  body: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    marginTop: 10,
    textTransform: 'uppercase',
  },
  providerRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  providerChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  providerChipActive: {
    backgroundColor: '#0F172A',
  },
  providerChipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  providerChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 6,
  },
  infoBox: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0369A1',
  },
  infoText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
    marginTop: 4,
  },
  bold: {
    fontWeight: '700',
  },
  modelPresetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
    marginTop: 2,
  },
  presetLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  presetChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetChipActive: {
    backgroundColor: '#E0F2FE',
    borderColor: '#0284C7',
  },
  presetChipText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
  },
  presetChipTextActive: {
    color: '#0369A1',
    fontWeight: '700',
  },
  deepseekInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  deepseekInfoText: {
    fontSize: 11,
    color: '#0369A1',
    fontWeight: '500',
    flex: 1,
    lineHeight: 16,
  },
  persistNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  persistNoticeText: {
    fontSize: 11,
    color: '#047857',
    fontWeight: '500',
    flex: 1,
    lineHeight: 16,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    backgroundColor: '#F0F9FF',
    marginBottom: 8,
  },
  testButtonDisabled: {
    opacity: 0.5,
  },
  testButtonText: {
    fontSize: 13,
    color: '#0284C7',
    fontWeight: '700',
  },
  testResultBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
  },
  testResultSuccess: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  testResultFail: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  testResultText: {
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  testResultSuccessText: {
    color: '#15803D',
    fontWeight: '600',
  },
  testResultFailText: {
    color: '#B91C1C',
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#0284C7',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

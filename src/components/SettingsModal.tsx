import React, { useState } from 'react';
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

  const [provider, setProvider] = useState(config.provider);
  const [apiKey, setApiKey] = useState(config.apiKey);
  const [apiEndpoint, setApiEndpoint] = useState(config.apiEndpoint);
  const [model, setModel] = useState(config.model);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

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

  const handleSave = () => {
    const finalModel = normalizeModelName(provider, model);
    onSaveConfig(
      {
        provider,
        apiKey: apiKey.trim(),
        apiEndpoint: apiEndpoint.trim(),
        model: finalModel,
      },
      true
    );
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
            <Text style={styles.title}>翻译引擎与 POC 设置</Text>
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
                    onPress={() => {
                      const nextProvider = item.key as any;
                      setProvider(nextProvider);
                      if (nextProvider === 'deepseek') {
                        setModel('deepseek-flash');
                        setApiEndpoint('https://api.deepseek.com/chat/completions');
                      } else if (nextProvider === 'sakura') {
                        setModel('sakura-1.5b-qwen2.5-v1.0');
                        setApiEndpoint('http://localhost:8080/v1/chat/completions');
                      } else if (nextProvider === 'openai') {
                        setModel('gpt-4o-mini');
                        setApiEndpoint('https://api.openai.com/v1/chat/completions');
                      }
                    }}
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
                  onChangeText={setApiKey}
                  secureTextEntry={provider !== 'sakura'}
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
                  onChangeText={setApiEndpoint}
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
                  onChangeText={setModel}
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
                        onPress={() => setModel('deepseek-flash')}
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
                        onPress={() => setModel('deepseek-chat')}
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
                        onPress={() => setModel('deepseek-reasoner')}
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
                        onPress={() => setModel('gpt-4o-mini')}
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
                        onPress={() => setModel('gpt-4o')}
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
            <Text style={styles.saveButtonText}>保存配置</Text>
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
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

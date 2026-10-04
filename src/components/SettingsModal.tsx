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

interface Props {
  visible: boolean;
  onClose: () => void;
  config: TranslatorConfig;
  onSaveConfig: (config: TranslatorConfig) => void;
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

  const handleSave = () => {
    onSaveConfig({
      provider,
      apiKey,
      apiEndpoint,
      model,
    });
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
                { key: 'mock', label: '内置离线' },
                { key: 'deepseek', label: 'DeepSeek' },
                { key: 'openai', label: 'OpenAI' },
                { key: 'deepl', label: 'DeepL' },
              ].map((item) => {
                const active = provider === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    onPress={() => setProvider(item.key as any)}
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
                <Text style={styles.fieldLabel}>API Key</Text>
                <TextInput
                  style={styles.input}
                  placeholder="sk-..."
                  placeholderTextColor="#94A3B8"
                  value={apiKey}
                  onChangeText={setApiKey}
                  secureTextEntry
                />

                <Text style={styles.fieldLabel}>API 端点 (可选)</Text>
                <TextInput
                  style={styles.input}
                  placeholder={
                    provider === 'deepseek'
                      ? 'https://api.deepseek.com/chat/completions'
                      : 'https://api.openai.com/v1/chat/completions'
                  }
                  placeholderTextColor="#94A3B8"
                  value={apiEndpoint}
                  onChangeText={setApiEndpoint}
                />

                <Text style={styles.fieldLabel}>模型名称 (可选)</Text>
                <TextInput
                  style={styles.input}
                  placeholder={provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini'}
                  placeholderTextColor="#94A3B8"
                  value={model}
                  onChangeText={setModel}
                />
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

// 生成唯一ID
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// 格式化时间
export const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

// 延迟函数
export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// 模拟翻译API
export const mockTranslate = async (
  text: string,
  _sourceLang: string,
  _targetLang: string
): Promise<string> => {
  await delay(800 + Math.random() * 500);
  
  // 简单的模拟翻译逻辑
  const translations: Record<string, string> = {
    '你好': 'Hello',
    '世界': 'World',
    '翻译': 'Translation',
    '测试': 'Test',
    '系统': 'System',
  };
  
  let result = text;
  Object.entries(translations).forEach(([cn, en]) => {
    result = result.replace(new RegExp(cn, 'g'), en);
  });
  
  // 如果没有匹配，返回带标记的文本
  if (result === text) {
    result = `[Translated] ${text}`;
  }
  
  return result;
};

// 截断文本
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

// 获取语言显示名称
export const getLanguageDisplayName = (
  code: string,
  languages: { code: string; nativeName: string }[]
): string => {
  const lang = languages.find(l => l.code === code);
  return lang?.nativeName || code;
};

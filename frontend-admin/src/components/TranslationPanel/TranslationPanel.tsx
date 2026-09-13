import React, { useState } from 'react';
import { Send, Languages, History, Copy, Check } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { Button } from '@/components/ui';
import { MAX_INPUT_LENGTH, LANGUAGES } from '@/utils/constants';
import { formatTime, getLanguageDisplayName } from '@/utils/helpers';

// 检测文本是否主要是指定语言
const isTextInLanguage = (text: string, lang: string): boolean => {
  const trimmedText = text.trim();
  if (!trimmedText) return false;
  
  const chineseRegex = /[\u4e00-\u9fa5]/g;
  const englishRegex = /[a-zA-Z]/g;
  
  const chineseMatches = trimmedText.match(chineseRegex) || [];
  const englishMatches = trimmedText.match(englishRegex) || [];
  
  const chineseCount = chineseMatches.length;
  const englishCount = englishMatches.length;
  
  if (lang.startsWith('zh')) {
    return chineseCount > 0;
  }
  
  if (lang.startsWith('en')) {
    return chineseCount === 0 && englishCount > 0;
  }
  
  return true;
};

// 简单翻译函数
const translateText = (text: string, sourceLang: string, targetLang: string): string => {
  // 英文→中文
  if (sourceLang.startsWith('en') && targetLang.startsWith('zh')) {
    const enToCn: Record<string, string> = {
      'hello': '你好',
      'good morning': '早上好',
      'good evening': '晚上好',
      'good night': '晚安',
      'thank you': '谢谢',
      'thanks': '谢谢',
      'sorry': '对不起',
      'goodbye': '再见',
      'bye': '再见',
      'yes': '是的',
      'no': '不是',
      'ok': '好的',
      'please': '请',
      'welcome': '欢迎',
      'how are you': '你好吗',
      'good afternoon': '下午好',
    };
    
    const lowerText = text.toLowerCase().trim().replace(/[.!?。！？]+$/, '');
    if (enToCn[lowerText]) {
      return enToCn[lowerText];
    }
    
    let result = text;
    Object.entries(enToCn).forEach(([en, cn]) => {
      result = result.replace(new RegExp(`\\b${en}\\b`, 'gi'), cn);
    });
    return result !== text ? result : `[待翻译] ${text}`;
  }
  
  // 中文→英文
  if (sourceLang.startsWith('zh') && targetLang.startsWith('en')) {
    const cnToEn: Record<string, string> = {
      '你好': 'Hello',
      '早上好': 'Good morning',
      '晚上好': 'Good evening',
      '晚安': 'Good night',
      '下午好': 'Good afternoon',
      '谢谢': 'Thank you',
      '对不起': 'Sorry',
      '再见': 'Goodbye',
      '是的': 'Yes',
      '不是': 'No',
      '好的': 'OK',
      '请': 'Please',
      '欢迎': 'Welcome',
    };
    
    const trimmedText = text.trim().replace(/[.!?。！？]+$/, '');
    if (cnToEn[trimmedText]) {
      return cnToEn[trimmedText];
    }
    
    let result = text;
    Object.entries(cnToEn).forEach(([cn, en]) => {
      result = result.replace(new RegExp(cn, 'g'), en);
    });
    return result !== text ? result : `[Translation] ${text}`;
  }
  
  return text;
};

export const TranslationPanel: React.FC = () => {
  const inputText = useAppStore(state => state.inputText);
  const translationHistory = useAppStore(state => state.translationHistory);
  const isTranslating = useAppStore(state => state.isTranslating);
  const sourceLang = useAppStore(state => state.sourceLang);
  const targetLang = useAppStore(state => state.targetLang);
  const setInputText = useAppStore(state => state.setInputText);
  const addToast = useAppStore(state => state.addToast);
  const addSessionRecord = useAppStore(state => state.addSessionRecord);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [localHistory, setLocalHistory] = useState<Array<{
    id: string;
    sourceText: string;
    targetText: string;
    timestamp: Date;
  }>>([]);
  const [localTranslating, setLocalTranslating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputText.trim()) {
      addToast('warning', '请输入要翻译的文本');
      return;
    }

    // 检查输入文本是否符合源语言
    if (!isTextInLanguage(inputText, sourceLang)) {
      const expectedLang = sourceLang.startsWith('zh') ? '中文' : '英文';
      addToast('warning', `请输入${expectedLang}文本（当前源语言设置）`);
      return;
    }

    setLocalTranslating(true);
    
    // 模拟翻译延迟
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const translated = translateText(inputText, sourceLang, targetLang);
    
    const newRecord = {
      id: Date.now().toString(),
      sourceText: inputText,
      targetText: translated,
      timestamp: new Date(),
    };
    
    setLocalHistory(prev => [newRecord, ...prev]);
    
    addSessionRecord({
      type: 'manual',
      sourceText: inputText,
      targetText: translated,
      sourceLang,
      targetLang,
    });
    
    setInputText('');
    setLocalTranslating(false);
    addToast('success', '翻译完成');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      addToast('success', '已复制到剪贴板');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      addToast('error', '复制失败');
    }
  };

  const charCount = inputText.length;
  const isOverLimit = charCount > MAX_INPUT_LENGTH;
  
  // 合并历史记录
  const allHistory = [...localHistory, ...translationHistory];

  return (
    <aside className="w-full h-full flex-shrink-0 glass-panel rounded-2xl p-6 flex flex-col gap-6 overflow-hidden">
      {/* 标题 */}
      <div className="flex items-center gap-3 pb-4 border-b border-white/10">
        <div className="p-2 bg-primary-500/20 rounded-lg">
          <Languages className="w-5 h-5 text-primary-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-dark-100">文本翻译</h2>
          <p className="text-xs text-dark-500">
            {getLanguageDisplayName(sourceLang, LANGUAGES)} →{' '}
            {getLanguageDisplayName(targetLang, LANGUAGES)}
          </p>
        </div>
      </div>

      {/* 输入区域 */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <textarea
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`输入${sourceLang.startsWith('zh') ? '中文' : '英文'}文本...`}
            rows={4}
            className={`
              input-field resize-none
              ${isOverLimit ? 'border-accent-red focus:ring-accent-red/50' : ''}
            `}
          />
          
          {/* 字符计数 */}
          <div
            className={`
              absolute bottom-3 right-3 text-xs font-mono
              ${isOverLimit ? 'text-accent-red' : 'text-dark-500'}
            `}
          >
            {charCount}/{MAX_INPUT_LENGTH}
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          loading={localTranslating || isTranslating}
          disabled={!inputText.trim() || isOverLimit}
          icon={<Send className="w-4 h-4" />}
          className="w-full"
        >
          {localTranslating ? '翻译中...' : '发送翻译'}
        </Button>
      </form>

      {/* 翻译历史 */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-dark-300 flex items-center gap-2">
            <History className="w-4 h-4" />
            翻译历史
          </h3>
          {allHistory.length > 0 && (
            <span className="text-xs text-dark-500">
              {allHistory.length} 条记录
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {allHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-dark-500">
              <History className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">暂无翻译记录</p>
            </div>
          ) : (
            allHistory.map(item => (
              <div
                key={item.id}
                className="glass-card p-4 space-y-3 animate-fade-in"
              >
                {/* 原文 */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-dark-500">原文</span>
                    <span className="text-xs text-dark-600 font-mono">
                      {formatTime(item.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-dark-200 break-words">
                    {item.sourceText}
                  </p>
                </div>

                {/* 分隔线 */}
                <div className="border-t border-white/5" />

                {/* 译文 */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-primary-400">译文</span>
                    <button
                      onClick={() => handleCopy(item.targetText, item.id)}
                      className="p-1 hover:bg-white/5 rounded transition-colors"
                      title="复制译文"
                    >
                      {copiedId === item.id ? (
                        <Check className="w-3.5 h-3.5 text-accent-green" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-dark-500" />
                      )}
                    </button>
                  </div>
                  <p className="text-sm text-dark-100 break-words">
                    {item.targetText}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 底部提示 */}
      <div className="pt-3 border-t border-white/10">
        <p className="text-xs text-dark-500 text-center">
          按 Enter 发送，Shift + Enter 换行
        </p>
      </div>
    </aside>
  );
};

import { create } from 'zustand';
import type { AppState, ToastType, AudioSettings, SessionRecord } from '@/types';
import { generateId } from '@/utils/helpers';
import { DEFAULT_AUDIO_SETTINGS, TOAST_DURATION } from '@/utils/constants';

const STORAGE_KEY = 'subtitle-translator-session-records';

const loadRecordsFromStorage = (): SessionRecord[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.map((r: SessionRecord) => ({
        ...r,
        timestamp: new Date(r.timestamp),
        // 兼容旧数据：没有 starred 字段的记录默认为未重点关注
        starred: r.starred ?? false,
      }));
    }
  } catch {
    console.error('Failed to load session records from storage');
  }
  return [];
};

// 返回是否持久化成功，失败时调用方应保持内存状态不变
const saveRecordsToStorage = (records: SessionRecord[]): boolean => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    return true;
  } catch {
    console.error('Failed to save session records to storage');
    return false;
  }
};

export const useAppStore = create<AppState>((set, get) => ({
  // 控制面板状态
  sourceLang: 'zh-CN',
  targetLang: 'en-US',
  isMicOn: false,
  isRecording: false,
  audioSettings: DEFAULT_AUDIO_SETTINGS,
  
  // 字幕状态 - 初始为空
  subtitles: [],
  currentSubtitle: '',
  
  // 翻译状态
  inputText: '',
  translationHistory: [],
  isTranslating: false,
  
  // Toast状态
  toasts: [],
  
  // 会话记录
  sessionRecords: loadRecordsFromStorage(),
  
  // Actions
  setSourceLang: (lang: string) => {
    set({ sourceLang: lang });
    get().addToast('info', `源语言已切换`);
  },
  
  setTargetLang: (lang: string) => {
    set({ targetLang: lang });
    get().addToast('info', `目标语言已切换`);
  },
  
  toggleMic: () => {
    const { isMicOn } = get();
    const newState = !isMicOn;
    set({ isMicOn: newState, isRecording: newState });
  },
  
  setAudioSettings: (settings: Partial<AudioSettings>) => {
    set(state => ({
      audioSettings: { ...state.audioSettings, ...settings },
    }));
  },
  
  addSubtitle: (original: string, translated: string) => {
    const { sourceLang, targetLang } = get();
    set(state => ({
      subtitles: [
        ...state.subtitles.map(s => ({ ...s, isActive: false })),
        {
          id: generateId(),
          originalText: original,
          translatedText: translated,
          timestamp: new Date(),
          isActive: true,
        },
      ],
      currentSubtitle: '',
    }));
    get().addSessionRecord({
      type: 'voice',
      sourceText: original,
      targetText: translated,
      sourceLang,
      targetLang,
    });
  },
  
  setCurrentSubtitle: (text: string) => {
    set({ currentSubtitle: text });
  },
  
  setInputText: (text: string) => {
    set({ inputText: text });
  },
  
  translate: async () => {
    const { inputText, sourceLang, targetLang, addToast, addSessionRecord } = get();
    
    if (!inputText.trim()) {
      addToast('warning', '请输入要翻译的文本');
      return;
    }
    
    set({ isTranslating: true });
    
    try {
      // 模拟翻译
      await new Promise(resolve => setTimeout(resolve, 800));
      const result = `[Translated] ${inputText}`;
      
      set(state => ({
        translationHistory: [
          {
            id: generateId(),
            sourceText: inputText,
            targetText: result,
            sourceLang,
            targetLang,
            timestamp: new Date(),
          },
          ...state.translationHistory,
        ],
        inputText: '',
        isTranslating: false,
      }));
      
      addSessionRecord({
        type: 'manual',
        sourceText: inputText,
        targetText: result,
        sourceLang,
        targetLang,
      });
      
      addToast('success', '翻译完成');
    } catch {
      set({ isTranslating: false });
      addToast('error', '翻译失败，请重试');
    }
  },
  
  addToast: (type: ToastType, message: string) => {
    const id = generateId();
    set(state => ({
      toasts: [...state.toasts, { id, type, message, duration: TOAST_DURATION }],
    }));
    
    // 自动移除
    setTimeout(() => {
      get().removeToast(id);
    }, TOAST_DURATION);
  },
  
  removeToast: (id: string) => {
    set(state => ({
      toasts: state.toasts.filter(t => t.id !== id),
    }));
  },
  
  addSessionRecord: (record) => {
    set(state => {
      const newRecord: SessionRecord = {
        id: generateId(),
        timestamp: new Date(),
        starred: false,
        ...record,
      };
      const newRecords = [newRecord, ...state.sessionRecords];
      saveRecordsToStorage(newRecords);
      return { sessionRecords: newRecords };
    });
  },

  deleteSessionRecord: (id: string) => {
    get().removeSessionRecord(id);
    get().addToast('success', '记录已删除');
  },

  clearSessionRecords: () => {
    set({ sessionRecords: [] });
    saveRecordsToStorage([]);
    get().addToast('success', '所有记录已清空');
  },

  toggleSessionRecordStarred: (id: string) => {
    const record = get().sessionRecords.find(r => r.id === id);
    if (!record) return;
    get().setSessionRecordStarred(id, !record.starred);
  },

  removeSessionRecord: (id: string) => {
    const { sessionRecords } = get();
    if (!sessionRecords.some(r => r.id === id)) {
      return false;
    }
    const newRecords = sessionRecords.filter(r => r.id !== id);
    // 持久化失败则不改动内存状态，保证未处理成功的记录保持原样
    if (!saveRecordsToStorage(newRecords)) {
      return false;
    }
    set({ sessionRecords: newRecords });
    return true;
  },

  setSessionRecordStarred: (id: string, starred: boolean) => {
    const { sessionRecords } = get();
    const record = sessionRecords.find(r => r.id === id);
    if (!record) {
      return false;
    }
    // 已是目标状态，视为成功（幂等，便于批量重试）
    if (record.starred === starred) {
      return true;
    }
    const newRecords = sessionRecords.map(r =>
      r.id === id ? { ...r, starred } : r
    );
    if (!saveRecordsToStorage(newRecords)) {
      return false;
    }
    set({ sessionRecords: newRecords });
    return true;
  },
}));

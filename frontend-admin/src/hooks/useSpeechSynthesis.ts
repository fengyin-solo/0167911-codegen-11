import { useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';

export const useSpeechSynthesis = () => {
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  // 初始化
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      synthRef.current = window.speechSynthesis;
      
      // 加载语音列表
      const loadVoices = () => {
        voicesRef.current = synthRef.current?.getVoices() || [];
        console.log('[TTS] 可用语音数量:', voicesRef.current.length);
      };
      
      loadVoices();
      
      if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }, []);

  // 获取适合目标语言的语音
  const getVoiceForLang = useCallback((lang: string): SpeechSynthesisVoice | null => {
    const voices = voicesRef.current;
    
    // 优先匹配完整语言代码
    let voice = voices.find(v => v.lang === lang);
    
    // 其次匹配语言前缀
    if (!voice) {
      const langPrefix = lang.split('-')[0];
      voice = voices.find(v => v.lang.startsWith(langPrefix));
    }
    
    // 最后使用默认语音
    if (!voice) {
      voice = voices.find(v => v.default) || voices[0];
    }
    
    return voice || null;
  }, []);

  // 朗读文本
  const speak = useCallback((text: string, lang?: string) => {
    if (!synthRef.current) {
      console.log('[TTS] 语音合成不可用');
      return;
    }
    
    // 获取最新的设置
    const currentSettings = useAppStore.getState().audioSettings;
    const currentTargetLang = useAppStore.getState().targetLang;
    
    if (!currentSettings.ttsEnabled) {
      console.log('[TTS] 语音播报已关闭');
      return;
    }

    // 取消之前的朗读
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // 设置语音
    const targetLanguage = lang || currentTargetLang;
    const voice = getVoiceForLang(targetLanguage);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }
    
    // 应用设置
    utterance.volume = currentSettings.volume / 100; // 0-1
    utterance.rate = currentSettings.speed; // 0.1-10
    utterance.pitch = 1; // 0-2
    
    console.log('[TTS] 朗读:', text);
    console.log('[TTS] 语言:', utterance.lang, '音量:', utterance.volume, '语速:', utterance.rate);
    
    utterance.onstart = () => {
      console.log('[TTS] 开始朗读');
    };
    
    utterance.onend = () => {
      console.log('[TTS] 朗读结束');
    };
    
    utterance.onerror = (e) => {
      console.error('[TTS] 朗读错误:', e.error);
    };

    synthRef.current.speak(utterance);
  }, [getVoiceForLang]);

  // 停止朗读
  const stop = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
    }
  }, []);

  // 测试朗读
  const testSpeak = useCallback(() => {
    const currentTargetLang = useAppStore.getState().targetLang;
    const testText = currentTargetLang.startsWith('zh') 
      ? '语音播报测试成功' 
      : 'Voice broadcast test successful';
    
    // 临时强制启用播报进行测试
    if (!synthRef.current) {
      console.log('[TTS] 语音合成不可用');
      return;
    }
    
    synthRef.current.cancel();
    
    const utterance = new SpeechSynthesisUtterance(testText);
    const voice = getVoiceForLang(currentTargetLang);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }
    
    const currentSettings = useAppStore.getState().audioSettings;
    utterance.volume = currentSettings.volume / 100;
    utterance.rate = currentSettings.speed;
    
    console.log('[TTS] 测试播报:', testText);
    synthRef.current.speak(utterance);
  }, [getVoiceForLang]);

  return {
    speak,
    stop,
    testSpeak,
    isSupported: typeof window !== 'undefined' && !!window.speechSynthesis,
  };
};

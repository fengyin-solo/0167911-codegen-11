import React from 'react';
import type { SubtitleEntry } from '@/types';
import { formatTime } from '@/utils/helpers';

interface SubtitleItemProps {
  subtitle: SubtitleEntry;
}

export const SubtitleItem: React.FC<SubtitleItemProps> = ({ subtitle }) => {
  return (
    <div
      className={`
        glass-card p-4 transition-all duration-300 animate-slide-up
        ${subtitle.isActive ? 'subtitle-highlight' : ''}
      `}
    >
      <div className="flex items-start gap-3">
        {/* 时间戳 */}
        <div className="flex-shrink-0 text-xs text-dark-500 font-mono pt-1">
          {formatTime(subtitle.timestamp)}
        </div>

        {/* 字幕内容 */}
        <div className="flex-1 space-y-2">
          {/* 原文 */}
          <p
            className={`
              text-lg leading-relaxed
              ${subtitle.isActive ? 'text-dark-50 font-medium' : 'text-dark-200'}
            `}
          >
            {subtitle.originalText}
          </p>

          {/* 译文 */}
          <p
            className={`
              text-base leading-relaxed
              ${subtitle.isActive ? 'text-primary-400' : 'text-dark-400'}
            `}
          >
            {subtitle.translatedText}
          </p>
        </div>

        {/* 活跃指示器 */}
        {subtitle.isActive && (
          <div className="flex-shrink-0">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-primary-500/20 text-primary-400">
              当前
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

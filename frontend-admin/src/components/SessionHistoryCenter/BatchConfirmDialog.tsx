import React from 'react';
import { Star, Trash2, CheckCheck, X } from 'lucide-react';
import { Button } from '@/components/ui';
import type { BatchActionKind } from '@/utils/batchOperations';

interface BatchConfirmDialogProps {
  action: BatchActionKind;
  // 直接受影响的条数（删除/改关注：选中数；仅保留：可见且未选中数）
  affectedCount: number;
  // 当前筛选条件下可见的条数
  visibleCount: number;
  // 被筛选条件隐藏、不会受影响的条数
  hiddenCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

const ACTION_META: Record<
  BatchActionKind,
  { title: string; verb: string; icon: React.ReactNode; danger: boolean }
> = {
  delete: {
    title: '确认批量删除',
    verb: '删除',
    icon: <Trash2 className="w-5 h-5" />,
    danger: true,
  },
  keepOnly: {
    title: '确认仅保留选中记录',
    verb: '删除',
    icon: <CheckCheck className="w-5 h-5" />,
    danger: true,
  },
  star: {
    title: '确认设为重点关注',
    verb: '标记为重点关注',
    icon: <Star className="w-5 h-5" />,
    danger: false,
  },
  unstar: {
    title: '确认取消重点关注',
    verb: '取消重点关注',
    icon: <Star className="w-5 h-5" />,
    danger: false,
  },
};

export const BatchConfirmDialog: React.FC<BatchConfirmDialogProps> = ({
  action,
  affectedCount,
  visibleCount,
  hiddenCount,
  onConfirm,
  onCancel,
}) => {
  const meta = ACTION_META[action];

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="glass-panel rounded-2xl p-6 max-w-sm mx-4 w-full animate-fade-in">
        <div className="flex items-center gap-3 mb-4">
          <div
            className={`p-3 rounded-full ${
              meta.danger ? 'bg-accent-yellow/20 text-accent-yellow' : 'bg-primary-500/20 text-primary-400'
            }`}
          >
            {meta.icon}
          </div>
          <div>
            <h3 className="font-semibold text-dark-100">{meta.title}</h3>
            <p className="text-sm text-dark-400">操作仅作用于当前列表</p>
          </div>
        </div>

        <div className="space-y-2 text-sm text-dark-300 mb-6">
          <p>
            {action === 'keepOnly'
              ? `将${meta.verb}当前可见记录中未选中的 ${affectedCount} 条，保留选中的 ${visibleCount - affectedCount} 条。`
              : `将对选中的 ${affectedCount} 条记录执行「${meta.verb}」。`}
          </p>
          <p className="text-dark-500">
            当前筛选结果共 {visibleCount} 条，本次操作只会影响这些可见记录。
          </p>
          {hiddenCount > 0 && (
            <p className="text-primary-400/90">
              另有 {hiddenCount} 条记录被搜索/筛选条件隐藏，不会受本次操作影响。
            </p>
          )}
          {meta.danger && <p className="text-accent-yellow/90">此操作中已生效的部分不可撤销，失败的记录将保持原样。</p>}
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" onClick={onCancel} className="flex-1" icon={<X className="w-4 h-4" />}>
            取消
          </Button>
          <Button variant={meta.danger ? 'danger' : 'primary'} onClick={onConfirm} className="flex-1">
            确认执行
          </Button>
        </div>
      </div>
    </div>
  );
};

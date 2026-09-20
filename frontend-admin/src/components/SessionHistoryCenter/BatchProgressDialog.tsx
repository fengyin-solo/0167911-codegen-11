import React from 'react';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  RefreshCw,
  Star,
  Trash2,
  CheckCheck,
} from 'lucide-react';
import { Button } from '@/components/ui';
import type { BatchActionKind, BatchItem } from '@/utils/batchOperations';

interface BatchProgressDialogProps {
  action: BatchActionKind;
  items: BatchItem[];
  running: boolean;
  onRetry: () => void;
  onClose: () => void;
}

const ACTION_LABEL: Record<BatchActionKind, string> = {
  delete: '批量删除',
  keepOnly: '仅保留选中',
  star: '设为重点关注',
  unstar: '取消重点关注',
};

const ACTION_ICON: Record<BatchActionKind, React.ReactNode> = {
  delete: <Trash2 className="w-5 h-5" />,
  keepOnly: <CheckCheck className="w-5 h-5" />,
  star: <Star className="w-5 h-5" />,
  unstar: <Star className="w-5 h-5" />,
};

const statusIcon = (status: BatchItem['status']) => {
  switch (status) {
    case 'processing':
      return <Loader2 className="w-4 h-4 text-primary-400 animate-spin flex-shrink-0" />;
    case 'success':
      return <CheckCircle2 className="w-4 h-4 text-accent-green flex-shrink-0" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-accent-red flex-shrink-0" />;
    default:
      return <Clock className="w-4 h-4 text-dark-600 flex-shrink-0" />;
  }
};

const statusText: Record<BatchItem['status'], string> = {
  pending: '等待中',
  processing: '处理中…',
  success: '成功',
  failed: '失败（内容保持原样）',
};

export const BatchProgressDialog: React.FC<BatchProgressDialogProps> = ({
  action,
  items,
  running,
  onRetry,
  onClose,
}) => {
  const succeeded = items.filter(i => i.status === 'success').length;
  const failed = items.filter(i => i.status === 'failed').length;
  const total = items.length;
  const done = !running;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-panel rounded-2xl p-6 max-w-md mx-4 w-full animate-fade-in max-h-[80%] flex flex-col">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 bg-primary-500/20 rounded-lg text-primary-400">
            {ACTION_ICON[action]}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-dark-100">
              {ACTION_LABEL[action]}
              {running ? '进行中' : '完成'}
            </h3>
            <p className="text-sm text-dark-500">
              共 {total} 条 · 成功 {succeeded} 条
              {failed > 0 && <span className="text-accent-red"> · 失败 {failed} 条</span>}
            </p>
          </div>
          {running && <Loader2 className="w-5 h-5 text-primary-400 animate-spin" />}
        </div>

        {done && (
          <div
            className={`text-sm rounded-lg px-3 py-2 mb-3 ${
              failed === 0
                ? 'bg-accent-green/15 text-accent-green'
                : 'bg-accent-yellow/15 text-accent-yellow'
            }`}
          >
            {failed === 0
              ? `全部 ${succeeded} 条记录处理成功。`
              : `${succeeded} 条已生效，${failed} 条失败且未被修改，可点击「重试失败项」再次处理。`}
          </div>
        )}

        {/* 逐条反馈列表 */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 mb-5 min-h-[80px]">
          {items.map(item => (
            <div
              key={item.id}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm ${
                item.status === 'failed'
                  ? 'border-accent-red/30 bg-accent-red/10'
                  : item.status === 'success'
                    ? 'border-accent-green/20 bg-accent-green/5'
                    : 'border-white/5 bg-dark-800/40'
              }`}
            >
              {statusIcon(item.status)}
              <span className="flex-1 min-w-0 truncate text-dark-200">{item.label}</span>
              <span
                className={`text-xs flex-shrink-0 ${
                  item.status === 'failed'
                    ? 'text-accent-red'
                    : item.status === 'success'
                      ? 'text-accent-green'
                      : 'text-dark-500'
                }`}
              >
                {item.status === 'failed' && item.error ? item.error : statusText[item.status]}
              </span>
            </div>
          ))}
        </div>

        <div className="flex gap-3 flex-shrink-0">
          {done && failed > 0 && (
            <Button
              variant="primary"
              onClick={onRetry}
              className="flex-1"
              icon={<RefreshCw className="w-4 h-4" />}
            >
              重试失败项（{failed} 条）
            </Button>
          )}
          <Button
            variant={failed > 0 ? 'secondary' : 'primary'}
            onClick={onClose}
            disabled={running}
            className="flex-1"
          >
            {failed > 0 ? '稍后处理' : '完成'}
          </Button>
        </div>
      </div>
    </div>
  );
};

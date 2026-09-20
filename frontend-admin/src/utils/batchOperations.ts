// 批量操作：逐条执行、逐条反馈，失败的条目保持原样并可单独重试
// 纯前端演示项目没有真实后端，这里用随机失败来模拟逐条请求的成功/失败

export type BatchItemStatus = 'pending' | 'processing' | 'success' | 'failed';

export type BatchActionKind = 'delete' | 'keepOnly' | 'star' | 'unstar';

export interface BatchItem {
  id: string;
  label: string;
  status: BatchItemStatus;
  error?: string;
}

export interface BatchResult {
  succeededIds: string[];
  failedIds: string[];
}

// 单条操作的模拟失败概率（重试时同样可能再次失败）
const FAIL_RATE = 0.25;

const executeOnce = async (): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 180 + Math.random() * 220));
  if (Math.random() < FAIL_RATE) {
    throw new Error('网络异常，操作未生效');
  }
};

/**
 * 依次处理传入的条目：
 * - 每成功一条，立即调用 onCommit 落库（保证未处理/失败的内容保持原样）
 * - 每处理完一条（无论成功失败），通过 onItemChange 反馈状态
 */
export const runBatchItems = async (
  items: BatchItem[],
  options: {
    onItemChange: (id: string, status: BatchItemStatus, error?: string) => void;
    onCommit: (id: string) => void;
  }
): Promise<BatchResult> => {
  const succeededIds: string[] = [];
  const failedIds: string[] = [];

  for (const item of items) {
    options.onItemChange(item.id, 'processing');
    try {
      await executeOnce();
      options.onCommit(item.id);
      options.onItemChange(item.id, 'success');
      succeededIds.push(item.id);
    } catch (err) {
      // 失败的条目不调用 onCommit，数据保持原样，等待重试
      const message = err instanceof Error ? err.message : '操作失败';
      options.onItemChange(item.id, 'failed', message);
      failedIds.push(item.id);
    }
  }

  return { succeededIds, failedIds };
};

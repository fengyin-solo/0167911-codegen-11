import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  History,
  Search,
  Trash2,
  X,
  Mic,
  Languages,
  Copy,
  Check,
  Filter,
  Calendar,
  ChevronDown,
  AlertTriangle,
  Star,
  Minus,
  Loader2,
  Circle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { Button } from '@/components/ui';
import { LANGUAGES } from '@/utils/constants';
import { delay, formatTime, getLanguageDisplayName, truncateText } from '@/utils/helpers';
import type { SessionRecord, SessionRecordType } from '@/types';

type FilterType = 'all' | SessionRecordType | 'starred';

// 批量操作类型：keep（只保留选中）实际执行的是删除
type BatchOp = 'delete' | 'star' | 'unstar';
type BatchKind = BatchOp | 'keep';

interface BatchTarget {
  id: string;
  label: string;
}

interface BatchItem extends BatchTarget {
  status: 'pending' | 'processing' | 'success' | 'failed';
  reason?: string;
}

interface BatchExecution {
  op: BatchOp;
  items: BatchItem[];
  finished: boolean;
}

const BATCH_OP_LABELS: Record<BatchOp, string> = {
  delete: '删除',
  star: '标记重点关注',
  unstar: '取消重点关注',
};

export const SessionHistoryCenter: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const sessionRecords = useAppStore(state => state.sessionRecords);
  const deleteSessionRecord = useAppStore(state => state.deleteSessionRecord);
  const clearSessionRecords = useAppStore(state => state.clearSessionRecords);
  const toggleSessionRecordStarred = useAppStore(state => state.toggleSessionRecordStarred);
  const removeSessionRecord = useAppStore(state => state.removeSessionRecord);
  const setSessionRecordStarred = useAppStore(state => state.setSessionRecordStarred);
  const addToast = useAppStore(state => state.addToast);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // 多选与批量操作状态
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmBatch, setConfirmBatch] = useState<{ kind: BatchKind; ids: string[] } | null>(null);
  const [execution, setExecution] = useState<BatchExecution | null>(null);
  const cancelRef = useRef(false);

  // 详情直接从 store 派生，重点关注等状态变化实时反映，记录被删除后详情自动关闭
  const selectedRecord = useMemo(
    () => sessionRecords.find(r => r.id === selectedRecordId) ?? null,
    [sessionRecords, selectedRecordId]
  );

  const isFilterActive = searchQuery.trim() !== '' || filterType !== 'all';

  const filteredRecords = useMemo(() => {
    return sessionRecords.filter(record => {
      const matchesType =
        filterType === 'all' ||
        (filterType === 'starred' ? record.starred : record.type === filterType);
      const matchesSearch = !searchQuery.trim() ||
        record.sourceText.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.targetText.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [sessionRecords, filterType, searchQuery]);

  const groupedByDate = useMemo(() => {
    const groups: Record<string, SessionRecord[]> = {};
    filteredRecords.forEach(record => {
      const date = record.timestamp.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
      });
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(record);
    });
    return groups;
  }, [filteredRecords]);

  // 记录变化时剔除已不存在的选中项，保证已选数量与记录列表一致
  useEffect(() => {
    setSelectedIds(prev => {
      if (prev.size === 0) return prev;
      const existing = new Set(sessionRecords.map(r => r.id));
      const next = new Set([...prev].filter(id => existing.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [sessionRecords]);

  // 批量操作只作用于当前筛选后可见的记录
  const visibleIds = useMemo(() => filteredRecords.map(r => r.id), [filteredRecords]);
  const selectedVisibleIds = useMemo(
    () => visibleIds.filter(id => selectedIds.has(id)),
    [visibleIds, selectedIds]
  );
  const hiddenSelectedCount = selectedIds.size - selectedVisibleIds.length;
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleIds.length === visibleIds.length;
  const partiallySelected = selectedVisibleIds.length > 0 && !allVisibleSelected;

  const execCounts = useMemo(() => {
    if (!execution) return null;
    return {
      success: execution.items.filter(i => i.status === 'success').length,
      failed: execution.items.filter(i => i.status === 'failed').length,
      pending: execution.items.filter(i => i.status === 'pending' || i.status === 'processing').length,
    };
  }, [execution]);

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

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteSessionRecord(id);
  };

  const handleToggleStar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleSessionRecordStarred(id);
  };

  const handleClearAll = () => {
    clearSessionRecords();
    setShowClearConfirm(false);
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // 全选/取消全选当前筛选结果
  const toggleSelectAllVisible = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleIds.forEach(id => next.delete(id));
      } else {
        visibleIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  // 打开批量操作确认框，先确认影响范围
  const openBatchConfirm = (kind: BatchKind) => {
    const ids =
      kind === 'keep'
        ? visibleIds.filter(id => !selectedIds.has(id))
        : selectedVisibleIds;
    if (ids.length === 0) return;
    setConfirmBatch({ kind, ids });
  };

  const updateBatchItem = (id: string, patch: Partial<BatchItem>) => {
    setExecution(prev =>
      prev
        ? {
            ...prev,
            items: prev.items.map(item => (item.id === id ? { ...item, ...patch } : item)),
          }
        : prev
    );
  };

  // 逐条执行批量操作，实时反馈每条的成功与失败；失败与未处理的记录保持原样
  const runBatch = async (op: BatchOp, targets: BatchTarget[]) => {
    if (targets.length === 0) return;
    cancelRef.current = false;
    setExecution({
      op,
      items: targets.map(t => ({ ...t, status: 'pending' as const })),
      finished: false,
    });

    let succeeded = 0;
    let failed = 0;
    for (const target of targets) {
      if (cancelRef.current) break;
      updateBatchItem(target.id, { status: 'processing' });
      await delay(120);
      const ok =
        op === 'delete'
          ? removeSessionRecord(target.id)
          : setSessionRecordStarred(target.id, op === 'star');
      if (ok) {
        succeeded += 1;
        updateBatchItem(target.id, { status: 'success' });
      } else {
        failed += 1;
        updateBatchItem(target.id, {
          status: 'failed',
          reason: op === 'delete' ? '记录不存在或已被删除' : '记录不存在或状态保存失败',
        });
      }
    }

    setExecution(prev => (prev ? { ...prev, finished: true } : prev));
    const skipped = targets.length - succeeded - failed;
    if (failed === 0 && skipped === 0) {
      addToast('success', `批量${BATCH_OP_LABELS[op]}完成，共处理 ${succeeded} 条`);
    } else {
      addToast(
        'warning',
        `批量${BATCH_OP_LABELS[op]}结束：成功 ${succeeded} 条，失败 ${failed} 条` +
          (skipped > 0 ? `，未处理 ${skipped} 条` : '')
      );
    }
  };

  const handleConfirmBatch = () => {
    if (!confirmBatch) return;
    const op: BatchOp = confirmBatch.kind === 'keep' ? 'delete' : confirmBatch.kind;
    const labelById = new Map(
      sessionRecords.map(r => [r.id, truncateText(r.sourceText || r.targetText, 30)])
    );
    const targets = confirmBatch.ids.map(id => ({ id, label: labelById.get(id) ?? id }));
    setConfirmBatch(null);
    runBatch(op, targets);
  };

  // 重试失败与未处理的条目，其余保持原样
  const handleRetryBatch = () => {
    if (!execution) return;
    const remaining = execution.items
      .filter(item => item.status === 'failed' || item.status === 'pending')
      .map(({ id, label }) => ({ id, label }));
    runBatch(execution.op, remaining);
  };

  const getTypeIcon = (type: SessionRecordType) => {
    return type === 'voice' ? (
      <Mic className="w-4 h-4" />
    ) : (
      <Languages className="w-4 h-4" />
    );
  };

  const getTypeLabel = (type: SessionRecordType) => {
    return type === 'voice' ? '语音识别' : '手动翻译';
  };

  const getTypeColor = (type: SessionRecordType) => {
    return type === 'voice'
      ? 'bg-accent-red/20 text-accent-red'
      : 'bg-primary-500/20 text-primary-400';
  };

  const renderCheckbox = (checked: boolean, partial = false) => (
    <span
      className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
        checked || partial
          ? 'bg-primary-500 border-primary-500'
          : 'border-dark-500 bg-dark-800/50 hover:border-primary-400'
      }`}
    >
      {checked ? (
        <Check className="w-3 h-3 text-white" />
      ) : partial ? (
        <Minus className="w-3 h-3 text-white" />
      ) : null}
    </span>
  );

  const renderBatchItemStatus = (item: BatchItem) => {
    switch (item.status) {
      case 'processing':
        return <Loader2 className="w-4 h-4 text-primary-400 animate-spin flex-shrink-0" />;
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-accent-green flex-shrink-0" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-accent-red flex-shrink-0" />;
      default:
        return <Circle className="w-4 h-4 text-dark-600 flex-shrink-0" />;
    }
  };

  const filterOptions: { value: FilterType; label: string }[] = [
    { value: 'all', label: '全部记录' },
    { value: 'voice', label: '语音识别' },
    { value: 'manual', label: '手动翻译' },
    { value: 'starred', label: '重点关注' },
  ];

  const batchConfirmConfig: Record<
    BatchKind,
    { title: string; confirmLabel: string; destructive: boolean; describe: (count: number) => string }
  > = {
    delete: {
      title: '确认批量删除',
      confirmLabel: '确认删除',
      destructive: true,
      describe: count => `将删除选中的 ${count} 条记录，删除后无法恢复。`,
    },
    keep: {
      title: '确认只保留选中',
      confirmLabel: '确认执行',
      destructive: true,
      describe: count =>
        `将保留选中的 ${selectedVisibleIds.length} 条记录，删除当前列表中其余 ${count} 条记录，删除后无法恢复。`,
    },
    star: {
      title: '确认标记重点关注',
      confirmLabel: '确认标记',
      destructive: false,
      describe: count => `将把选中的 ${count} 条记录标记为重点关注。`,
    },
    unstar: {
      title: '确认取消重点关注',
      confirmLabel: '确认取消',
      destructive: false,
      describe: count => `将取消选中的 ${count} 条记录的重点关注标记。`,
    },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 主面板 */}
      <div className="relative w-full max-w-6xl h-[85vh] glass-panel rounded-2xl flex flex-col overflow-hidden animate-fade-in">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-500/20 rounded-lg">
              <History className="w-6 h-6 text-primary-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-dark-100">会话记录中心</h2>
              <p className="text-sm text-dark-500">
                共 {sessionRecords.length} 条记录 · 筛选后 {filteredRecords.length} 条
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {sessionRecords.length > 0 && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setShowClearConfirm(true)}
                icon={<Trash2 className="w-4 h-4" />}
              >
                清空全部
              </Button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-dark-400 hover:text-dark-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 工具栏 */}
        <div className="p-4 border-b border-white/10 flex-shrink-0">
          <div className="flex flex-col md:flex-row gap-3">
            {/* 搜索框 */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索原文或译文..."
                className="w-full pl-10 pr-4 py-2.5 bg-dark-800/50 border border-white/10 rounded-xl text-dark-100 placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded"
                >
                  <X className="w-4 h-4 text-dark-500" />
                </button>
              )}
            </div>

            {/* 筛选下拉 */}
            <div className="relative">
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="flex items-center gap-2 px-4 py-2.5 bg-dark-800/50 border border-white/10 rounded-xl text-dark-200 hover:bg-dark-700/50 transition-colors min-w-[140px]"
              >
                <Filter className="w-4 h-4" />
                <span className="flex-1 text-left">
                  {filterOptions.find(o => o.value === filterType)?.label}
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showFilterDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showFilterDropdown && (
                <div className="absolute top-full right-0 mt-2 w-44 bg-dark-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-10">
                  {filterOptions.map(option => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setFilterType(option.value);
                        setShowFilterDropdown(false);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-sm hover:bg-white/10 transition-colors flex items-center justify-between ${
                        filterType === option.value ? 'text-primary-400 bg-primary-500/10' : 'text-dark-200'
                      }`}
                    >
                      {option.label}
                      {filterType === option.value && (
                        <Check className="w-4 h-4" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 批量操作栏 */}
        <div className="px-4 py-2 border-b border-white/10 flex-shrink-0 flex items-center gap-2 flex-wrap bg-dark-800/30">
          <button
            onClick={toggleSelectAllVisible}
            disabled={visibleIds.length === 0}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-dark-200 hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={allVisibleSelected ? '取消全选' : '全选当前筛选结果'}
          >
            {renderCheckbox(allVisibleSelected, partiallySelected)}
            全选
          </button>
          <span className="text-xs text-dark-500">
            已选 {selectedVisibleIds.length} 条
            {hiddenSelectedCount > 0 && `（另有 ${hiddenSelectedCount} 条不在当前筛选中）`}
          </span>
          <div className="flex-1" />
          <Button
            variant="secondary"
            size="sm"
            disabled={selectedVisibleIds.length === 0}
            onClick={() => openBatchConfirm('star')}
            icon={<Star className="w-3.5 h-3.5" />}
          >
            设为重点关注
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={selectedVisibleIds.length === 0}
            onClick={() => openBatchConfirm('unstar')}
          >
            取消重点关注
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={selectedVisibleIds.length === 0 || visibleIds.length - selectedVisibleIds.length === 0}
            onClick={() => openBatchConfirm('keep')}
          >
            只保留选中
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={selectedVisibleIds.length === 0}
            onClick={() => openBatchConfirm('delete')}
            icon={<Trash2 className="w-3.5 h-3.5" />}
          >
            删除
          </Button>
          {selectedIds.size > 0 && (
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-2 py-1.5 text-sm text-dark-400 hover:text-dark-100 hover:bg-white/5 rounded-lg transition-colors"
            >
              清除选择
            </button>
          )}
        </div>

        {/* 内容区 */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* 记录列表 */}
          <div className={`${selectedRecord ? 'hidden md:block md:w-1/2 lg:w-3/5' : 'w-full'} overflow-y-auto border-r border-white/10`}>
            {Object.keys(groupedByDate).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-dark-500 p-8">
                <History className="w-16 h-16 mb-4 opacity-30" />
                <p className="text-lg font-medium mb-1">暂无记录</p>
                <p className="text-sm">
                  {searchQuery || filterType !== 'all'
                    ? '没有找到符合条件的记录'
                    : '开始使用语音识别或手动翻译后，记录将显示在这里'}
                </p>
              </div>
            ) : (
              <div className="p-4 space-y-6">
                {Object.entries(groupedByDate).map(([date, records]) => (
                  <div key={date}>
                    <div className="flex items-center gap-2 mb-3 px-2 sticky top-0 bg-dark-900/80 backdrop-blur-sm py-2 -mt-2 z-10">
                      <Calendar className="w-4 h-4 text-dark-500" />
                      <span className="text-sm font-medium text-dark-400">{date}</span>
                      <span className="text-xs text-dark-600">({records.length} 条)</span>
                    </div>
                    <div className="space-y-2">
                      {records.map(record => (
                        <div
                          key={record.id}
                          onClick={() => setSelectedRecordId(record.id)}
                          className={`glass-card p-4 cursor-pointer transition-all hover:bg-white/5 group ${
                            selectedRecordId === record.id ? 'ring-2 ring-primary-500/50 bg-white/5' : ''
                          } ${selectedIds.has(record.id) ? 'ring-1 ring-primary-400/50 bg-primary-500/5' : ''}`}
                        >
                          <div className="flex items-start gap-3">
                            <button
                              onClick={(e) => toggleSelect(record.id, e)}
                              className="mt-1 flex-shrink-0 p-0.5 rounded"
                              title={selectedIds.has(record.id) ? '取消选择' : '选择记录'}
                            >
                              {renderCheckbox(selectedIds.has(record.id))}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getTypeColor(record.type)}`}>
                                  {getTypeIcon(record.type)}
                                  {getTypeLabel(record.type)}
                                </span>
                                {record.starred && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-accent-yellow/20 text-accent-yellow">
                                    <Star className="w-3 h-3 fill-accent-yellow" />
                                    重点关注
                                  </span>
                                )}
                                <span className="text-xs text-dark-600 font-mono">
                                  {formatTime(record.timestamp)}
                                </span>
                                <span className="text-xs text-dark-600">
                                  {getLanguageDisplayName(record.sourceLang, LANGUAGES)} → {getLanguageDisplayName(record.targetLang, LANGUAGES)}
                                </span>
                              </div>
                              <p className="text-sm text-dark-300 truncate mb-1">
                                {truncateText(record.sourceText, 60)}
                              </p>
                              <p className="text-sm text-dark-100 truncate">
                                {truncateText(record.targetText, 60)}
                              </p>
                            </div>
                            <div className="flex items-center flex-shrink-0">
                              <button
                                onClick={(e) => handleToggleStar(record.id, e)}
                                className={`p-2 hover:bg-accent-yellow/20 rounded-lg transition-all ${
                                  record.starred
                                    ? 'text-accent-yellow'
                                    : 'opacity-0 group-hover:opacity-100 text-dark-500 hover:text-accent-yellow'
                                }`}
                                title={record.starred ? '取消重点关注' : '设为重点关注'}
                              >
                                <Star className={`w-4 h-4 ${record.starred ? 'fill-accent-yellow' : ''}`} />
                              </button>
                              <button
                                onClick={(e) => handleDelete(record.id, e)}
                                className="p-2 opacity-0 group-hover:opacity-100 hover:bg-accent-red/20 text-dark-500 hover:text-accent-red rounded-lg transition-all"
                                title="删除记录"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 详情面板 */}
          {selectedRecord && (
            <div className="hidden md:flex md:flex-col md:w-1/2 lg:w-2/5 bg-dark-800/30">
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <h3 className="font-medium text-dark-100">记录详情</h3>
                <button
                  onClick={() => setSelectedRecordId(null)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-dark-500 hover:text-dark-100 md:hidden"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* 类型标签 */}
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${getTypeColor(selectedRecord.type)}`}>
                    {getTypeIcon(selectedRecord.type)}
                    {getTypeLabel(selectedRecord.type)}
                  </span>
                  {selectedRecord.starred && (
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-accent-yellow/20 text-accent-yellow">
                      <Star className="w-4 h-4 fill-accent-yellow" />
                      重点关注
                    </span>
                  )}
                </div>

                {/* 时间信息 */}
                <div className="text-sm text-dark-400 space-y-1">
                  <p className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {selectedRecord.timestamp.toLocaleString('zh-CN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      weekday: 'long',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </p>
                  <p className="flex items-center gap-2">
                    <Languages className="w-4 h-4" />
                    {getLanguageDisplayName(selectedRecord.sourceLang, LANGUAGES)} → {getLanguageDisplayName(selectedRecord.targetLang, LANGUAGES)}
                  </p>
                </div>

                {/* 原文 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-dark-400">原文</span>
                    <button
                      onClick={() => handleCopy(selectedRecord.sourceText, `source-${selectedRecord.id}`)}
                      className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                      title="复制原文"
                    >
                      {copiedId === `source-${selectedRecord.id}` ? (
                        <Check className="w-4 h-4 text-accent-green" />
                      ) : (
                        <Copy className="w-4 h-4 text-dark-500" />
                      )}
                    </button>
                  </div>
                  <div className="glass-card p-4">
                    <p className="text-dark-200 whitespace-pre-wrap break-words leading-relaxed">
                      {selectedRecord.sourceText}
                    </p>
                  </div>
                </div>

                {/* 译文 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-primary-400">译文</span>
                    <button
                      onClick={() => handleCopy(selectedRecord.targetText, `target-${selectedRecord.id}`)}
                      className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                      title="复制译文"
                    >
                      {copiedId === `target-${selectedRecord.id}` ? (
                        <Check className="w-4 h-4 text-accent-green" />
                      ) : (
                        <Copy className="w-4 h-4 text-dark-500" />
                      )}
                    </button>
                  </div>
                  <div className="glass-card p-4 border-l-2 border-primary-500">
                    <p className="text-dark-100 whitespace-pre-wrap break-words leading-relaxed">
                      {selectedRecord.targetText}
                    </p>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="pt-4 border-t border-white/10 space-y-3">
                  <Button
                    variant="secondary"
                    onClick={() => toggleSessionRecordStarred(selectedRecord.id)}
                    icon={<Star className={`w-4 h-4 ${selectedRecord.starred ? 'text-accent-yellow fill-accent-yellow' : ''}`} />}
                    className="w-full"
                  >
                    {selectedRecord.starred ? '取消重点关注' : '设为重点关注'}
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => deleteSessionRecord(selectedRecord.id)}
                    icon={<Trash2 className="w-4 h-4" />}
                    className="w-full"
                  >
                    删除此记录
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 移动端详情遮罩 */}
        {selectedRecord && (
          <div className="md:hidden fixed inset-0 z-20 bg-dark-900 flex flex-col">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-medium text-dark-100">记录详情</h3>
              <button
                onClick={() => setSelectedRecordId(null)}
                className="p-2 hover:bg-white/10 rounded-lg text-dark-400 hover:text-dark-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* 类型标签 */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${getTypeColor(selectedRecord.type)}`}>
                  {getTypeIcon(selectedRecord.type)}
                  {getTypeLabel(selectedRecord.type)}
                </span>
                {selectedRecord.starred && (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-accent-yellow/20 text-accent-yellow">
                    <Star className="w-4 h-4 fill-accent-yellow" />
                    重点关注
                  </span>
                )}
              </div>

              {/* 时间信息 */}
              <div className="text-sm text-dark-400 space-y-1">
                <p className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {selectedRecord.timestamp.toLocaleString('zh-CN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    weekday: 'long',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </p>
                <p className="flex items-center gap-2">
                  <Languages className="w-4 h-4" />
                  {getLanguageDisplayName(selectedRecord.sourceLang, LANGUAGES)} → {getLanguageDisplayName(selectedRecord.targetLang, LANGUAGES)}
                </p>
              </div>

              {/* 原文 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-dark-400">原文</span>
                  <button
                    onClick={() => handleCopy(selectedRecord.sourceText, `source-m-${selectedRecord.id}`)}
                    className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    {copiedId === `source-m-${selectedRecord.id}` ? (
                      <Check className="w-4 h-4 text-accent-green" />
                    ) : (
                      <Copy className="w-4 h-4 text-dark-500" />
                    )}
                  </button>
                </div>
                <div className="glass-card p-4">
                  <p className="text-dark-200 whitespace-pre-wrap break-words leading-relaxed">
                    {selectedRecord.sourceText}
                  </p>
                </div>
              </div>

              {/* 译文 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-primary-400">译文</span>
                  <button
                    onClick={() => handleCopy(selectedRecord.targetText, `target-m-${selectedRecord.id}`)}
                    className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    {copiedId === `target-m-${selectedRecord.id}` ? (
                      <Check className="w-4 h-4 text-accent-green" />
                    ) : (
                      <Copy className="w-4 h-4 text-dark-500" />
                    )}
                  </button>
                </div>
                <div className="glass-card p-4 border-l-2 border-primary-500">
                  <p className="text-dark-100 whitespace-pre-wrap break-words leading-relaxed">
                    {selectedRecord.targetText}
                  </p>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="pt-4 border-t border-white/10 space-y-3">
                <Button
                  variant="secondary"
                  onClick={() => toggleSessionRecordStarred(selectedRecord.id)}
                  icon={<Star className={`w-4 h-4 ${selectedRecord.starred ? 'text-accent-yellow fill-accent-yellow' : ''}`} />}
                  className="w-full"
                >
                  {selectedRecord.starred ? '取消重点关注' : '设为重点关注'}
                </Button>
                <Button
                  variant="danger"
                  onClick={() => deleteSessionRecord(selectedRecord.id)}
                  icon={<Trash2 className="w-4 h-4" />}
                  className="w-full"
                >
                  删除此记录
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 清空确认弹窗 */}
        {showClearConfirm && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="glass-panel rounded-2xl p-6 max-w-sm mx-4 animate-fade-in">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-accent-yellow/20 rounded-full">
                  <AlertTriangle className="w-6 h-6 text-accent-yellow" />
                </div>
                <div>
                  <h3 className="font-semibold text-dark-100">确认清空</h3>
                  <p className="text-sm text-dark-400">此操作不可撤销</p>
                </div>
              </div>
              <p className="text-sm text-dark-300 mb-6">
                您确定要清空所有 {sessionRecords.length} 条会话记录吗？清空后将无法恢复。
              </p>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1"
                >
                  取消
                </Button>
                <Button
                  variant="danger"
                  onClick={handleClearAll}
                  className="flex-1"
                >
                  确认清空
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 批量操作确认弹窗：执行前确认影响范围 */}
        {confirmBatch && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="glass-panel rounded-2xl p-6 max-w-sm mx-4 animate-fade-in">
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-3 rounded-full ${batchConfirmConfig[confirmBatch.kind].destructive ? 'bg-accent-yellow/20' : 'bg-primary-500/20'}`}>
                  {batchConfirmConfig[confirmBatch.kind].destructive ? (
                    <AlertTriangle className="w-6 h-6 text-accent-yellow" />
                  ) : (
                    <Star className="w-6 h-6 text-primary-400" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-dark-100">
                    {batchConfirmConfig[confirmBatch.kind].title}
                  </h3>
                  <p className="text-sm text-dark-400">
                    影响 {confirmBatch.ids.length} 条记录
                  </p>
                </div>
              </div>
              <div className="text-sm text-dark-300 mb-6 space-y-2">
                <p>{batchConfirmConfig[confirmBatch.kind].describe(confirmBatch.ids.length)}</p>
                {isFilterActive && (
                  <p className="text-dark-500">
                    当前处于筛选状态，仅处理列表中可见的记录
                    {confirmBatch.kind === 'keep' &&
                      `，筛选之外的 ${sessionRecords.length - filteredRecords.length} 条记录不受影响`}
                    。
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setConfirmBatch(null)}
                  className="flex-1"
                >
                  取消
                </Button>
                <Button
                  variant={batchConfirmConfig[confirmBatch.kind].destructive ? 'danger' : 'primary'}
                  onClick={handleConfirmBatch}
                  className="flex-1"
                >
                  {batchConfirmConfig[confirmBatch.kind].confirmLabel}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 批量执行进度弹窗：逐条反馈成功与失败 */}
        {execution && execCounts && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="glass-panel rounded-2xl p-6 max-w-md w-full mx-4 animate-fade-in flex flex-col max-h-[80vh]">
              <div className="flex items-center gap-3 mb-4 flex-shrink-0">
                <div className="p-3 bg-primary-500/20 rounded-full">
                  {execution.finished ? (
                    <CheckCircle2 className="w-6 h-6 text-accent-green" />
                  ) : (
                    <Loader2 className="w-6 h-6 text-primary-400 animate-spin" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-dark-100">
                    批量{BATCH_OP_LABELS[execution.op]}{execution.finished ? '结果' : '进行中'}
                  </h3>
                  <p className="text-sm text-dark-400">
                    成功 {execCounts.success} · 失败 {execCounts.failed}
                    {execution.finished && execCounts.pending > 0 && ` · 未处理 ${execCounts.pending}`}
                  </p>
                </div>
              </div>

              {/* 进度条 */}
              <div className="h-2 bg-dark-700 rounded-full overflow-hidden mb-1 flex-shrink-0">
                <div
                  className="h-full bg-primary-500 transition-all duration-200"
                  style={{
                    width: `${execution.items.length === 0 ? 0 : ((execCounts.success + execCounts.failed) / execution.items.length) * 100}%`,
                  }}
                />
              </div>
              <p className="text-xs text-dark-500 mb-3 flex-shrink-0">
                已处理 {execCounts.success + execCounts.failed} / {execution.items.length} 条
              </p>

              {/* 逐条状态列表 */}
              <div className="flex-1 overflow-y-auto space-y-1.5 mb-4 min-h-0">
                {execution.items.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-800/50"
                  >
                    {renderBatchItemStatus(item)}
                    <span className="flex-1 text-sm text-dark-300 truncate">{item.label}</span>
                    {item.status === 'failed' && (
                      <span className="text-xs text-accent-red flex-shrink-0">{item.reason}</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-3 flex-shrink-0">
                {!execution.finished ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      cancelRef.current = true;
                    }}
                    className="flex-1"
                  >
                    取消
                  </Button>
                ) : (
                  <>
                    {(execCounts.failed > 0 || execCounts.pending > 0) && (
                      <Button
                        variant="secondary"
                        onClick={handleRetryBatch}
                        className="flex-1"
                      >
                        重试未完成的 {execCounts.failed + execCounts.pending} 条
                      </Button>
                    )}
                    <Button
                      variant="primary"
                      onClick={() => setExecution(null)}
                      className="flex-1"
                    >
                      关闭
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

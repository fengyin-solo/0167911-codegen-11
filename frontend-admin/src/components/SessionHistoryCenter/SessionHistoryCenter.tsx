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
  StarOff,
  ListChecks,
  Minus,
  CheckCheck,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { Button } from '@/components/ui';
import { LANGUAGES } from '@/utils/constants';
import { formatTime, getLanguageDisplayName, truncateText } from '@/utils/helpers';
import {
  runBatchItems,
  type BatchItem,
  type BatchActionKind,
} from '@/utils/batchOperations';
import { BatchConfirmDialog } from './BatchConfirmDialog';
import { BatchProgressDialog } from './BatchProgressDialog';
import type { SessionRecord, SessionRecordType } from '@/types';

type FilterType = 'all' | SessionRecordType;

const makeBatchLabel = (record: SessionRecord): string =>
  `${formatTime(record.timestamp)} ${truncateText(record.sourceText.replace(/\s+/g, ' '), 20)}`;

export const SessionHistoryCenter: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const sessionRecords = useAppStore(state => state.sessionRecords);
  const deleteSessionRecord = useAppStore(state => state.deleteSessionRecord);
  const setSessionRecordStarred = useAppStore(state => state.setSessionRecordStarred);
  const clearSessionRecords = useAppStore(state => state.clearSessionRecords);
  const addToast = useAppStore(state => state.addToast);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // 多选相关状态
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 批量操作：pendingAction 表示确认弹窗中的操作；batch 表示执行中的任务
  const [pendingAction, setPendingAction] = useState<BatchActionKind | null>(null);
  const [batch, setBatch] = useState<{
    action: BatchActionKind;
    items: BatchItem[];
    running: boolean;
  } | null>(null);
  const batchItemsRef = useRef<BatchItem[]>([]);

  const filteredRecords = useMemo(() => {
    return sessionRecords.filter(record => {
      const matchesType = filterType === 'all' || record.type === filterType;
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

  // 详情记录直接从 store 派生：重点关注状态更新后详情同步刷新，删除后自动消失
  const selectedRecord = useMemo(
    () => sessionRecords.find(r => r.id === selectedRecordId) ?? null,
    [sessionRecords, selectedRecordId]
  );

  const visibleIds = useMemo(() => new Set(filteredRecords.map(r => r.id)), [filteredRecords]);
  const visibleCount = filteredRecords.length;
  const hiddenCount = sessionRecords.length - visibleCount;
  const selectedCount = useMemo(
    () => filteredRecords.filter(r => selectedIds.has(r.id)).length,
    [filteredRecords, selectedIds]
  );
  const allVisibleSelected = visibleCount > 0 && selectedCount === visibleCount;
  const someVisibleSelected = selectedCount > 0 && !allVisibleSelected;

  // 筛选/搜索变化后，勾选集合中已经不可见的记录自动移除，保证批量操作只作用于当前看得到的
  useEffect(() => {
    setSelectedIds(prev => {
      const next = new Set([...prev].filter(id => visibleIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [visibleIds]);

  // 当前可见列表为空时退出多选模式
  useEffect(() => {
    if (selectMode && visibleCount === 0) {
      setSelectMode(false);
    }
  }, [selectMode, visibleCount]);

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

  const handleDelete = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    deleteSessionRecord(id);
    if (selectedRecordId === id) {
      setSelectedRecordId(null);
    }
    setSelectedIds(prev => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleClearAll = () => {
    clearSessionRecords();
    setShowClearConfirm(false);
    setSelectedRecordId(null);
    setSelectedIds(new Set());
    setSelectMode(false);
  };

  const toggleStar = (id: string) => {
    const record = sessionRecords.find(r => r.id === id);
    if (!record) return;
    const next = !record.starred;
    setSessionRecordStarred(id, next);
    addToast('success', next ? '已设为重点关注' : '已取消重点关注');
  };

  // ---------- 多选 ----------

  const enterSelectMode = () => {
    setSelectMode(true);
    setSelectedRecordId(null);
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
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

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRecords.map(r => r.id)));
    }
  };

  // ---------- 批量操作 ----------

  // 批量操作的目标：删除/改关注作用于选中项；仅保留作用于可见且未选中项。
  // 数据来源始终是 filteredRecords，筛选状态下绝不触碰不可见记录。
  const resolveTargets = (action: BatchActionKind): SessionRecord[] => {
    if (action === 'keepOnly') {
      return filteredRecords.filter(r => !selectedIds.has(r.id));
    }
    return filteredRecords.filter(r => selectedIds.has(r.id));
  };

  const commitByAction = (action: BatchActionKind, id: string) => {
    if (action === 'delete' || action === 'keepOnly') {
      deleteSessionRecord(id, true);
    } else {
      setSessionRecordStarred(id, action === 'star');
    }
  };

  const updateBatchItem = (id: string, status: BatchItem['status'], error?: string) => {
    batchItemsRef.current = batchItemsRef.current.map(item =>
      item.id === id ? { ...item, status, error } : item
    );
    setBatch(prev => (prev ? { ...prev, items: batchItemsRef.current } : prev));
  };

  const processItems = async (action: BatchActionKind, queuedItems: BatchItem[]) => {
    const result = await runBatchItems(queuedItems, {
      onItemChange: updateBatchItem,
      onCommit: id => commitByAction(action, id),
    });

    setBatch(prev => (prev ? { ...prev, running: false } : prev));

    // 删除类操作：成功的记录已从列表移除
    if (action === 'delete') {
      // 只保留仍失败（未被删除）的勾选，方便继续处理；全部成功则清空
      if (result.failedIds.length === 0) {
        setSelectedIds(new Set());
      } else {
        const failedSet = new Set(result.failedIds);
        setSelectedIds(prev => new Set([...prev].filter(id => failedSet.has(id))));
      }
    } else if (action === 'keepOnly') {
      // 被删除的是非选中项；选中项全部保留，维持勾选不变，失败项也仍在列表中
      const failedSet = new Set(result.failedIds);
      setSelectedIds(prev => {
        const next = new Set(prev);
        failedSet.forEach(id => next.delete(id));
        return next;
      });
    }

    const actionLabel =
      action === 'delete' ? '删除' : action === 'keepOnly' ? '保留筛选' : '重点关注更新';
    if (result.failedIds.length === 0) {
      addToast('success', `批量${actionLabel}完成，${result.succeededIds.length} 条全部成功`);
    } else if (result.succeededIds.length > 0) {
      addToast(
        'warning',
        `批量${actionLabel}：${result.succeededIds.length} 条成功，${result.failedIds.length} 条失败且保持原样，可重试`
      );
    } else {
      addToast('error', `批量${actionLabel}全部失败，${result.failedIds.length} 条记录保持原样`);
    }
  };

  const startBatch = (action: BatchActionKind, items: BatchItem[]) => {
    batchItemsRef.current = items;
    setBatch({ action, items, running: true });
    void processItems(action, items);
  };

  const handleBatchConfirm = () => {
    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);
    const targets = resolveTargets(action);
    if (targets.length === 0) {
      addToast('warning', '没有可操作的记录');
      return;
    }
    startBatch(
      action,
      targets.map(record => ({
        id: record.id,
        label: makeBatchLabel(record),
        status: 'pending',
      }))
    );
  };

  const handleRetryFailed = () => {
    if (!batch) return;
    const failedIds = new Set(batchItemsRef.current.filter(i => i.status === 'failed').map(i => i.id));
    const retryingItems: BatchItem[] = batchItemsRef.current
      .filter(i => failedIds.has(i.id))
      .map(i => ({ ...i, status: 'pending', error: undefined }));
    if (retryingItems.length === 0) return;

    // 失败项在原列表中回到「等待中」，成功项状态保留不动
    batchItemsRef.current = batchItemsRef.current.map(i =>
      failedIds.has(i.id) ? { ...i, status: 'pending', error: undefined } : i
    );
    setBatch(prev => (prev ? { ...prev, items: batchItemsRef.current, running: true } : prev));
    void processItems(batch.action, retryingItems);
  };

  const handleBatchClose = () => {
    if (batch?.running) return;
    batchItemsRef.current = [];
    setBatch(null);
  };

  // 确认弹窗展示的影响范围
  const confirmAffectedCount =
    pendingAction === 'keepOnly'
      ? Math.max(visibleCount - selectedCount, 0)
      : selectedCount;

  // ---------- 展示辅助 ----------

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

  const filterOptions: { value: FilterType; label: string }[] = [
    { value: 'all', label: '全部记录' },
    { value: 'voice', label: '语音识别' },
    { value: 'manual', label: '手动翻译' },
  ];

  const renderCheckbox = (checked: boolean, indeterminate = false) => (
    <span
      className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${
        checked || indeterminate
          ? 'bg-primary-600 border-primary-600 text-white'
          : 'border-white/25 text-transparent hover:border-primary-400'
      }`}
    >
      {indeterminate ? <Minus className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
    </span>
  );

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
              <>
                <Button
                  variant={selectMode ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={selectMode ? exitSelectMode : enterSelectMode}
                  icon={<ListChecks className="w-4 h-4" />}
                >
                  {selectMode ? '退出多选' : '多选'}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setShowClearConfirm(true)}
                  icon={<Trash2 className="w-4 h-4" />}
                >
                  清空全部
                </Button>
              </>
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

        {/* 多选批量操作条 */}
        {selectMode && (
          <div className="px-4 py-3 border-b border-white/10 flex-shrink-0 bg-primary-500/5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-2 text-sm text-dark-200 hover:text-dark-100 transition-colors"
              >
                {renderCheckbox(allVisibleSelected, someVisibleSelected)}
                <span>
                  全选当前列表（{selectedCount}/{visibleCount}）
                </span>
              </button>
              <span className="text-xs text-dark-500">
                已选 {selectedCount} 条{hiddenCount > 0 ? ` · ${hiddenCount} 条被筛选隐藏，不会被操作` : ''}
              </span>
              <div className="flex items-center gap-2 ml-auto flex-wrap">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={selectedCount === 0}
                  onClick={() => setPendingAction('star')}
                  icon={<Star className="w-4 h-4" />}
                >
                  设为关注
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={selectedCount === 0}
                  onClick={() => setPendingAction('unstar')}
                  icon={<StarOff className="w-4 h-4" />}
                >
                  取消关注
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={selectedCount === 0 || visibleCount - selectedCount === 0}
                  onClick={() => setPendingAction('keepOnly')}
                  icon={<CheckCheck className="w-4 h-4" />}
                >
                  仅保留选中
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={selectedCount === 0}
                  onClick={() => setPendingAction('delete')}
                  icon={<Trash2 className="w-4 h-4" />}
                >
                  批量删除
                </Button>
              </div>
            </div>
          </div>
        )}

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
                      {records.map(record => {
                        const isSelected = selectedIds.has(record.id);
                        return (
                          <div
                            key={record.id}
                            onClick={() => (selectMode ? toggleSelect(record.id) : setSelectedRecordId(record.id))}
                            className={`glass-card p-4 cursor-pointer transition-all hover:bg-white/5 group ${
                              isSelected
                                ? 'ring-2 ring-primary-500/60 bg-primary-500/10'
                                : selectedRecord?.id === record.id
                                  ? 'ring-2 ring-primary-500/50 bg-white/5'
                                  : ''
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              {selectMode && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleSelect(record.id);
                                  }}
                                  className="mt-0.5 mr-1"
                                  title={isSelected ? '取消选择' : '选择'}
                                >
                                  {renderCheckbox(isSelected)}
                                </button>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getTypeColor(record.type)}`}>
                                    {getTypeIcon(record.type)}
                                    {getTypeLabel(record.type)}
                                  </span>
                                  <span className="text-xs text-dark-600 font-mono">
                                    {formatTime(record.timestamp)}
                                  </span>
                                  <span className="text-xs text-dark-600">
                                    {getLanguageDisplayName(record.sourceLang, LANGUAGES)} → {getLanguageDisplayName(record.targetLang, LANGUAGES)}
                                  </span>
                                  {record.starred && (
                                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-medium bg-accent-yellow/20 text-accent-yellow">
                                      <Star className="w-3 h-3 fill-current" />
                                      重点
                                    </span>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleStar(record.id);
                                    }}
                                    title={record.starred ? '取消重点关注' : '设为重点关注'}
                                    className={`p-1 rounded-lg transition-colors ${
                                      record.starred
                                        ? 'text-accent-yellow hover:bg-accent-yellow/20'
                                        : 'text-dark-600 hover:bg-white/10 hover:text-accent-yellow'
                                    }`}
                                  >
                                    <Star className={`w-3.5 h-3.5 ${record.starred ? 'fill-current' : ''}`} />
                                  </button>
                                </div>
                                <p className="text-sm text-dark-300 truncate mb-1">
                                  {truncateText(record.sourceText, 60)}
                                </p>
                                <p className="text-sm text-dark-100 truncate">
                                  {truncateText(record.targetText, 60)}
                                </p>
                              </div>
                              {!selectMode && (
                                <button
                                  onClick={(e) => handleDelete(record.id, e)}
                                  className="p-2 opacity-0 group-hover:opacity-100 hover:bg-accent-red/20 text-dark-500 hover:text-accent-red rounded-lg transition-all"
                                  title="删除记录"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
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
                <h3 className="font-medium text-dark-100 flex items-center gap-2">
                  记录详情
                  {selectedRecord.starred && (
                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-medium bg-accent-yellow/20 text-accent-yellow">
                      <Star className="w-3 h-3 fill-current" />
                      重点关注
                    </span>
                  )}
                </h3>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleStar(selectedRecord.id)}
                    title={selectedRecord.starred ? '取消重点关注' : '设为重点关注'}
                    className={`p-1.5 hover:bg-white/10 rounded-lg transition-colors ${
                      selectedRecord.starred ? 'text-accent-yellow' : 'text-dark-500 hover:text-dark-100'
                    }`}
                  >
                    <Star className={`w-4 h-4 ${selectedRecord.starred ? 'fill-current' : ''}`} />
                  </button>
                  <button
                    onClick={() => setSelectedRecordId(null)}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-dark-500 hover:text-dark-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* 类型标签 */}
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${getTypeColor(selectedRecord.type)}`}>
                    {getTypeIcon(selectedRecord.type)}
                    {getTypeLabel(selectedRecord.type)}
                  </span>
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
                <div className="pt-4 border-t border-white/10 flex gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => toggleStar(selectedRecord.id)}
                    icon={
                      selectedRecord.starred ? (
                        <StarOff className="w-4 h-4" />
                      ) : (
                        <Star className="w-4 h-4" />
                      )
                    }
                  >
                    {selectedRecord.starred ? '取消关注' : '设为关注'}
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => handleDelete(selectedRecord.id)}
                    icon={<Trash2 className="w-4 h-4" />}
                    className="flex-1"
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
              <div className="flex items-center gap-1">
                <button
                  onClick={() => toggleStar(selectedRecord.id)}
                  className={`p-2 hover:bg-white/10 rounded-lg ${
                    selectedRecord.starred ? 'text-accent-yellow' : 'text-dark-400 hover:text-dark-100'
                  }`}
                >
                  <Star className={`w-5 h-5 ${selectedRecord.starred ? 'fill-current' : ''}`} />
                </button>
                <button
                  onClick={() => setSelectedRecordId(null)}
                  className="p-2 hover:bg-white/10 rounded-lg text-dark-400 hover:text-dark-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* 类型标签 */}
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${getTypeColor(selectedRecord.type)}`}>
                  {getTypeIcon(selectedRecord.type)}
                  {getTypeLabel(selectedRecord.type)}
                </span>
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
              <div className="pt-4 border-t border-white/10 flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => toggleStar(selectedRecord.id)}
                  icon={
                    selectedRecord.starred ? (
                      <StarOff className="w-4 h-4" />
                    ) : (
                      <Star className="w-4 h-4" />
                    )
                  }
                >
                  {selectedRecord.starred ? '取消关注' : '设为关注'}
                </Button>
                <Button
                  variant="danger"
                  onClick={() => handleDelete(selectedRecord.id)}
                  icon={<Trash2 className="w-4 h-4" />}
                  className="flex-1"
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

        {/* 批量操作影响范围确认弹窗 */}
        {pendingAction && (
          <BatchConfirmDialog
            action={pendingAction}
            affectedCount={confirmAffectedCount}
            visibleCount={visibleCount}
            hiddenCount={hiddenCount}
            onConfirm={handleBatchConfirm}
            onCancel={() => setPendingAction(null)}
          />
        )}

        {/* 批量执行进度 / 结果弹窗 */}
        {batch && (
          <BatchProgressDialog
            action={batch.action}
            items={batch.items}
            running={batch.running}
            onRetry={handleRetryFailed}
            onClose={handleBatchClose}
          />
        )}
      </div>
    </div>
  );
};

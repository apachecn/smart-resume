import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Eye, RotateCcw, Trash2, X } from 'lucide-react';
import { HistoryChange, HistoryRecord, clearHistoryRecords, getHistory } from '../lib/storage';

interface HistoryPanelProps {
  isOpen: boolean;
  refreshKey: number;
  selectedRecordId: string | null;
  previewChanges: HistoryChange[];
  onClose: () => void;
  onPreview: (record: HistoryRecord | null) => void;
  onRestore: (record: HistoryRecord) => void;
}

const formatValue = (value: any) => {
  if (value === undefined || value === null || value === '') return '空';
  if (Array.isArray(value)) return `${value.length}项`;
  if (typeof value === 'object') {
    if ('x' in value && 'y' in value) return `x:${value.x}, y:${value.y}`;
    if ('width' in value && 'height' in value) return `${value.width} x ${value.height}`;
    return '已更新';
  }
  return String(value).replace(/\s+/g, ' ').slice(0, 72);
};

const changeTone = (change?: HistoryChange) => {
  if (change?.type === 'added') return 'text-emerald-700 bg-emerald-50 border-emerald-100';
  if (change?.type === 'removed') return 'text-rose-700 bg-rose-50 border-rose-100';
  return 'text-blue-700 bg-blue-50 border-blue-100';
};

const changeTypeText = (change?: HistoryChange) => {
  if (change?.type === 'added') return '新增';
  if (change?.type === 'removed') return '删除';
  return '修改';
};

export default function HistoryPanel({ isOpen, refreshKey, selectedRecordId, previewChanges, onClose, onPreview, onRestore }: HistoryPanelProps) {
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, refreshKey]);

  const loadHistory = async () => {
    setLoading(true);
    const records = await getHistory();
    setHistory(records);
    setLoading(false);
  };

  const handleRestore = (record: HistoryRecord) => {
    if (confirm(`确定要恢复到「${record.description}」这个版本吗？`)) {
      onRestore(record);
    }
  };

  const handleClearAll = async () => {
    if (confirm('确定要清除所有历史记录吗？当前简历不会被删除。')) {
      await clearHistoryRecords();
      setHistory([]);
      onPreview(null);
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;

    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

  return (
    <aside className="fixed right-0 top-16 bottom-0 z-40 w-[380px] bg-white border-l border-slate-200 shadow-2xl flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="text-resume-blue" size={20} />
            <h2 className="text-base font-bold text-slate-900">历史记录</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">点击记录预览，确认后再还原</p>
        </div>
        <div className="flex items-center gap-1">
          {history.length > 0 && (
            <button
              onClick={handleClearAll}
              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
              title="清除历史记录"
            >
              <Trash2 size={17} />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-all"
            title="关闭历史记录"
          >
            <X size={19} />
          </button>
        </div>
      </div>

      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
        共 {history.length} 条记录
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-400">加载中...</div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 px-8 text-center">
            <Clock size={44} className="mb-4 opacity-40" />
            <p className="font-medium">暂无编辑历史</p>
            <p className="text-xs mt-2">修改表单或画布后会自动记录具体变更</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {history.map((record, index) => {
              const active = record.id === selectedRecordId;
              const changes = active ? previewChanges : (record.changes ?? []);
              const visibleChanges = changes.slice(0, active ? 6 : 3);

              return (
                <div
                  role="button"
                  tabIndex={0}
                  key={record.id}
                  onClick={() => onPreview(record)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onPreview(record);
                    }
                  }}
                  className={`w-full text-left px-5 py-4 transition-all ${
                    active
                      ? 'bg-blue-50 border-l-4 border-resume-blue'
                      : 'bg-white border-l-4 border-transparent hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 truncate">{record.description}</span>
                        {index === 0 && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold text-blue-700 bg-blue-100 rounded">
                            最新
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                        <span>{formatTime(record.timestamp)}</span>
                        {active && (
                          <span className="inline-flex items-center gap-1 text-resume-blue font-semibold">
                            <Eye size={12} /> 预览中
                          </span>
                        )}
                      </div>
                    </div>
                    {active && <CheckCircle2 size={17} className="text-resume-blue flex-shrink-0 mt-0.5" />}
                  </div>

                  {visibleChanges.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {visibleChanges.map((change, changeIndex) => (
                        <div key={`${record.id}-${change.path ?? change.field}-${changeIndex}`} className="rounded-lg border border-slate-200 bg-white p-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-700 truncate">{change.field}</span>
                            <span className={`shrink-0 px-1.5 py-0.5 rounded border text-[10px] font-bold ${changeTone(change)}`}>
                              {changeTypeText(change)}
                            </span>
                          </div>
                          {active ? (
                            <div className="mt-1 grid grid-cols-[42px_1fr] gap-x-1 gap-y-0.5 text-[10px] leading-4">
                              <span className="text-slate-400">变更前</span>
                              <span className="text-slate-500 truncate line-through decoration-rose-500 decoration-2">
                                {formatValue(change.oldValue)}
                              </span>
                              <span className="text-slate-400">变更后</span>
                              <span className="text-slate-800 truncate font-semibold">{formatValue(change.newValue)}</span>
                            </div>
                          ) : (
                            <div className="mt-1 grid grid-cols-[28px_1fr] gap-x-1 gap-y-0.5 text-[10px] leading-4">
                              <span className="text-slate-400">原</span>
                              <span className="text-slate-500 truncate line-through decoration-slate-300">
                                {formatValue(change.oldValue)}
                              </span>
                              <span className="text-slate-400">新</span>
                              <span className="text-slate-700 truncate">{formatValue(change.newValue)}</span>
                            </div>
                          )}
                        </div>
                      ))}
                      {changes.length > visibleChanges.length && (
                        <div className="text-[11px] text-slate-400">还有 {changes.length - visibleChanges.length} 处变更</div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 text-xs text-slate-400">此旧记录没有详细变更，但仍可预览快照</div>
                  )}

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">作者：本地编辑</span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleRestore(record);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-resume-blue hover:bg-blue-100 rounded-lg transition-all"
                    >
                      <RotateCcw size={13} /> 还原
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

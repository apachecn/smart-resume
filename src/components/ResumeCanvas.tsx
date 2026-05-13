import React, { forwardRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Copy, Sparkles, Trash2 } from 'lucide-react';
import { CanvasElement, CanvasGuide } from '../types';
import { areElementListsEqual } from '../lib/commandHistory';
import {
  A4_HEIGHT,
  A4_WIDTH,
  deleteElementsAndReflow,
  duplicateElement,
  getTextElementWhiteSpace,
  getResumeCanvasHeight,
  snapElementPosition,
  updateTextElementAndReflow,
} from '../lib/resumeCanvas';

interface ResumeCanvasProps {
  elements: CanvasElement[];
  onElementsChange: React.Dispatch<React.SetStateAction<CanvasElement[]>>;
  onExecuteElementsChange: (description: string, before: CanvasElement[], after: CanvasElement[], mergeKey?: string) => void;
  onRecordElementsChange: (description: string, before: CanvasElement[], after: CanvasElement[], mergeKey?: string) => void;
  onTextCommit?: (id: string, value: string) => void;
  readOnly?: boolean;
  historyHighlightIds?: string[];
  historyHighlightLabels?: Record<string, string>;
  historyPositionOverlays?: HistoryPositionOverlay[];
}

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HistoryPositionOverlay {
  id: string;
  label: string;
  before: Bounds;
  after: Bounds;
}

interface SelectionBox extends Bounds {
  startX: number;
  startY: number;
}

interface MoveDragState {
  mode: 'move';
  pointerId: number;
  startX: number;
  startY: number;
  ids: string[];
  beforeElements: CanvasElement[];
  groupBounds: Bounds;
  originPositions: Map<string, { x: number; y: number }>;
}

interface MarqueeDragState {
  mode: 'marquee';
  pointerId: number;
  startX: number;
  startY: number;
  initialSelectedIds: string[];
}

type DragState = MoveDragState | MarqueeDragState;

const textStyle = (element: CanvasElement): React.CSSProperties => ({
  color: element.style?.color,
  fontSize: element.style?.fontSize,
  fontWeight: element.style?.fontWeight,
  lineHeight: element.style?.lineHeight,
  textAlign: element.style?.textAlign,
  textDecoration: element.style?.textDecoration,
  whiteSpace: getTextElementWhiteSpace(element),
});

const getBounds = (items: CanvasElement[]): Bounds | null => {
  if (!items.length) return null;
  const left = Math.min(...items.map((item) => item.x));
  const top = Math.min(...items.map((item) => item.y));
  const right = Math.max(...items.map((item) => item.x + item.width));
  const bottom = Math.max(...items.map((item) => item.y + item.height));

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
};

const normalizeSelectionBox = (startX: number, startY: number, x: number, y: number): SelectionBox => ({
  startX,
  startY,
  x: Math.min(startX, x),
  y: Math.min(startY, y),
  width: Math.abs(x - startX),
  height: Math.abs(y - startY),
});

const intersects = (box: Bounds, element: CanvasElement) =>
  element.x < box.x + box.width &&
  element.x + element.width > box.x &&
  element.y < box.y + box.height &&
  element.y + element.height > box.y;

const unique = (ids: string[]) => [...new Set(ids)];

const measureTextareaContentHeight = (textarea: HTMLTextAreaElement) => {
  const previousHeight = textarea.style.height;
  textarea.style.height = '0px';
  const measuredHeight = Math.ceil(textarea.scrollHeight);
  textarea.style.height = previousHeight;
  return measuredHeight;
};

const measureTextContentHeight = (node: HTMLElement) => {
  const previousHeight = node.style.height;
  node.style.height = 'auto';
  const measuredHeight = Math.ceil(node.scrollHeight) + 2;
  node.style.height = previousHeight;
  return measuredHeight;
};

const ResumeCanvas = forwardRef<HTMLDivElement, ResumeCanvasProps>(
  (
    {
      elements,
      onElementsChange,
      onExecuteElementsChange,
      onRecordElementsChange,
      onTextCommit,
      readOnly = false,
      historyHighlightIds = [],
      historyHighlightLabels = {},
      historyPositionOverlays = [],
    },
    ref
  ) => {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [guides, setGuides] = useState<CanvasGuide[]>([]);
    const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
    const elementsRef = useRef(elements);
    const dragState = useRef<DragState | null>(null);
    const sheetRef = useRef<HTMLDivElement | null>(null);
    const editingTextareaRef = useRef<HTMLTextAreaElement | null>(null);
    const textMeasureNodesRef = useRef<Map<string, HTMLElement>>(new Map());
    const editBeforeRef = useRef<CanvasElement[] | null>(null);
    const canvasHeight = getResumeCanvasHeight(elements);
    const pageCount = Math.max(1, Math.ceil(canvasHeight / A4_HEIGHT));

    const setSheetNode = useCallback(
      (node: HTMLDivElement | null) => {
        sheetRef.current = node;
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }
      },
      [ref]
    );

    useEffect(() => {
      elementsRef.current = elements;
      setSelectedIds((current) => current.filter((id) => elements.some((element) => element.id === id)));
    }, [elements]);

    useEffect(() => {
      if (!readOnly) return;
      setSelectedIds([]);
      setEditingId(null);
      setGuides([]);
      setSelectionBox(null);
      dragState.current = null;
    }, [readOnly]);

    const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
    const historyHighlightSet = useMemo(() => new Set(historyHighlightIds), [historyHighlightIds]);
    const selectedElements = useMemo(
      () => elements.filter((element) => selectedSet.has(element.id)),
      [elements, selectedSet]
    );
    const selectedBounds = useMemo(() => getBounds(selectedElements), [selectedElements]);

    const getConnectorStyle = (overlay: HistoryPositionOverlay): React.CSSProperties => {
      const beforeCenter = {
        x: overlay.before.x + overlay.before.width / 2,
        y: overlay.before.y + overlay.before.height / 2,
      };
      const afterCenter = {
        x: overlay.after.x + overlay.after.width / 2,
        y: overlay.after.y + overlay.after.height / 2,
      };
      const dx = afterCenter.x - beforeCenter.x;
      const dy = afterCenter.y - beforeCenter.y;

      return {
        left: beforeCenter.x,
        top: beforeCenter.y,
        width: Math.max(1, Math.hypot(dx, dy)),
        transform: `rotate(${Math.atan2(dy, dx)}rad)`,
      };
    };

    const applyLiveElements = (next: CanvasElement[]) => {
      elementsRef.current = next;
      onElementsChange(next);
    };

    const getCanvasPoint = (event: React.PointerEvent<HTMLDivElement>) => {
      const rect = sheetRef.current?.getBoundingClientRect();
      return {
        x: event.clientX - (rect?.left ?? 0),
        y: event.clientY - (rect?.top ?? 0),
      };
    };

    const finishEditing = () => {
      const before = editBeforeRef.current;
      const currentEditingId = editingId;
      editBeforeRef.current = null;
      setEditingId(null);

      if (!before || !currentEditingId) return;

      const currentElement = elementsRef.current.find((el) => el.id === currentEditingId);
      const currentText = currentElement?.text?.trim() || '';

      if (currentText === '') {
        applyLiveElements(before);
        return;
      }

      if (!areElementListsEqual(before, elementsRef.current)) {
        onRecordElementsChange('编辑文字', before, elementsRef.current);
      }

      if (currentElement) {
        onTextCommit?.(currentEditingId, currentElement.text ?? '');
      }
    };

    const updateElementText = (id: string, value: string, measuredHeight?: number) => {
      applyLiveElements(updateTextElementAndReflow(elementsRef.current, id, value, measuredHeight));
    };

    const setTextMeasureNode = useCallback((id: string, node: HTMLElement | null) => {
      if (node) {
        textMeasureNodesRef.current.set(id, node);
      } else {
        textMeasureNodesRef.current.delete(id);
      }
    }, []);

    useLayoutEffect(() => {
      if (readOnly || editingId) return;
      let cancelled = false;
      let fontFrameId: number | null = null;

      const measureAndReflow = () => {
        if (cancelled) return;

        let next = elementsRef.current;
        const measurableTextElements = next
          .filter((element) => {
            if (element.type !== 'text') return false;
            if (element.id === editingId) return false;
            return getTextElementWhiteSpace(element) !== 'nowrap';
          })
          .sort((left, right) => left.y - right.y);

        measurableTextElements.forEach((element) => {
          const node = textMeasureNodesRef.current.get(element.id);
          if (!node) return;

          const measuredHeight = measureTextContentHeight(node);
          const current = next.find((item) => item.id === element.id);
          if (!current || Math.abs((current.height ?? 0) - measuredHeight) <= 1) return;

          next = updateTextElementAndReflow(next, element.id, element.text ?? '', measuredHeight);
        });

        if (!areElementListsEqual(elementsRef.current, next)) {
          applyLiveElements(next);
        }
      };

      const frameId = window.requestAnimationFrame(measureAndReflow);
      document.fonts?.ready.then(() => {
        if (!cancelled) {
          fontFrameId = window.requestAnimationFrame(measureAndReflow);
        }
      });

      return () => {
        cancelled = true;
        window.cancelAnimationFrame(frameId);
        if (fontFrameId !== null) window.cancelAnimationFrame(fontFrameId);
      };
    }, [editingId, elements, readOnly]);

    useEffect(() => {
      if (!editingId || !editingTextareaRef.current) return;

      const frameId = window.requestAnimationFrame(() => {
        const textarea = editingTextareaRef.current;
        if (!textarea) return;

        const next = updateTextElementAndReflow(
          elementsRef.current,
          editingId,
          textarea.value,
          measureTextareaContentHeight(textarea)
        );

        if (!areElementListsEqual(elementsRef.current, next)) {
          applyLiveElements(next);
        }
      });

      return () => window.cancelAnimationFrame(frameId);
    }, [editingId, elements]);

    const startEditing = (element: CanvasElement) => {
      if (element.type !== 'text') return;
      editBeforeRef.current = elementsRef.current;
      setSelectedIds([element.id]);
      setEditingId(element.id);
    };

    const isSectionTitle = (id: string) => {
      return id.endsWith('-title') || id === 'name' || id === 'title';
    };

    const duplicateSelected = () => {
      const current = elementsRef.current;
      const targets = current.filter((element) => selectedSet.has(element.id));
      if (!targets.length) return;

      const copies = targets.map((element, index) => duplicateElement(element, current, index));
      onExecuteElementsChange('复制元素', current, [...current, ...copies]);
      setSelectedIds(copies.map((copy) => copy.id));
      setEditingId(null);
    };

    const deleteSelected = () => {
      if (!selectedIds.length) return;
      const current = elementsRef.current;
      const next = deleteElementsAndReflow(current, selectedIds);
      onExecuteElementsChange(selectedIds.length > 1 ? '删除多个元素' : '删除元素', current, next);
      setSelectedIds([]);
      setEditingId(null);
    };

    const moveSelectedByKeyboard = (dx: number, dy: number) => {
      if (!selectedIds.length) return;
      const current = elementsRef.current;
      const next = current.map((element) =>
        selectedSet.has(element.id)
          ? {
              ...element,
              x: Math.max(0, Math.min(A4_WIDTH - element.width, element.x + dx)),
              y: Math.max(0, element.y + dy),
            }
          : element
      );

      onExecuteElementsChange('移动元素', current, next, `keyboard-move:${selectedIds.join(',')}`);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (readOnly) return;
      const target = event.target as HTMLElement;
      if (target.tagName === 'TEXTAREA') return;

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedIds.length) {
        event.preventDefault();
        deleteSelected();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd' && selectedIds.length) {
        event.preventDefault();
        duplicateSelected();
        return;
      }

      const step = event.shiftKey ? 10 : 1;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        moveSelectedByKeyboard(-step, 0);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        moveSelectedByKeyboard(step, 0);
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveSelectedByKeyboard(0, -step);
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveSelectedByKeyboard(0, step);
      }
      if (event.key === 'Escape') {
        setSelectedIds([]);
        setEditingId(null);
      }
    };

    const startMove = (event: React.PointerEvent<HTMLDivElement>, element: CanvasElement) => {
      if (readOnly) return;
      if (editingId === element.id) return;
      if (event.button !== 0) return;

      event.preventDefault();
      event.stopPropagation();
      sheetRef.current?.focus({ preventScroll: true });

      if (event.shiftKey || event.metaKey) {
        setSelectedIds((current) =>
          current.includes(element.id) ? current.filter((id) => id !== element.id) : [...current, element.id]
        );
        return;
      }

      const currentElements = elementsRef.current;
      const nextSelectedIds = selectedSet.has(element.id) ? selectedIds : [element.id];
      const movingElements = currentElements.filter((item) => nextSelectedIds.includes(item.id));
      const groupBounds = getBounds(movingElements);
      if (!groupBounds) return;

      setSelectedIds(nextSelectedIds);
      setEditingId(null);
      event.currentTarget.setPointerCapture(event.pointerId);

      dragState.current = {
        mode: 'move',
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        ids: nextSelectedIds,
        beforeElements: currentElements,
        groupBounds,
        originPositions: new Map(movingElements.map((item) => [item.id, { x: item.x, y: item.y }])),
      };
    };

    const startMarquee = (event: React.PointerEvent<HTMLDivElement>) => {
      if (readOnly) return;
      if (event.button !== 0) return;
      if (event.target !== event.currentTarget) return;

      const point = getCanvasPoint(event);
      sheetRef.current?.focus({ preventScroll: true });
      event.currentTarget.setPointerCapture(event.pointerId);

      dragState.current = {
        mode: 'marquee',
        pointerId: event.pointerId,
        startX: point.x,
        startY: point.y,
        initialSelectedIds: event.shiftKey || event.metaKey ? selectedIds : [],
      };

      if (!event.shiftKey && !event.metaKey) setSelectedIds([]);
      setEditingId(null);
      setSelectionBox({ ...normalizeSelectionBox(point.x, point.y, point.x, point.y) });
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragState.current;
      if (!drag || drag.pointerId !== event.pointerId) return;

      if (drag.mode === 'marquee') {
        const point = getCanvasPoint(event);
        const box = normalizeSelectionBox(drag.startX, drag.startY, point.x, point.y);
        setSelectionBox(box);
        const matches = elementsRef.current.filter((element) => intersects(box, element)).map((element) => element.id);
        setSelectedIds(unique([...drag.initialSelectedIds, ...matches]));
        return;
      }

      const currentElements = elementsRef.current;
      const rawX = drag.groupBounds.x + event.clientX - drag.startX;
      const rawY = drag.groupBounds.y + event.clientY - drag.startY;
      const virtualElement: CanvasElement = {
        id: '__selection__',
        type: 'text',
        x: drag.groupBounds.x,
        y: drag.groupBounds.y,
        width: drag.groupBounds.width,
        height: drag.groupBounds.height,
      };
      const nextHeight = Math.max(getResumeCanvasHeight(currentElements), rawY + drag.groupBounds.height + 72);
      const snapped = snapElementPosition(virtualElement, rawX, rawY, currentElements, nextHeight, drag.ids);
      const moveX = snapped.x - drag.groupBounds.x;
      const moveY = snapped.y - drag.groupBounds.y;

      setGuides(snapped.guides);
      applyLiveElements(
        currentElements.map((item) => {
          const origin = drag.originPositions.get(item.id);
          return origin ? { ...item, x: origin.x + moveX, y: origin.y + moveY } : item;
        })
      );
    };

    const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragState.current;
      if (!drag || drag.pointerId !== event.pointerId) return;

      if (drag.mode === 'move' && !areElementListsEqual(drag.beforeElements, elementsRef.current)) {
        onRecordElementsChange(
          drag.ids.length > 1 ? '移动多个元素' : '移动元素',
          drag.beforeElements,
          elementsRef.current,
          `drag:${drag.ids.join(',')}`
        );
      }

      if (drag.mode === 'marquee' && selectionBox && selectionBox.width < 3 && selectionBox.height < 3) {
        setSelectedIds(drag.initialSelectedIds);
      }

      dragState.current = null;
      setGuides([]);
      setSelectionBox(null);
    };

    const renderElementContent = (element: CanvasElement) => {
      if (element.type === 'text') {
        if (editingId === element.id) {
          const textValue = element.text ?? '';

          return (
            <textarea
              ref={(node) => {
                editingTextareaRef.current = node;
              }}
              autoFocus
              value={textValue}
              onChange={(event) => {
                updateElementText(
                  element.id,
                  event.target.value,
                  measureTextareaContentHeight(event.currentTarget)
                );
              }}
              onBlur={(event) => {
                updateElementText(
                  element.id,
                  event.currentTarget.value,
                  measureTextareaContentHeight(event.currentTarget)
                );
                finishEditing();
              }}
              onKeyDown={(event) => {
                event.stopPropagation();
              }}
              onPointerDown={(event) => event.stopPropagation()}
              className="resume-text-editor"
              style={textStyle(element)}
            />
          );
        }

        if (element.href) {
          return (
            <a
              ref={(node) => setTextMeasureNode(element.id, node)}
              className="resume-text resume-link"
              style={textStyle(element)}
              href={element.href}
              target="_blank"
              rel="noopener noreferrer"
              title={element.href}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onDoubleClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (!readOnly) startEditing(element);
              }}
            >
              {element.text}
            </a>
          );
        }

        return (
          <div ref={(node) => setTextMeasureNode(element.id, node)} className="resume-text" style={textStyle(element)}>
            {element.text}
          </div>
        );
      }

      if (element.type === 'line') {
        return <div className="resume-rule" style={{ backgroundColor: element.color }} />;
      }

      if (element.type === 'photo') {
        return element.src ? (
          <img src={element.src} alt="头像" className="resume-photo-img" referrerPolicy="no-referrer" />
        ) : (
          <div className="resume-photo-placeholder">
            <div />
            <span>1寸照片</span>
          </div>
        );
      }

      if (element.type === 'bullet') {
        return <span className="resume-bullet" style={{ backgroundColor: element.color }} />;
      }

      if (element.type === 'quote-bar') {
        return <span className="resume-quote-bar" style={{ backgroundColor: element.color }} />;
      }

      if (element.type === 'portfolio-image') {
        return element.src ? (
          <img src={element.src} alt="作品" className="resume-portfolio-img" referrerPolicy="no-referrer" />
        ) : (
          <div className="resume-portfolio-placeholder">
            <span>作品图片</span>
          </div>
        );
      }

      return <Sparkles className="resume-sparkle" style={{ color: element.color }} />;
    };

    return (
      <div className="resume-canvas-shell" onKeyDown={handleKeyDown}>
        <div
          ref={setSheetNode}
          id="resume-content"
          className={`resume-sheet ${readOnly ? 'is-read-only' : ''}`}
          tabIndex={0}
          style={{ width: A4_WIDTH, minHeight: A4_HEIGHT, height: canvasHeight }}
          onPointerDown={startMarquee}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {Array.from({ length: pageCount - 1 }, (_, index) => (
            <div
              key={`page-break-${index}`}
              className="canvas-chrome resume-page-break"
              style={{ top: (index + 1) * A4_HEIGHT }}
            />
          ))}

          {guides.map((guide, index) => (
            <div
              key={`${guide.orientation}-${guide.position}-${index}`}
              className={`canvas-chrome resume-guide resume-guide-${guide.orientation}`}
              style={
                guide.orientation === 'vertical'
                  ? { left: guide.position, height: canvasHeight }
                  : { top: guide.position, width: A4_WIDTH }
              }
            />
          ))}

          {historyPositionOverlays.map((overlay) => (
            <React.Fragment key={overlay.id}>
              <div className="canvas-chrome resume-history-move-line" style={getConnectorStyle(overlay)} />
              <div
                className="canvas-chrome resume-history-position-ghost"
                style={{
                  left: overlay.before.x,
                  top: overlay.before.y,
                  width: overlay.before.width,
                  height: overlay.before.height,
                }}
              >
                <span>变更前</span>
              </div>
              <div
                className="canvas-chrome resume-history-position-current"
                style={{
                  left: overlay.after.x,
                  top: overlay.after.y,
                  width: overlay.after.width,
                  height: overlay.after.height,
                }}
              >
                <span>{overlay.label}</span>
              </div>
            </React.Fragment>
          ))}

          {elements.map((element) => {
            const selected = selectedSet.has(element.id);
            const historyHighlighted = historyHighlightSet.has(element.id);
            const historyLabel = historyHighlightLabels[element.id];
            const isLine = element.type === 'line';
            const elementStyle: React.CSSProperties = {
              left: element.x,
              top: isLine ? element.y - 5 : element.y,
              width: element.width,
              height: isLine ? 12 : element.height,
              zIndex: element.zIndex ?? 1,
            };

            return (
              <div
                key={element.id}
                className={`resume-element resume-element-${element.type} ${selected ? 'is-selected' : ''} ${
                  editingId === element.id ? 'is-editing' : ''
                } ${isSectionTitle(element.id) ? 'is-section-title' : ''} ${
                  historyHighlighted ? 'is-history-highlight' : ''
                }`}
                data-element-id={element.id}
                data-element-type={element.type}
                style={elementStyle}
                onPointerDown={(event) => startMove(event, element)}
                onDoubleClick={(event) => {
                  if (readOnly) return;
                  event.preventDefault();
                  event.stopPropagation();
                  startEditing(element);
                }}
              >
                {renderElementContent(element)}
                {historyLabel && (
                  <div className="canvas-chrome resume-history-badge">
                    {historyLabel}
                  </div>
                )}
              </div>
            );
          })}

          {selectedBounds && selectedIds.length > 1 && (
            <div
              className="canvas-chrome resume-group-outline"
              style={{
                left: selectedBounds.x,
                top: selectedBounds.y,
                width: selectedBounds.width,
                height: selectedBounds.height,
              }}
            />
          )}

          {!readOnly && selectedBounds && selectedIds.length > 0 && (
            <div
              className="canvas-chrome resume-element-actions resume-selection-actions"
              style={{
                left: Math.max(4, Math.min(A4_WIDTH - 68, selectedBounds.x + selectedBounds.width - 58)),
                top: Math.max(4, selectedBounds.y - 40),
              }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <button type="button" title="复制" aria-label="复制元素" data-action="duplicate" onClick={duplicateSelected}>
                <Copy size={13} />
              </button>
              <button type="button" title="删除" aria-label="删除元素" data-action="delete" onClick={deleteSelected}>
                <Trash2 size={13} />
              </button>
            </div>
          )}

          {selectionBox && (
            <div
              className="canvas-chrome resume-selection-box"
              style={{
                left: selectionBox.x,
                top: selectionBox.y,
                width: selectionBox.width,
                height: selectionBox.height,
              }}
            />
          )}
        </div>
      </div>
    );
  }
);

ResumeCanvas.displayName = 'ResumeCanvas';

export default ResumeCanvas;

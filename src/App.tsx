import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Loader2, RotateCcw, Undo2, Redo2, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import ResumeCanvas, { HistoryPositionOverlay } from './components/ResumeCanvas';
import ResumeEditor from './components/ResumeEditor';
import HistoryPanel from './components/HistoryPanel';
import { INITIAL_DATA } from './constants';
import { CanvasElement, ResumeData } from './types';
import { parseResumeWithAI } from './services/geminiService';
import {
  createResumeCanvasElements,
  getSideProjectText,
  getWorkCompanyName,
  isSideProject,
  resetElementsToTemplate
} from './lib/resumeCanvas';
import { saveResumeAsImage, saveResumeAsPDF } from './lib/exportResume';
import { areElementListsEqual, CanvasElementsCommand, CommandContext, CommandHistory } from './lib/commandHistory';
import {
  saveCurrentData,
  getCurrentData,
  saveHistoryRecord,
  detectChanges,
  generateChangeDescription,
  HistoryChange,
  HistoryRecord
} from './lib/storage';

const RESUME_LAYOUT_VERSION = 6;

const sectionElementIds: Record<string, string[]> = {
  '基本信息': ['name', 'title'],
  '联系方式': ['contact-tel-label', 'contact-tel', 'contact-email-label', 'contact-email', 'contact-blog-label', 'contact-blog'],
  '教育背景': ['education-title', 'education-line'],
  '专业技能': ['skills-title', 'skills-line'],
  '工作经历': ['work-0-section-title', 'work-0-section-line'],
  '社会项目': ['social-title', 'social-line'],
  'Side Project': ['social-title', 'social-line'],
  '自我评价': ['evaluation-title', 'evaluation-line'],
  '项目作品': ['portfolio-title', 'portfolio-line'],
  '头像': ['photo'],
  '模块标题': [],
  '画布布局': [],
};

const getElementIdsForChange = (change: HistoryChange) => {
  const path = change.path ?? '';
  const ids: string[] = [];

  if (path === 'name') ids.push('name');
  if (path === 'title') ids.push('title');
  if (path.startsWith('contact.')) {
    const key = path.split('.')[1];
    ids.push(`contact-${key}-label`, `contact-${key}`);
  }
  if (path === 'avatar') ids.push('photo');
  if (path === 'portfolio') ids.push('portfolio-title', 'portfolio-line');

  const canvasElementMatch = path.match(/^canvasElements\.([^.]*)/);
  if (canvasElementMatch) ids.push(canvasElementMatch[1]);

  const sectionTitleMatch = path.match(/^sectionTitles\.(\w+)$/);
  if (sectionTitleMatch) {
    const sectionId = sectionTitleMatch[1] === 'work' ? 'work-0-section' : sectionTitleMatch[1];
    ids.push(`${sectionId}-title`, `${sectionId}-line`);
  }

  const educationMatch = path.match(/^education\.(\d+)(?:\.(\w+))?$/);
  if (educationMatch) {
    const index = educationMatch[1];
    const field = educationMatch[2];
    if (field) ids.push(`education-${index}-${field}`);
    ids.push(`education-${index}-duration`, `education-${index}-school`, `education-${index}-college`, `education-${index}-major`, `education-${index}-degree`);
  }

  const skillMatch = path.match(/^skills\.(\d+)$/);
  if (skillMatch) ids.push(`skills-${skillMatch[1]}-text`, `skills-${skillMatch[1]}-icon`);

  const socialMatch = path.match(/^socialProjects\.(\d+)$/);
  if (socialMatch) ids.push(`social-${socialMatch[1]}-text`, `social-${socialMatch[1]}-bullet`);

  const evaluationMatch = path.match(/^selfEvaluation\.(\d+)$/);
  if (evaluationMatch) ids.push(`evaluation-${evaluationMatch[1]}-text`, `evaluation-${evaluationMatch[1]}-icon`);

  const workMatch = path.match(/^workExperience\.(\d+)(?:\.(.*))?$/);
  if (workMatch) {
    const workIndex = workMatch[1];
    const rest = workMatch[2] ?? '';
    if (rest === 'duration') ids.push(`work-${workIndex}-duration`);
    if (rest === 'title' || rest === '') ids.push(`work-${workIndex}-section-title`, `work-${workIndex}-section-line`);

    const summaryMatch = rest.match(/^summary\.(\d+)$/);
    if (summaryMatch) {
      ids.push(
        `work-${workIndex}-summary-${summaryMatch[1]}-text`,
        `work-${workIndex}-summary-${summaryMatch[1]}-bullet`
      );
    }

    const projectMatch = rest.match(/^projects\.(\d+)(?:\.(.*))?$/);
    if (projectMatch) {
      const projectIndex = projectMatch[1];
      const projectRest = projectMatch[2] ?? '';
      if (projectRest === 'name') ids.push(`work-${workIndex}-project-${projectIndex}-name`);
      if (projectRest === 'role') ids.push(`work-${workIndex}-project-${projectIndex}-role`);
      if (projectRest === 'description') ids.push(
        `work-${workIndex}-project-${projectIndex}-description`,
        `work-${workIndex}-project-${projectIndex}-description-bar`
      );
      if (projectRest === '') {
        ids.push(
          `work-${workIndex}-project-${projectIndex}-name`,
          `work-${workIndex}-project-${projectIndex}-role`,
          `work-${workIndex}-project-${projectIndex}-description`,
          `work-${workIndex}-project-${projectIndex}-description-bar`
        );
      }

      const pointMatch = projectRest.match(/^points\.(\d+)$/);
      if (pointMatch) {
        ids.push(
          `work-${workIndex}-project-${projectIndex}-point-${pointMatch[1]}-text`,
          `work-${workIndex}-project-${projectIndex}-point-${pointMatch[1]}-bullet`
        );
      }
    }
  }

  return ids.length ? ids : (sectionElementIds[change.category ?? ''] ?? []);
};

const stripTitlePrefix = (value: string) => value.replace(/^求职意向[：:]\s*/, '');

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const stripWorkDurationCompany = (workTitle: string, value: string) => {
  const company = getWorkCompanyName(workTitle);
  if (!company) return value;
  return value.replace(new RegExp(`^${escapeRegExp(company)}\\s*[·|｜-]?\\s*`), '').trim();
};

const updateResumeDataFromCanvasText = (data: ResumeData, id: string, value: string) => {
  let next = data;
  const setNext = (updater: (current: ResumeData) => ResumeData) => {
    next = updater(next);
  };

  if (id === 'name') {
    if (data.name !== value) setNext((current) => ({ ...current, name: value }));
    return next;
  }

  if (id === 'title') {
    const title = stripTitlePrefix(value);
    if (data.title !== title) setNext((current) => ({ ...current, title }));
    return next;
  }

  const sectionTitleMap: Record<string, keyof NonNullable<ResumeData['sectionTitles']>> = {
    'education-title': 'education',
    'skills-title': 'skills',
    'work-0-section-title': 'work',
    'social-title': 'social',
    'evaluation-title': 'evaluation',
    'portfolio-title': 'portfolio',
  };
  const sectionTitleKey = sectionTitleMap[id];
  if (sectionTitleKey) {
    if (data.sectionTitles?.[sectionTitleKey] !== value) {
      setNext((current) => ({
        ...current,
        sectionTitles: {
          ...current.sectionTitles,
          [sectionTitleKey]: value,
        },
      }));
    }
    return next;
  }

  const contactMatch = id.match(/^contact-(tel|email|blog|github)$/);
  if (contactMatch) {
    const key = contactMatch[1] as keyof ResumeData['contact'];
    if (data.contact[key] !== value) {
      setNext((current) => ({ ...current, contact: { ...current.contact, [key]: value } }));
    }
    return next;
  }

  const educationMatch = id.match(/^education-(\d+)-(duration|school|college|major|degree)$/);
  if (educationMatch) {
    const index = Number(educationMatch[1]);
    const field = educationMatch[2] as keyof ResumeData['education'][number];
    if (data.education[index] && data.education[index][field] !== value) {
      setNext((current) => ({
        ...current,
        education: current.education.map((item, itemIndex) =>
          itemIndex === index ? { ...item, [field]: value } : item
        ),
      }));
    }
    return next;
  }

  const skillMatch = id.match(/^skills-(\d+)-text$/);
  if (skillMatch) {
    const index = Number(skillMatch[1]);
    if (data.skills[index] !== undefined && data.skills[index] !== value) {
      setNext((current) => ({
        ...current,
        skills: current.skills.map((item, itemIndex) => (itemIndex === index ? value : item)),
      }));
    }
    return next;
  }

  const socialMatch = id.match(/^social-(\d+)-text$/);
  if (socialMatch) {
    const index = Number(socialMatch[1]);
    const currentItem = data.socialProjects[index];
    const currentText = currentItem === undefined ? undefined : getSideProjectText(currentItem);
    if (currentItem !== undefined && currentText !== value) {
      setNext((current) => ({
        ...current,
        socialProjects: current.socialProjects.map((item, itemIndex) => {
          if (itemIndex !== index) return item;
          if (!isSideProject(item)) return value;

          const [name, ...descriptionParts] = value.split(/[:：]/);
          return {
            ...item,
            name: name.trim() || item.name,
            description: descriptionParts.join('：').trim() || item.description,
          };
        }),
      }));
    }
    return next;
  }

  const evaluationMatch = id.match(/^evaluation-(\d+)-text$/);
  if (evaluationMatch) {
    const index = Number(evaluationMatch[1]);
    if (data.selfEvaluation[index] !== undefined && data.selfEvaluation[index] !== value) {
      setNext((current) => ({
        ...current,
        selfEvaluation: current.selfEvaluation.map((item, itemIndex) => (itemIndex === index ? value : item)),
      }));
    }
    return next;
  }

  const workDurationMatch = id.match(/^work-(\d+)-duration$/);
  if (workDurationMatch) {
    const workIndex = Number(workDurationMatch[1]);
    const work = data.workExperience[workIndex];
    const duration = work ? stripWorkDurationCompany(work.title, value) : value;
    if (work && work.duration !== duration) {
      setNext((current) => ({
        ...current,
        workExperience: current.workExperience.map((work, index) =>
          index === workIndex ? { ...work, duration } : work
        ),
      }));
    }
    return next;
  }

  const workSummaryMatch = id.match(/^work-(\d+)-summary-(\d+)-text$/);
  if (workSummaryMatch) {
    const workIndex = Number(workSummaryMatch[1]);
    const summaryIndex = Number(workSummaryMatch[2]);
    const summaryItem = data.workExperience[workIndex]?.summary?.[summaryIndex];
    if (summaryItem !== undefined && summaryItem !== value) {
      setNext((current) => ({
        ...current,
        workExperience: current.workExperience.map((work, index) =>
          index === workIndex
            ? {
                ...work,
                summary: (work.summary ?? []).map((item, currentSummaryIndex) =>
                  currentSummaryIndex === summaryIndex ? value : item
                ),
              }
            : work
        ),
      }));
    }
    return next;
  }

  const projectMatch = id.match(/^work-(\d+)-project-(\d+)-(name|role|description)$/);
  if (projectMatch) {
    const workIndex = Number(projectMatch[1]);
    const projectIndex = Number(projectMatch[2]);
    const field = projectMatch[3] as 'name' | 'role' | 'description';
    const project = data.workExperience[workIndex]?.projects[projectIndex];
    if (project && (project[field] ?? '') !== value) {
      setNext((current) => ({
        ...current,
        workExperience: current.workExperience.map((work, currentWorkIndex) =>
          currentWorkIndex === workIndex
            ? {
                ...work,
                projects: work.projects.map((item, currentProjectIndex) =>
                  currentProjectIndex === projectIndex ? { ...item, [field]: value } : item
                ),
              }
            : work
        ),
      }));
    }
    return next;
  }

  const pointMatch = id.match(/^work-(\d+)-project-(\d+)-point-(\d+)-text$/);
  if (pointMatch) {
    const workIndex = Number(pointMatch[1]);
    const projectIndex = Number(pointMatch[2]);
    const pointIndex = Number(pointMatch[3]);
    const point = data.workExperience[workIndex]?.projects[projectIndex]?.points[pointIndex];
    if (point !== undefined && point !== value) {
      setNext((current) => ({
        ...current,
        workExperience: current.workExperience.map((work, currentWorkIndex) =>
          currentWorkIndex === workIndex
            ? {
                ...work,
                projects: work.projects.map((project, currentProjectIndex) =>
                  currentProjectIndex === projectIndex
                    ? {
                        ...project,
                        points: project.points.map((item, currentPointIndex) =>
                          currentPointIndex === pointIndex ? value : item
                        ),
                      }
                    : project
                ),
              }
            : work
        ),
      }));
    }
  }

  return next;
};

const mergeTemplateWithCanvasState = (
  currentElements: CanvasElement[],
  templateElements: CanvasElement[],
  templateOwnedIds: Set<string>
) => {
  const currentById = new Map(currentElements.map((element) => [element.id, element]));

  return templateElements.map((element) => {
    const current = currentById.get(element.id);
    if (!current) return element;
    const useTemplateContent = templateOwnedIds.has(element.id);

    return {
      ...element,
      x: current.x,
      y: current.y,
      width: current.width,
      height: useTemplateContent ? element.height : current.height,
      zIndex: current.zIndex ?? element.zIndex,
      text: useTemplateContent ? element.text : (current.text ?? element.text),
      src: useTemplateContent ? element.src : (current.src ?? element.src),
      href: useTemplateContent ? element.href : (current.href ?? element.href),
    };
  });
};

const getCanvasElementsForData = (data: ResumeData) =>
  data.canvasElements?.length ? data.canvasElements : createResumeCanvasElements(data);

const withCanvasElements = (data: ResumeData, elements: CanvasElement[]): ResumeData => ({
  ...data,
  canvasElements: elements,
  layoutVersion: RESUME_LAYOUT_VERSION,
});

const migrateResumeData = (data: ResumeData): ResumeData => {
  const existingProjects = data.socialProjects ?? [];
  const missingProjects = INITIAL_DATA.socialProjects.filter((project) => {
    if (!isSideProject(project)) return false;
    return !existingProjects.some((item) => isSideProject(item) && item.url === project.url);
  });
  const alibabaWork = INITIAL_DATA.workExperience.find((work) => work.title.includes('阿里巴巴'));
  const workExperience = data.workExperience.map((work) =>
    alibabaWork && work.title.includes('阿里巴巴') ? alibabaWork : work
  );

  return {
    ...data,
    workExperience,
    socialProjects: [...existingProjects, ...missingProjects],
    sectionTitles: {
      ...data.sectionTitles,
      social: 'Side Project',
    },
  };
};

const parsePointValue = (value: any) => {
  if (value && typeof value === 'object' && Number.isFinite(value.x) && Number.isFinite(value.y)) {
    return { x: Number(value.x), y: Number(value.y) };
  }

  if (typeof value === 'string') {
    const match = value.match(/x:\s*(-?\d+(?:\.\d+)?).*?y:\s*(-?\d+(?:\.\d+)?)/);
    if (match) return { x: Number(match[1]), y: Number(match[2]) };
  }

  return null;
};

const getElementVisualBounds = (element: CanvasElement, point?: { x: number; y: number }) => ({
  x: point?.x ?? element.x,
  y: (point?.y ?? element.y) - (element.type === 'line' ? 5 : 0),
  width: element.width,
  height: element.type === 'line' ? 12 : element.height,
});

const cloneResumeData = (data: ResumeData): ResumeData => JSON.parse(JSON.stringify(data)) as ResumeData;

const toPathKey = (segment: string) => {
  const numeric = Number(segment);
  return Number.isInteger(numeric) && String(numeric) === segment ? numeric : segment;
};

const getValueAtPath = (data: any, path: string) => {
  return path.split('.').reduce((value, segment) => {
    if (value === undefined || value === null) return undefined;
    return value[toPathKey(segment)];
  }, data);
};

const applyValueAtPath = (
  draft: any,
  path: string,
  value: any,
  type: HistoryChange['type']
) => {
  const segments = path.split('.');
  let target = draft;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const key = toPathKey(segments[index]);
    const nextKey = toPathKey(segments[index + 1]);
    if (target[key] === undefined || target[key] === null) {
      target[key] = typeof nextKey === 'number' ? [] : {};
    }
    target = target[key];
  }

  const lastKey = toPathKey(segments[segments.length - 1]);
  if (Array.isArray(target) && typeof lastKey === 'number' && type === 'removed' && value === undefined) {
    target.splice(lastKey, 1);
    return;
  }

  if (!Array.isArray(target) && type === 'removed' && value === undefined) {
    delete target[lastKey];
    return;
  }

  target[lastKey] = value;
};

const applyResumeDataChanges = (
  currentData: ResumeData,
  sourceData: ResumeData,
  changes: HistoryChange[]
) => {
  if (changes.length === 0) return currentData;

  const draft = cloneResumeData(currentData);
  changes.forEach((change) => {
    if (!change.path) return;
    applyValueAtPath(draft, change.path, getValueAtPath(sourceData, change.path), change.type);
  });
  return draft;
};

export default function App() {
  const [resumeData, setResumeData] = useState<ResumeData>(() => {
    const elements = createResumeCanvasElements(INITIAL_DATA);
    return withCanvasElements(INITIAL_DATA, elements);
  });
  const [canvasElements, setCanvasElements] = useState(() => getCanvasElementsForData(resumeData));
  const [isParsing, setIsParsing] = useState(false);
  const [parseStep, setParseStep] = useState<string>('');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
  const [historyPreviewRecord, setHistoryPreviewRecord] = useState<HistoryRecord | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const resumeRef = useRef<HTMLDivElement>(null);
  const resumeDataRef = useRef(resumeData);
  const canvasElementsRef = useRef(canvasElements);
  const historyRef = useRef(new CommandHistory<CommandContext>());
  const previousDataRef = useRef<ResumeData>(resumeData);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  const commitResumeData = useCallback((nextOrUpdater: ResumeData | ((current: ResumeData) => ResumeData)) => {
    const nextData = typeof nextOrUpdater === 'function' ? nextOrUpdater(resumeDataRef.current) : nextOrUpdater;
    resumeDataRef.current = nextData;
    setResumeData(nextData);
    return nextData;
  }, []);

  // 加载本地数据
  useEffect(() => {
    const loadData = async () => {
      const savedData = await getCurrentData();
      if (savedData) {
        const migratedData = migrateResumeData(savedData);
        const savedElements = savedData.canvasElements?.length && savedData.layoutVersion === RESUME_LAYOUT_VERSION
          ? mergeTemplateWithCanvasState(
              savedData.canvasElements,
              createResumeCanvasElements(migratedData),
              new Set(['social-title', 'social-line', ...migratedData.socialProjects.flatMap((_, index) => [
                `social-${index}-text`,
                `social-${index}-bullet`,
              ]), ...migratedData.workExperience.flatMap((work, workIndex) => [
                `work-${workIndex}-section-title`,
                `work-${workIndex}-section-line`,
                `work-${workIndex}-duration`,
                ...(work.summary ?? []).flatMap((_, summaryIndex) => [
                  `work-${workIndex}-summary-${summaryIndex}-text`,
                  `work-${workIndex}-summary-${summaryIndex}-bullet`,
                ]),
                ...work.projects.flatMap((project, projectIndex) => [
                  `work-${workIndex}-project-${projectIndex}-name`,
                  `work-${workIndex}-project-${projectIndex}-role`,
                  `work-${workIndex}-project-${projectIndex}-description`,
                  `work-${workIndex}-project-${projectIndex}-description-bar`,
                  ...project.points.flatMap((_, pointIndex) => [
                    `work-${workIndex}-project-${projectIndex}-point-${pointIndex}-text`,
                    `work-${workIndex}-project-${projectIndex}-point-${pointIndex}-bullet`,
                  ]),
                ]),
              ])])
            )
          : createResumeCanvasElements(migratedData);
        const savedState = withCanvasElements(migratedData, savedElements);
        commitResumeData(savedState);
        canvasElementsRef.current = savedElements;
        setCanvasElements(savedElements);
        previousDataRef.current = savedState;
      }
      setIsDataLoaded(true);
    };
    loadData();
  }, [commitResumeData]);

  // 自动保存数据和历史记录
  useEffect(() => {
    if (!isDataLoaded) return;

    // 清除之前的定时器
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // 延迟保存，避免频繁写入
    saveTimeoutRef.current = setTimeout(async () => {
      await saveCurrentData(resumeData);

      // 检测变化并保存历史记录
      const changes = detectChanges(previousDataRef.current, resumeData);
      if (changes.length > 0) {
        const record: HistoryRecord = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
          description: generateChangeDescription(changes),
          data: resumeData,
          changes
        };
        await saveHistoryRecord(record);
        previousDataRef.current = resumeData;
        setHistoryVersion((version) => version + 1);
      }
    }, 1000); // 1秒后保存

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [resumeData, isDataLoaded]);

  useEffect(() => {
    resumeDataRef.current = resumeData;
    canvasElementsRef.current = canvasElements;
  }, [canvasElements, resumeData]);

  const handleCanvasElementsLiveChange = useCallback((
    nextOrUpdater: CanvasElement[] | ((current: CanvasElement[]) => CanvasElement[])
  ) => {
    const nextElements = typeof nextOrUpdater === 'function'
      ? nextOrUpdater(canvasElementsRef.current)
      : nextOrUpdater;
    canvasElementsRef.current = nextElements;
    setCanvasElements(nextElements);
  }, []);

  const setElementsFromCommand = useCallback((elements: CanvasElement[]) => {
    canvasElementsRef.current = elements;
    setCanvasElements(elements);
    commitResumeData((current) => withCanvasElements(current, elements));
  }, [commitResumeData]);

  const commandContext = useMemo<CommandContext>(
    () => ({
      getElements: () => canvasElementsRef.current,
      setElements: setElementsFromCommand,
    }),
    [setElementsFromCommand]
  );

  const refreshHistoryState = useCallback(() => {
    setHistoryVersion((version) => version + 1);
  }, []);

  const clearHistory = useCallback(() => {
    historyRef.current.clear();
    refreshHistoryState();
  }, [refreshHistoryState]);

  const handleResumeDataChange = useCallback((newData: ResumeData) => {
    const formChanges = detectChanges(resumeData, newData, { includeCanvas: false });
    const nextData = applyResumeDataChanges(resumeDataRef.current, newData, formChanges);
    const changedElementIds = new Set(formChanges.flatMap((change) => getElementIdsForChange(change)));
    const nextElements = mergeTemplateWithCanvasState(
      canvasElementsRef.current,
      createResumeCanvasElements(nextData),
      changedElementIds
    );
    canvasElementsRef.current = nextElements;
    setCanvasElements(nextElements);
    commitResumeData(withCanvasElements(nextData, nextElements));
    historyRef.current.clear();
    setHistoryPreviewRecord(null);
    refreshHistoryState();
  }, [commitResumeData, refreshHistoryState, resumeData]);

  const handleCanvasTextCommit = useCallback((id: string, value: string) => {
    commitResumeData((current) => updateResumeDataFromCanvasText(current, id, value));
  }, [commitResumeData]);

  const executeElementsChange = useCallback(
    (description: string, before: CanvasElement[], after: CanvasElement[], mergeKey?: string) => {
      if (areElementListsEqual(before, after)) return;
      const command = new CanvasElementsCommand(description, before, after, mergeKey);
      historyRef.current.execute(command, commandContext);
      refreshHistoryState();
    },
    [commandContext, refreshHistoryState]
  );

  const recordElementsChange = useCallback(
    (description: string, before: CanvasElement[], after: CanvasElement[], mergeKey?: string) => {
      if (areElementListsEqual(before, after)) return;
      const command = new CanvasElementsCommand(description, before, after, mergeKey);
      historyRef.current.record(command);
      setElementsFromCommand(after);
      refreshHistoryState();
    },
    [refreshHistoryState, setElementsFromCommand]
  );

  const undoCanvas = useCallback(() => {
    historyRef.current.undo(commandContext);
    refreshHistoryState();
  }, [commandContext, refreshHistoryState]);

  const redoCanvas = useCallback(() => {
    historyRef.current.redo(commandContext);
    refreshHistoryState();
  }, [commandContext, refreshHistoryState]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return;
      if (!event.metaKey && !event.ctrlKey) return;

      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undoCanvas();
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault();
        redoCanvas();
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [redoCanvas, undoCanvas]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsParsing(true);
    setParseStep('读取文件内容...');

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      const mimeType = file.type;

      try {
        setParseStep('AI 正在解析简历结构...');
        const parsedData = await parseResumeWithAI(base64, mimeType);

        // Merge with existing data to ensure structure
        const nextData = {
          ...resumeData,
          ...parsedData,
          contact: { ...resumeData.contact, ...parsedData.contact },
          education: parsedData.education || resumeData.education,
          skills: parsedData.skills || resumeData.skills,
          workExperience: parsedData.workExperience || resumeData.workExperience,
          socialProjects: parsedData.socialProjects || resumeData.socialProjects,
          selfEvaluation: parsedData.selfEvaluation || resumeData.selfEvaluation,
        };
        const nextElements = createResumeCanvasElements(nextData);

        commitResumeData(withCanvasElements(nextData, nextElements));
        setElementsFromCommand(nextElements);
        clearHistory();

        setParseStep('解析成功！');
        setTimeout(() => {
          setIsParsing(false);
          setParseStep('');
        }, 1500);
      } catch (error) {
        console.error("Parsing failed", error);
        setParseStep('解析失败，请重试');
        setTimeout(() => setIsParsing(false), 2000);
      }
    };
    reader.readAsDataURL(file);
  }, [clearHistory, commitResumeData, resumeData, setElementsFromCommand]);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png'],
      'application/pdf': ['.pdf']
    },
    multiple: false
  } as any);

  const getResumeFileName = () => {
    const canvasName = canvasElements.find((element) => element.id === 'name')?.text;
    return (canvasName || resumeData.name || 'resume').trim().replace(/[\\/:*?"<>|]/g, '-');
  };

  const exportAsImage = async () => {
    if (!resumeRef.current) return;
    await saveResumeAsImage(resumeRef.current, `resume-${getResumeFileName()}.png`);
  };

  const exportAsPDF = async () => {
    if (!resumeRef.current || isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      await saveResumeAsPDF(resumeRef.current, `resume-${getResumeFileName()}.pdf`);
    } catch (error) {
      console.error("PDF Export failed:", error);
      window.print();
    } finally {
      setIsExportingPdf(false);
    }
  };

  const resetCanvas = () => {
    const before = canvasElementsRef.current;
    const after = resetElementsToTemplate(before, createResumeCanvasElements(resumeData));
    executeElementsChange('重置布局', before, after);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleRestoreHistory = (data: ResumeData) => {
    const restoredElements = getCanvasElementsForData(data);
    const restoredState = withCanvasElements(data, restoredElements);
    commitResumeData(restoredState);
    setElementsFromCommand(restoredElements);
    historyRef.current.clear();
    refreshHistoryState();
    previousDataRef.current = restoredState;
    setHistoryPreviewRecord(null);
    setIsHistoryPanelOpen(false);
  };

  const handleRestoreHistoryRecord = (record: HistoryRecord) => {
    handleRestoreHistory(record.data);
  };

  const closeHistoryPanel = () => {
    setHistoryPreviewRecord(null);
    setIsHistoryPanelOpen(false);
  };

  const canUndo = historyRef.current.canUndo;
  const canRedo = historyRef.current.canRedo;
  const historyPreviewData = useMemo(
    () => {
      if (!historyPreviewRecord) return null;
      const elements = getCanvasElementsForData(historyPreviewRecord.data);
      return withCanvasElements(historyPreviewRecord.data, elements);
    },
    [historyPreviewRecord]
  );
  const historyPreviewElements = useMemo(
    () => (historyPreviewData ? historyPreviewData.canvasElements ?? [] : canvasElements),
    [canvasElements, historyPreviewData]
  );
  const historyPreviewChanges = useMemo(
    () => {
      if (!historyPreviewRecord || !historyPreviewData) return [];
      return historyPreviewRecord.changes?.length
        ? historyPreviewRecord.changes
        : detectChanges(resumeData, historyPreviewData);
    },
    [historyPreviewData, historyPreviewRecord, resumeData]
  );
  const historyPositionOverlays = useMemo<HistoryPositionOverlay[]>(() => {
    if (!historyPreviewRecord || !historyPreviewData?.canvasElements?.length) return [];

    const elementsById = new Map<string, CanvasElement>(
      historyPreviewData.canvasElements.map((element): [string, CanvasElement] => [element.id, element])
    );
    return (historyPreviewRecord.changes ?? []).flatMap((change) => {
      const match = change.path?.match(/^canvasElements\.([^.]*)\.position$/);
      if (!match) return [];

      const element = elementsById.get(match[1]);
      const beforePoint = parsePointValue(change.oldValue);
      const afterPoint = parsePointValue(change.newValue);
      if (!element || !beforePoint) return [];

      return [{
        id: `${historyPreviewRecord.id}-${match[1]}`,
        label: change.field || '变更后',
        before: getElementVisualBounds(element, beforePoint),
        after: getElementVisualBounds(element, afterPoint ?? { x: element.x, y: element.y }),
      }];
    });
  }, [historyPreviewData, historyPreviewRecord]);
  const historyHighlightState = useMemo(() => {
    if (!historyPreviewRecord) return { ids: [] as string[], labels: {} as Record<string, string> };

    const existingIds = new Set(historyPreviewElements.map((element) => element.id));
    const ids = new Set<string>();
    const labels: Record<string, string> = {};

    historyPreviewChanges.forEach((change) => {
      const mappedIds = getElementIdsForChange(change).filter((id) => existingIds.has(id));
      const fallbackIds = sectionElementIds[change.category ?? '']?.filter((id) => existingIds.has(id)) ?? [];
      const targetIds = mappedIds.length ? mappedIds : fallbackIds;

      targetIds.forEach((id) => ids.add(id));
      if (targetIds[0] && !labels[targetIds[0]]) {
        labels[targetIds[0]] = change.field;
      }
    });

    return { ids: [...ids], labels };
  }, [historyPreviewChanges, historyPreviewElements, historyPreviewRecord]);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-800">
      {/* Top Navigation Bar */}
      <nav className="absolute top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-resume-blue rounded flex items-center justify-center text-white font-bold text-xl">R</div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">简历规划师 Pro</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-1">
            <button
              onClick={undoCanvas}
              disabled={!canUndo}
              className={`flex items-center justify-center w-10 h-10 border border-slate-200 rounded-full text-sm font-medium transition-colors ${
                canUndo ? 'hover:bg-slate-50 text-slate-700' : 'opacity-40 cursor-not-allowed text-slate-400'
              }`}
              title="撤销 (Ctrl/Cmd+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={redoCanvas}
              disabled={!canRedo}
              className={`flex items-center justify-center w-10 h-10 border border-slate-200 rounded-full text-sm font-medium transition-colors ${
                canRedo ? 'hover:bg-slate-50 text-slate-700' : 'opacity-40 cursor-not-allowed text-slate-400'
              }`}
              title="重做 (Ctrl/Cmd+Shift+Z / Ctrl/Cmd+Y)"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => setIsHistoryPanelOpen(true)}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-full text-sm font-medium hover:bg-slate-50 transition-colors"
            title="查看编辑历史"
          >
            <Clock className="w-4 h-4 text-slate-500" />
            历史记录
          </button>
          <button
            onClick={resetCanvas}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-full text-sm font-medium hover:bg-slate-50 transition-colors"
            title="重置布局"
          >
            <RotateCcw className="w-4 h-4 text-slate-500" />
            重置
          </button>
          <div {...getRootProps()} className="cursor-pointer">
            <input {...getInputProps()} />
            <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-full text-sm font-medium hover:bg-slate-50 transition-colors">
              {isParsing ? <Loader2 className="w-4 h-4 animate-spin text-resume-blue" /> : <Upload className="w-4 h-4 text-slate-500" />}
              <span className={isParsing ? "text-resume-blue" : ""}>
                {isParsing ? parseStep : '导入简历 (AI 解析)'}
              </span>
            </button>
          </div>
          <div className="h-6 w-px bg-slate-200"></div>
          <div className="flex gap-2">
            <button
              onClick={exportAsImage}
              className="px-4 py-2 border border-slate-200 rounded-full text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              导出图片
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 border border-slate-200 rounded-full text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              打印 PDF
            </button>
            <button
              onClick={exportAsPDF}
              disabled={isExportingPdf}
              aria-busy={isExportingPdf}
              className={`inline-flex w-[136px] items-center justify-center gap-2 px-4 py-2 bg-resume-blue text-white rounded-full text-sm font-medium shadow-sm transition-all ${
                isExportingPdf ? 'opacity-75 cursor-wait' : 'hover:opacity-90'
              }`}
            >
              {isExportingPdf && <Loader2 className="w-4 h-4 animate-spin" />}
              {isExportingPdf ? '生成中...' : '直接下载 PDF'}
            </button>
          </div>
        </div>
      </nav>

      {/* Main Workspace (Offset by Nav) */}
      <div className="flex flex-1 pt-16 overflow-hidden">
        {/* Sidebar Controls */}
        <aside className="w-[420px] bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-hidden">
          <ResumeEditor data={resumeData} onChange={handleResumeDataChange} />
        </aside>

        {/* Preview Area */}
        <main
          className={`relative flex-1 bg-slate-100 flex justify-center p-8 overflow-y-auto overflow-x-auto transition-[padding] duration-200 ${
            isHistoryPanelOpen ? 'pr-[412px]' : ''
          }`}
        >
          {historyPreviewRecord && (
            <div className="fixed top-20 left-[452px] right-[412px] z-30 flex justify-center pointer-events-none">
              <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-blue-200 bg-white px-4 py-2 shadow-xl">
                <div>
                  <div className="text-xs font-bold text-slate-900">正在预览历史版本</div>
                  <div className="text-[10px] text-slate-500">
                    已标注 {historyHighlightState.ids.length} 个相关元素，红色虚线为变更前
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm(`确定要恢复到「${historyPreviewRecord.description}」这个版本吗？`)) {
                      handleRestoreHistoryRecord(historyPreviewRecord);
                    }
                  }}
                  className="px-3 py-1.5 rounded-full bg-resume-blue text-white text-xs font-bold hover:opacity-90 transition-all"
                >
                  还原此版本
                </button>
                <button
                  onClick={() => setHistoryPreviewRecord(null)}
                  className="px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all"
                >
                  退出预览
                </button>
              </div>
            </div>
          )}
          <ResumeCanvas
            elements={historyPreviewElements}
            onElementsChange={historyPreviewRecord ? () => {} : handleCanvasElementsLiveChange}
            onExecuteElementsChange={executeElementsChange}
            onRecordElementsChange={recordElementsChange}
            onTextCommit={handleCanvasTextCommit}
            readOnly={Boolean(historyPreviewRecord)}
            historyHighlightIds={historyHighlightState.ids}
            historyHighlightLabels={historyHighlightState.labels}
            historyPositionOverlays={historyPositionOverlays}
            ref={resumeRef}
          />
        </main>
      </div>

      {/* Parsing Overlay */}
      <AnimatePresence>
        {isParsing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-white/60 backdrop-blur-sm flex items-center justify-center"
          >
            <div className="bg-white p-8 rounded-2xl shadow-2xl border border-natural-border flex flex-col items-center max-w-sm w-full mx-4">
              <Loader2 className="w-12 h-12 text-natural-primary animate-spin mb-4" />
              <h3 className="text-lg font-semibold text-natural-heading mb-2">Processing Resume</h3>
              <p className="text-sm text-center text-natural-text">{parseStep}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History Panel */}
      <HistoryPanel
        isOpen={isHistoryPanelOpen}
        refreshKey={historyVersion}
        selectedRecordId={historyPreviewRecord?.id ?? null}
        previewChanges={historyPreviewChanges}
        onClose={closeHistoryPanel}
        onPreview={setHistoryPreviewRecord}
        onRestore={handleRestoreHistoryRecord}
      />
    </div>
  );
}

import localforage from 'localforage';
import { CanvasElement, ResumeData } from '../types';

// 配置 localforage
localforage.config({
  name: 'smart-resume',
  storeName: 'resume_data',
  description: '智能简历编辑器数据存储'
});

export interface HistoryChange {
  field: string;
  category?: string;
  path?: string;
  oldValue?: any;
  newValue?: any;
  type?: 'added' | 'removed' | 'modified';
}

export interface HistoryRecord {
  id: string;
  timestamp: number;
  description: string;
  data: ResumeData;
  changes?: HistoryChange[];
}

const CURRENT_DATA_KEY = 'current_resume_data';
const HISTORY_KEY = 'resume_history';
const MAX_HISTORY_RECORDS = 50; // 最多保存50条历史记录

// 保存当前数据
export const saveCurrentData = async (data: ResumeData): Promise<void> => {
  try {
    await localforage.setItem(CURRENT_DATA_KEY, data);
  } catch (error) {
    console.error('保存数据失败:', error);
  }
};

// 获取当前数据
export const getCurrentData = async (): Promise<ResumeData | null> => {
  try {
    return await localforage.getItem<ResumeData>(CURRENT_DATA_KEY);
  } catch (error) {
    console.error('读取数据失败:', error);
    return null;
  }
};

// 保存历史记录
export const saveHistoryRecord = async (record: HistoryRecord): Promise<void> => {
  try {
    const history = await getHistory();
    history.unshift(record);

    // 限制历史记录数量
    if (history.length > MAX_HISTORY_RECORDS) {
      history.splice(MAX_HISTORY_RECORDS);
    }

    await localforage.setItem(HISTORY_KEY, history);
  } catch (error) {
    console.error('保存历史记录失败:', error);
  }
};

// 获取历史记录
export const getHistory = async (): Promise<HistoryRecord[]> => {
  try {
    const history = await localforage.getItem<HistoryRecord[]>(HISTORY_KEY);
    return history || [];
  } catch (error) {
    console.error('读取历史记录失败:', error);
    return [];
  }
};

// 清除所有数据
export const clearAllData = async (): Promise<void> => {
  try {
    await localforage.clear();
  } catch (error) {
    console.error('清除数据失败:', error);
  }
};

// 仅清除历史记录，保留当前简历
export const clearHistoryRecords = async (): Promise<void> => {
  try {
    await localforage.removeItem(HISTORY_KEY);
  } catch (error) {
    console.error('清除历史记录失败:', error);
  }
};

const isEqual = (oldValue: any, newValue: any) => JSON.stringify(oldValue) === JSON.stringify(newValue);

const getChangeType = (oldValue: any, newValue: any): HistoryChange['type'] => {
  if (oldValue === undefined || oldValue === null || oldValue === '') return 'added';
  if (newValue === undefined || newValue === null || newValue === '') return 'removed';
  return 'modified';
};

const pushChange = (
  changes: HistoryChange[],
  category: string,
  field: string,
  path: string,
  oldValue: any,
  newValue: any
) => {
  if (isEqual(oldValue, newValue)) return;
  changes.push({
    category,
    field,
    path,
    oldValue,
    newValue,
    type: getChangeType(oldValue, newValue),
  });
};

const compareValue = (
  changes: HistoryChange[],
  category: string,
  field: string,
  path: string,
  oldValue: any,
  newValue: any
) => pushChange(changes, category, field, path, oldValue, newValue);

const compareEducation = (changes: HistoryChange[], oldData: ResumeData, newData: ResumeData) => {
  const fields: Array<[keyof ResumeData['education'][number], string]> = [
    ['duration', '时间'],
    ['school', '学校'],
    ['college', '学院'],
    ['major', '专业'],
    ['degree', '学位'],
  ];
  const maxLength = Math.max(oldData.education.length, newData.education.length);

  for (let index = 0; index < maxLength; index += 1) {
    const oldItem = oldData.education[index];
    const newItem = newData.education[index];
    const prefix = `教育背景 第${index + 1}项`;

    if (!oldItem || !newItem) {
      pushChange(changes, '教育背景', prefix, `education.${index}`, oldItem, newItem);
      continue;
    }

    fields.forEach(([key, label]) => {
      compareValue(changes, '教育背景', `${prefix} ${label}`, `education.${index}.${key}`, oldItem[key], newItem[key]);
    });
  }
};

const compareStringList = (
  changes: HistoryChange[],
  category: string,
  label: string,
  path: 'skills' | 'socialProjects' | 'selfEvaluation',
  oldItems: Array<string | object>,
  newItems: Array<string | object>
) => {
  const maxLength = Math.max(oldItems.length, newItems.length);
  for (let index = 0; index < maxLength; index += 1) {
    compareValue(
      changes,
      category,
      `${label} 第${index + 1}项`,
      `${path}.${index}`,
      oldItems[index],
      newItems[index]
    );
  }
};

const compareWorkExperience = (changes: HistoryChange[], oldData: ResumeData, newData: ResumeData) => {
  const maxWorkLength = Math.max(oldData.workExperience.length, newData.workExperience.length);

  for (let workIndex = 0; workIndex < maxWorkLength; workIndex += 1) {
    const oldWork = oldData.workExperience[workIndex];
    const newWork = newData.workExperience[workIndex];
    const workLabel = `工作经历 第${workIndex + 1}段`;

    if (!oldWork || !newWork) {
      pushChange(changes, '工作经历', workLabel, `workExperience.${workIndex}`, oldWork, newWork);
      continue;
    }

    compareValue(changes, '工作经历', `${workLabel} 标题`, `workExperience.${workIndex}.title`, oldWork.title, newWork.title);
    compareValue(changes, '工作经历', `${workLabel} 时长`, `workExperience.${workIndex}.duration`, oldWork.duration, newWork.duration);

    const maxSummaryLength = Math.max(oldWork.summary?.length ?? 0, newWork.summary?.length ?? 0);
    for (let summaryIndex = 0; summaryIndex < maxSummaryLength; summaryIndex += 1) {
      compareValue(
        changes,
        '工作经历',
        `${workLabel} 摘要${summaryIndex + 1}`,
        `workExperience.${workIndex}.summary.${summaryIndex}`,
        oldWork.summary?.[summaryIndex],
        newWork.summary?.[summaryIndex]
      );
    }

    const maxProjectLength = Math.max(oldWork.projects.length, newWork.projects.length);
    for (let projectIndex = 0; projectIndex < maxProjectLength; projectIndex += 1) {
      const oldProject = oldWork.projects[projectIndex];
      const newProject = newWork.projects[projectIndex];
      const projectLabel = `${workLabel} 项目${projectIndex + 1}`;

      if (!oldProject || !newProject) {
        pushChange(
          changes,
          '工作经历',
          projectLabel,
          `workExperience.${workIndex}.projects.${projectIndex}`,
          oldProject,
          newProject
        );
        continue;
      }

      compareValue(
        changes,
        '工作经历',
        `${projectLabel} 标题`,
        `workExperience.${workIndex}.projects.${projectIndex}.name`,
        oldProject.name,
        newProject.name
      );
      compareValue(
        changes,
        '工作经历',
        `${projectLabel} 角色`,
        `workExperience.${workIndex}.projects.${projectIndex}.role`,
        oldProject.role,
        newProject.role
      );
      compareValue(
        changes,
        '工作经历',
        `${projectLabel} 项目背景`,
        `workExperience.${workIndex}.projects.${projectIndex}.description`,
        oldProject.description,
        newProject.description
      );

      const maxPointLength = Math.max(oldProject.points.length, newProject.points.length);
      for (let pointIndex = 0; pointIndex < maxPointLength; pointIndex += 1) {
        compareValue(
          changes,
          '工作经历',
          `${projectLabel} 描述${pointIndex + 1}`,
          `workExperience.${workIndex}.projects.${projectIndex}.points.${pointIndex}`,
          oldProject.points[pointIndex],
          newProject.points[pointIndex]
        );
      }
    }
  }
};

const compareSectionTitles = (changes: HistoryChange[], oldData: ResumeData, newData: ResumeData) => {
  const titles: Array<[keyof NonNullable<ResumeData['sectionTitles']>, string]> = [
    ['contact', '基本信息标题'],
    ['education', '教育背景标题'],
    ['skills', '专业技能标题'],
    ['work', '工作经历标题'],
    ['social', 'Side Project 标题'],
    ['evaluation', '自我评价标题'],
    ['portfolio', '项目作品标题'],
  ];

  titles.forEach(([key, label]) => {
    compareValue(
      changes,
      '模块标题',
      label,
      `sectionTitles.${key}`,
      oldData.sectionTitles?.[key],
      newData.sectionTitles?.[key]
    );
  });
};

const canvasElementLabel = (element?: CanvasElement) => {
  if (!element) return '未知元素';
  const text = element.text?.replace(/\s+/g, ' ').trim();
  if (text) return text.slice(0, 24);
  if (element.type === 'photo') return '照片';
  if (element.type === 'line') return '分割线';
  if (element.type === 'bullet') return '项目符号';
  if (element.type === 'sparkle') return '技能图标';
  if (element.type === 'quote-bar') return '引用竖线';
  if (element.type === 'portfolio-image') return '作品图片';
  return element.id;
};

const formatPosition = (element: CanvasElement) => ({ x: Math.round(element.x), y: Math.round(element.y) });

const formatSize = (element: CanvasElement) => ({
  width: Math.round(element.width),
  height: Math.round(element.height),
});

const compareCanvasElements = (changes: HistoryChange[], oldData: ResumeData, newData: ResumeData) => {
  const oldElements = oldData.canvasElements ?? [];
  const newElements = newData.canvasElements ?? [];
  const oldById = new Map(oldElements.map((element) => [element.id, element]));
  const newById = new Map(newElements.map((element) => [element.id, element]));
  const ids = [...new Set([...oldElements.map((element) => element.id), ...newElements.map((element) => element.id)])];

  ids.forEach((id) => {
    const oldElement = oldById.get(id);
    const newElement = newById.get(id);

    if (!oldElement || !newElement) {
      pushChange(
        changes,
        '画布布局',
        `${newElement ? '新增' : '删除'}画布元素 ${canvasElementLabel(newElement ?? oldElement)}`,
        `canvasElements.${id}`,
        oldElement ? canvasElementLabel(oldElement) : undefined,
        newElement ? canvasElementLabel(newElement) : undefined
      );
      return;
    }

    if (oldElement.x !== newElement.x || oldElement.y !== newElement.y) {
      pushChange(
        changes,
        '画布布局',
        `移动画布元素 ${canvasElementLabel(newElement)}`,
        `canvasElements.${id}.position`,
        formatPosition(oldElement),
        formatPosition(newElement)
      );
    }

    if (oldElement.width !== newElement.width || oldElement.height !== newElement.height) {
      pushChange(
        changes,
        '画布布局',
        `调整画布元素 ${canvasElementLabel(newElement)}`,
        `canvasElements.${id}.size`,
        formatSize(oldElement),
        formatSize(newElement)
      );
    }
  });
};

// 检测数据变化
export const detectChanges = (
  oldData: ResumeData,
  newData: ResumeData,
  options: { includeCanvas?: boolean } = {}
): HistoryChange[] => {
  const changes: HistoryChange[] = [];
  const includeCanvas = options.includeCanvas ?? true;

  compareValue(changes, '基本信息', '姓名', 'name', oldData.name, newData.name);
  compareValue(changes, '基本信息', '求职意向', 'title', oldData.title, newData.title);

  compareValue(changes, '联系方式', '手机号码', 'contact.tel', oldData.contact.tel, newData.contact.tel);
  compareValue(changes, '联系方式', '电子邮箱', 'contact.email', oldData.contact.email, newData.contact.email);
  compareValue(changes, '联系方式', '个人网站 / Blog', 'contact.blog', oldData.contact.blog, newData.contact.blog);
  compareValue(changes, '联系方式', 'GitHub', 'contact.github', oldData.contact.github, newData.contact.github);

  compareEducation(changes, oldData, newData);
  compareStringList(changes, '专业技能', '专业技能', 'skills', oldData.skills, newData.skills);
  compareWorkExperience(changes, oldData, newData);
  compareStringList(changes, 'Side Project', 'Side Project', 'socialProjects', oldData.socialProjects, newData.socialProjects);
  compareStringList(changes, '自我评价', '自我评价', 'selfEvaluation', oldData.selfEvaluation, newData.selfEvaluation);

  compareValue(changes, '头像', '头像', 'avatar', oldData.avatar, newData.avatar);
  compareValue(changes, '项目作品', '项目作品', 'portfolio', oldData.portfolio, newData.portfolio);
  compareSectionTitles(changes, oldData, newData);
  if (includeCanvas) {
    compareCanvasElements(changes, oldData, newData);
  }

  return changes;
};

// 生成变更描述
export const generateChangeDescription = (changes: HistoryChange[]): string => {
  if (changes.length === 0) return '未检测到变更';
  if (changes.length === 1) {
    return `${changes[0].type === 'added' ? '新增' : changes[0].type === 'removed' ? '删除' : '修改'}了${changes[0].field}`;
  }

  const categories = [...new Set(changes.map((change) => change.category || change.field))];
  const visibleCategories = categories.slice(0, 3).join('、');
  return `修改了${visibleCategories}${categories.length > 3 ? `等${changes.length}处` : ''}`;
};

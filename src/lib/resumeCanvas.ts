import { CanvasElement, CanvasGuide, CanvasTextStyle, ResumeData, SideProject } from '../types';

export const A4_WIDTH = 794;
export const A4_HEIGHT = 1123;
export const PAGE_MARGIN = 38;
export const PAGE_BOTTOM_MARGIN = 30;
export const SNAP_THRESHOLD = 7;

const contentWidth = A4_WIDTH - PAGE_MARGIN * 2;

const singleLine = (style: CanvasTextStyle): CanvasTextStyle => ({
  ...style,
  whiteSpace: 'nowrap',
});

const text = (
  id: string,
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
  style: CanvasTextStyle,
  zIndex = 1,
  href?: string
): CanvasElement => ({
  id,
  type: 'text',
  text: value,
  x,
  y,
  width,
  height,
  style,
  zIndex,
  href,
});

const line = (id: string, x: number, y: number, width: number, color = '#0095ff'): CanvasElement => ({
  id,
  type: 'line',
  x,
  y,
  width,
  height: 2,
  color,
  zIndex: 0,
});

const bullet = (id: string, x: number, y: number, color = '#0095ff'): CanvasElement => ({
  id,
  type: 'bullet',
  x,
  y,
  width: 6,
  height: 6,
  color,
  zIndex: 1,
});

const sparkle = (id: string, x: number, y: number, color = '#0095ff'): CanvasElement => ({
  id,
  type: 'sparkle',
  x,
  y,
  width: 15,
  height: 15,
  color,
  zIndex: 1,
});

const QUOTE_BAR_HEIGHT = 20;

const quoteBar = (id: string, x: number, y: number, color = '#0095ff'): CanvasElement => ({
  id,
  type: 'quote-bar',
  x,
  y,
  width: 6,
  height: QUOTE_BAR_HEIGHT,
  color,
  zIndex: 1,
});

const styles = {
  name: singleLine({ fontSize: 32, fontWeight: 700, color: '#0f172a', lineHeight: 1.1 }),
  title: singleLine({ fontSize: 16, fontWeight: 700, color: '#0095ff', lineHeight: 1.2 }),
  label: singleLine({ fontSize: 12, fontWeight: 700, color: '#1e293b', lineHeight: 1.2 }),
  value: singleLine({ fontSize: 12, fontWeight: 400, color: '#475569', lineHeight: 1.2 }),
  section: singleLine({ fontSize: 17, fontWeight: 700, color: '#0095ff', lineHeight: 1.15 }),
  eduMuted: singleLine({ fontSize: 13, fontWeight: 600, color: '#64748b', lineHeight: 1.2 }),
  eduStrong: singleLine({ fontSize: 13, fontWeight: 700, color: '#1e293b', lineHeight: 1.2 }),
  eduValue: singleLine({ fontSize: 13, fontWeight: 400, color: '#475569', lineHeight: 1.2 }),
  degree: singleLine({ fontSize: 13, fontWeight: 500, color: '#1e293b', lineHeight: 1.2, textAlign: 'right' }),
  body: { fontSize: 13, fontWeight: 400, color: '#334155', lineHeight: 1.55, whiteSpace: 'pre-wrap' as const },
  project: singleLine({ fontSize: 13, fontWeight: 700, color: '#1e293b', lineHeight: 1.25 }),
  workTag: singleLine({ fontSize: 17, fontWeight: 700, color: '#0095ff', lineHeight: 1.1, textAlign: 'right' }),
};

export const isSideProject = (project: string | SideProject): project is SideProject =>
  typeof project === 'object' && project !== null;

export const getSideProjectText = (project: string | SideProject) =>
  isSideProject(project) ? `${project.name}：${project.description}` : project;

export const getSideProjectHref = (project: string | SideProject) =>
  isSideProject(project) ? project.url : undefined;

export const getWorkCompanyName = (title: string) =>
  title
    .split(/[｜|]/)[0]
    .split(/\s+-\s+/)[0]
    .trim();

export const getWorkDurationLabel = (work: ResumeData['workExperience'][number]) => {
  const company = getWorkCompanyName(work.title);
  return company && work.duration ? `${company} · ${work.duration}` : work.duration;
};

export const estimateTextHeight = (value: string, width: number, fontSize: number, lineHeight = 1.35) => {
  const lines = value.split('\n').reduce((total, paragraph) => {
    const units = [...paragraph].reduce((sum, char) => {
      if (/\s/.test(char)) return sum + 0.35;
      return /[\u3400-\u9fff]/.test(char) ? sum + 1 : sum + 0.58;
    }, 0);
    const unitsPerLine = Math.max(1, width / (fontSize * 0.96));
    return total + Math.max(1, Math.ceil(units / unitsPerLine));
  }, 0);

  return Math.ceil(lines * fontSize * lineHeight + 4);
};

const hasManualLineBreak = (value = '') => /\r|\n/.test(value);

export const getTextElementWhiteSpace = (element: CanvasElement, value = element.text ?? '') =>
  hasManualLineBreak(value) && element.style?.whiteSpace === 'nowrap'
    ? 'pre-wrap'
    : element.style?.whiteSpace;

const getMinimumTextHeight = (element: CanvasElement) => {
  const fontSize = element.style?.fontSize ?? 13;
  const lineHeight = element.style?.lineHeight ?? 1.35;
  return Math.max(1, Math.min(element.height, Math.ceil(fontSize * lineHeight + 4)));
};

export const getTextElementAutoHeight = (element: CanvasElement, value = element.text ?? '') => {
  if (element.type !== 'text') return element.height;

  const whiteSpace = getTextElementWhiteSpace(element, value);
  const minimumHeight = getMinimumTextHeight(element);

  if (whiteSpace === 'nowrap' && !hasManualLineBreak(value)) {
    return minimumHeight;
  }

  return Math.max(
    minimumHeight,
    estimateTextHeight(
      value,
      element.width,
      element.style?.fontSize ?? 13,
      element.style?.lineHeight ?? 1.35
    )
  );
};

const getElementsById = (elements: CanvasElement[]) => new Map(elements.map((element) => [element.id, element]));

const getTextIdForMarker = (id: string) => {
  if (id.endsWith('-bullet')) return id.replace(/-bullet$/, '-text');
  if (id.endsWith('-icon')) return id.replace(/-icon$/, '-text');
  if (id.endsWith('-description-bar')) return id.replace(/-description-bar$/, '-description');
  return null;
};

const getTitleIdForLine = (id: string) => (id.endsWith('-line') ? id.replace(/-line$/, '-title') : null);

const getLineIdForTitle = (id: string) => (id.endsWith('-title') ? id.replace(/-title$/, '-line') : null);

const getFlowAnchorY = (element: CanvasElement, elementsById: Map<string, CanvasElement>) => {
  const textId = getTextIdForMarker(element.id);
  if (textId) return elementsById.get(textId)?.y ?? element.y;

  const titleId = getTitleIdForLine(element.id);
  if (titleId) return elementsById.get(titleId)?.y ?? element.y;

  return element.y;
};

interface FlowRow {
  anchorY: number;
  bottom: number;
  elements: CanvasElement[];
}

const getFlowRows = (elements: CanvasElement[]) => {
  const elementsById = getElementsById(elements);
  const rows = new Map<number, FlowRow>();

  elements.forEach((element) => {
    if (element.type === 'photo') return;

    const anchorY = Math.round(getFlowAnchorY(element, elementsById));
    const current = rows.get(anchorY) ?? { anchorY, bottom: anchorY, elements: [] };
    current.elements.push(element);
    current.bottom = Math.max(current.bottom, element.y + element.height);
    rows.set(anchorY, current);
  });

  return [...rows.values()].sort((left, right) => left.anchorY - right.anchorY);
};

const getFlowRowForElement = (elements: CanvasElement[], elementId: string) => {
  const elementsById = getElementsById(elements);
  const target = elementsById.get(elementId);
  if (!target) return null;

  const anchorY = Math.round(getFlowAnchorY(target, elementsById));
  return getFlowRows(elements).find((row) => row.anchorY === anchorY) ?? null;
};

const getDefaultGapAfterDeletedRow = (row: FlowRow) => {
  const ids = row.elements.map((element) => element.id);

  if (ids.some((id) => id.endsWith('-title') || id.endsWith('-line'))) return 11;
  if (ids.some((id) => /^education-\d+-/.test(id))) return 4;
  if (ids.some((id) => /^work-\d+-project-\d+-(name|role)$/.test(id))) return 5;
  if (
    ids.some(
      (id) =>
        id.startsWith('skills-') ||
        id.startsWith('social-') ||
        id.startsWith('evaluation-') ||
        /-summary-\d+-(text|bullet)$/.test(id) ||
        /-description(?:-bar)?$/.test(id) ||
        /-point-\d+-(text|bullet)$/.test(id)
    )
  ) {
    return 7;
  }

  return 0;
};

const getDeletedRowShift = (row: FlowRow, allRows: FlowRow[]) => {
  const nextRow = allRows.find((candidate) => candidate.anchorY > row.anchorY);
  const defaultGap = getDefaultGapAfterDeletedRow(row);

  if (!nextRow) return row.bottom - row.anchorY + defaultGap;

  const actualGap = nextRow.anchorY - row.bottom;
  const removableGap = actualGap >= 0 && actualGap <= 14 ? actualGap : defaultGap;
  return row.bottom - row.anchorY + removableGap;
};

const getProjectHeaderPrefix = (id: string) => id.match(/^(work-\d+-project-\d+)-(?:name|role)$/)?.[1];

const getEducationPrefix = (id: string) => id.match(/^(education-\d+)-/)?.[1];

const getContactPrefix = (id: string) => id.match(/^(contact-(?:tel|email|blog|github))(?:-label)?$/)?.[1];

const getWorkSectionIndex = (id: string) => id.match(/^work-(\d+)-section-(?:title|line)$/)?.[1];

export const getDeletionCascadeIds = (elements: CanvasElement[], selectedIds: string[]) => {
  const elementsById = getElementsById(elements);
  const ids = new Set(selectedIds);
  const addIfExists = (id: string | null | undefined) => {
    if (id && elementsById.has(id)) ids.add(id);
  };

  selectedIds.forEach((id) => {
    if (id.endsWith('-text')) {
      addIfExists(id.replace(/-text$/, '-bullet'));
      addIfExists(id.replace(/-text$/, '-icon'));
    }

    if (id.endsWith('-description')) {
      addIfExists(`${id}-bar`);
    }

    addIfExists(getTextIdForMarker(id));
    addIfExists(getLineIdForTitle(id));
    addIfExists(getTitleIdForLine(id));

    const workSectionIndex = getWorkSectionIndex(id);
    if (workSectionIndex !== undefined) {
      addIfExists(`work-${workSectionIndex}-duration`);
    }

    const projectHeaderPrefix = getProjectHeaderPrefix(id);
    if (projectHeaderPrefix) {
      addIfExists(`${projectHeaderPrefix}-name`);
      addIfExists(`${projectHeaderPrefix}-role`);
    }

    const educationPrefix = getEducationPrefix(id);
    if (educationPrefix) {
      elements.forEach((element) => {
        if (element.id.startsWith(`${educationPrefix}-`)) ids.add(element.id);
      });
    }

    const contactPrefix = getContactPrefix(id);
    if (contactPrefix) {
      addIfExists(`${contactPrefix}-label`);
      addIfExists(contactPrefix);
    }
  });

  return ids;
};

export const updateTextElementAndReflow = (
  elements: CanvasElement[],
  id: string,
  value: string,
  measuredHeight?: number
): CanvasElement[] => {
  const target = elements.find((element) => element.id === id);
  if (!target || target.type !== 'text') return elements;

  const domMeasuredHeight = Number.isFinite(measuredHeight) && measuredHeight && measuredHeight > 0
    ? Math.ceil(measuredHeight)
    : null;
  const nextHeight = domMeasuredHeight
    ? Math.max(getMinimumTextHeight(target), domMeasuredHeight)
    : getTextElementAutoHeight({ ...target, text: value }, value);
  const oldRow = getFlowRowForElement(elements, id);
  const lineId = getLineIdForTitle(id);
  const titleLineGap = 3;

  const resized = elements.map((element) => {
    if (element.id === id) {
      return { ...element, text: value, height: nextHeight };
    }

    if (lineId && element.id === lineId) {
      return { ...element, y: target.y + nextHeight + titleLineGap };
    }

    if (id.endsWith('-description') && element.id === `${id}-bar`) {
      return { ...element, height: QUOTE_BAR_HEIGHT };
    }

    return element;
  });

  const nextRow = getFlowRowForElement(resized, id);
  if (!oldRow || !nextRow) return resized;

  const delta = nextRow.bottom - oldRow.bottom;
  if (delta === 0) return resized;

  const originalElementsById = getElementsById(elements);
  return resized.map((element) => {
    if (element.id === id || (lineId && element.id === lineId)) return element;

    const originalElement = originalElementsById.get(element.id);
    if (!originalElement) return element;

    const anchorY = getFlowAnchorY(originalElement, originalElementsById);
    return anchorY > oldRow.anchorY ? { ...element, y: element.y + delta } : element;
  });
};

export const deleteElementsAndReflow = (elements: CanvasElement[], selectedIds: string[]) => {
  const idsToDelete = getDeletionCascadeIds(elements, selectedIds);
  const allRows = getFlowRows(elements);
  const deletedRows = allRows.filter((row) => row.elements.every((element) => idsToDelete.has(element.id)));

  if (!deletedRows.length) {
    return elements.filter((element) => !idsToDelete.has(element.id));
  }

  const rowShifts = deletedRows.map((row) => ({
    anchorY: row.anchorY,
    shift: getDeletedRowShift(row, allRows),
  }));
  const elementsById = getElementsById(elements);

  return elements
    .filter((element) => !idsToDelete.has(element.id))
    .map((element) => {
      const anchorY = getFlowAnchorY(element, elementsById);
      const shift = rowShifts.reduce(
        (total, row) => (anchorY > row.anchorY ? total + row.shift : total),
        0
      );

      return shift ? { ...element, y: element.y - shift } : element;
    });
};

const pageStartFor = (y: number) => Math.floor(y / A4_HEIGHT) * A4_HEIGHT;
const pageBottomFor = (y: number) => pageStartFor(y) + A4_HEIGHT - PAGE_BOTTOM_MARGIN;
const nextPageY = (y: number) => pageStartFor(y) + A4_HEIGHT + PAGE_MARGIN;

const avoidPageBreak = (y: number, blockHeight: number) => {
  const usablePageHeight = A4_HEIGHT - PAGE_MARGIN - PAGE_BOTTOM_MARGIN;
  if (blockHeight > usablePageHeight) return y;
  return y + blockHeight > pageBottomFor(y) ? nextPageY(y) : y;
};

const addSectionHeader = (elements: CanvasElement[], id: string, title: string, y: number) => {
  elements.push(text(`${id}-title`, title, PAGE_MARGIN, y, 150, 20, styles.section, 2));
  elements.push(line(`${id}-line`, PAGE_MARGIN, y + 27, contentWidth));
  return y + 36;
};

const getFirstProjectBlockHeight = (work: ResumeData['workExperience'][number]) => {
  const firstSummary = work.summary?.[0] ?? '';
  if (firstSummary) {
    const firstSummaryHeight = Math.max(18, estimateTextHeight(firstSummary, contentWidth - 30, styles.body.fontSize, styles.body.lineHeight));
    return 32 + firstSummaryHeight;
  }

  const firstProject = work.projects[0];
  if (!firstProject) return 32;

  const firstPoint = firstProject.points[0] ?? '';
  const firstDescriptionHeight = firstProject.description
    ? Math.max(20, estimateTextHeight(firstProject.description, contentWidth - 40, styles.body.fontSize, styles.body.lineHeight))
    : 0;
  const firstPointHeight = firstPoint
    ? Math.max(18, estimateTextHeight(firstPoint, contentWidth - 30, styles.body.fontSize, styles.body.lineHeight))
    : 0;

  return 32 + ((firstProject.name || firstProject.role) ? 21 : 0) + firstDescriptionHeight + firstPointHeight;
};

export const createResumeCanvasElements = (data: ResumeData): CanvasElement[] => {
  const elements: CanvasElement[] = [];

  elements.push(text('name', data.name, PAGE_MARGIN, 70, 240, 38, styles.name, 2));
  elements.push(text('title', `求职意向：${data.title || '前端开发工程师'}`, PAGE_MARGIN, 118, 320, 24, styles.title, 2));

  elements.push(text('contact-tel-label', 'TEL:', PAGE_MARGIN, 168, 32, 18, styles.label));
  elements.push(text('contact-tel', data.contact.tel, 76, 168, 126, 18, styles.value));
  elements.push(text('contact-email-label', 'E-mail:', 220, 168, 54, 18, styles.label));
  elements.push(text('contact-email', data.contact.email, 278, 168, 172, 18, styles.value));
  elements.push(text('contact-blog-label', 'Blog:', 470, 168, 38, 18, styles.label));
  elements.push(
    text('contact-blog', data.contact.blog, 512, 168, 150, 18, {
      ...styles.value,
      textDecoration: 'underline',
    })
  );

  if (data.contact.github) {
    elements.push(text('contact-github-label', 'GitHub:', PAGE_MARGIN, 194, 60, 18, styles.label));
    elements.push(text('contact-github', data.contact.github, 112, 194, 240, 18, styles.value));
  }

  elements.push({
    id: 'photo',
    type: 'photo',
    src: data.avatar,
    x: A4_WIDTH - PAGE_MARGIN - 95,
    y: 92,
    width: 95,
    height: 132,
    zIndex: 2,
  });

  let y = 197;
  const educationBlockHeight = 32 + data.education.length * 20;
  y = avoidPageBreak(y, educationBlockHeight);
  y = addSectionHeader(elements, 'education', data.sectionTitles?.education || '教育背景', y);

  data.education.forEach((edu, index) => {
    y = avoidPageBreak(y, 20);
    elements.push(text(`education-${index}-duration`, edu.duration, PAGE_MARGIN, y, 130, 18, styles.eduMuted));
    elements.push(text(`education-${index}-school`, edu.school, 168, y, 76, 18, styles.eduStrong));
    elements.push(text(`education-${index}-college`, edu.college, 252, y, 140, 18, styles.eduValue));
    elements.push(text(`education-${index}-major`, edu.major, 402, y, 220, 18, styles.eduValue));
    elements.push(text(`education-${index}-degree`, edu.degree, 620, y, 128, 18, styles.degree));
    y += 20;
  });

  y += 26;
  y = avoidPageBreak(y, 58);
  y = addSectionHeader(elements, 'skills', data.sectionTitles?.skills || '专业技能', y);

  data.skills.forEach((skill, index) => {
    const skillHeight = Math.max(18, estimateTextHeight(skill, contentWidth - 35, styles.body.fontSize, styles.body.lineHeight));
    y = avoidPageBreak(y, skillHeight + 4);
    elements.push(sparkle(`skills-${index}-icon`, PAGE_MARGIN, y + 2));
    elements.push(text(`skills-${index}-text`, skill, PAGE_MARGIN + 23, y, contentWidth - 35, skillHeight, styles.body));
    y += skillHeight + 4;
  });

  y += 24;
  data.workExperience.forEach((work, workIndex) => {
    y = avoidPageBreak(y, getFirstProjectBlockHeight(work));
    y = addSectionHeader(elements, `work-${workIndex}-section`, workIndex === 0 ? (data.sectionTitles?.work || '工作经历') : ' ', y);

    if (work.duration) {
      elements.push(text(`work-${workIndex}-duration`, getWorkDurationLabel(work), A4_WIDTH - PAGE_MARGIN - 300, y - 40, 300, 24, styles.workTag, 2));
    }

    work.summary?.forEach((item, summaryIndex) => {
      const itemHeight = Math.max(18, estimateTextHeight(item, contentWidth - 30, styles.body.fontSize, styles.body.lineHeight));
      y = avoidPageBreak(y, itemHeight + 4);
      elements.push(bullet(`work-${workIndex}-summary-${summaryIndex}-bullet`, PAGE_MARGIN + 3, y + 6));
      elements.push(text(`work-${workIndex}-summary-${summaryIndex}-text`, item, PAGE_MARGIN + 24, y, contentWidth - 30, itemHeight, styles.body));
      y += itemHeight + 4;
    });

    if (work.summary?.length && work.projects.length) {
      y += 3;
    }

    work.projects.forEach((project, projectIndex) => {
      const firstPoint = project.points[0] ?? '';
      const descriptionHeight = project.description
        ? Math.max(20, estimateTextHeight(project.description, contentWidth - 40, styles.body.fontSize, styles.body.lineHeight))
        : 0;
      const firstPointHeight = firstPoint
        ? Math.max(18, estimateTextHeight(firstPoint, contentWidth - 30, styles.body.fontSize, styles.body.lineHeight))
        : 0;
      const projectHeaderHeight = (project.name || project.role) ? 21 : 0;
      y = avoidPageBreak(y, projectHeaderHeight + descriptionHeight + firstPointHeight + 5);

      if (project.name || project.role) {
        if (project.name) {
          elements.push(text(`work-${workIndex}-project-${projectIndex}-name`, project.name, PAGE_MARGIN, y, 460, 18, styles.project));
        }
        if (project.role) {
          elements.push(text(`work-${workIndex}-project-${projectIndex}-role`, project.role, PAGE_MARGIN + 460, y, contentWidth - 460, 18, {
            ...styles.eduMuted,
            textAlign: 'right'
          }));
        }
        y += 21;
      }

      if (project.description) {
        y = avoidPageBreak(y, descriptionHeight + 4);
        elements.push(quoteBar(`work-${workIndex}-project-${projectIndex}-description-bar`, PAGE_MARGIN, y + 2));
        elements.push(
          text(
            `work-${workIndex}-project-${projectIndex}-description`,
            project.description,
            PAGE_MARGIN + 18,
            y,
            contentWidth - 26,
            descriptionHeight,
            { ...styles.body, color: '#475569' }
          )
        );
        y += descriptionHeight + 4;
      }

      project.points.forEach((point, pointIndex) => {
        const pointHeight = Math.max(18, estimateTextHeight(point, contentWidth - 30, styles.body.fontSize, styles.body.lineHeight));
        y = avoidPageBreak(y, pointHeight + 4);
        elements.push(bullet(`work-${workIndex}-project-${projectIndex}-point-${pointIndex}-bullet`, PAGE_MARGIN + 3, y + 6));
        elements.push(
          text(
            `work-${workIndex}-project-${projectIndex}-point-${pointIndex}-text`,
            point,
            PAGE_MARGIN + 24,
            y,
            contentWidth - 30,
            pointHeight,
            styles.body
          )
        );
        y += pointHeight + 4;
      });

      y += 10;
    });

    y += 5;
  });

  if (data.socialProjects.length) {
    y += 24;
    y = avoidPageBreak(y, 54);
    y = addSectionHeader(elements, 'social', data.sectionTitles?.social || 'Side Project', y);
    data.socialProjects.forEach((project, index) => {
      const projectText = getSideProjectText(project);
      const projectHref = getSideProjectHref(project);
      const itemHeight = Math.max(18, estimateTextHeight(projectText, contentWidth - 30, styles.body.fontSize, styles.body.lineHeight));
      y = avoidPageBreak(y, itemHeight + 4);
      elements.push(bullet(`social-${index}-bullet`, PAGE_MARGIN + 3, y + 6));
      elements.push(text(`social-${index}-text`, projectText, PAGE_MARGIN + 24, y, contentWidth - 30, itemHeight, styles.body, 1, projectHref));
      y += itemHeight + 4;
    });
  }

  if (data.selfEvaluation.length) {
    y += 30;
    y = avoidPageBreak(y, 54);
    y = addSectionHeader(elements, 'evaluation', data.sectionTitles?.evaluation || '自我评价', y);
    data.selfEvaluation.forEach((item, index) => {
      const itemHeight = Math.max(18, estimateTextHeight(item, contentWidth - 35, styles.body.fontSize, styles.body.lineHeight));
      y = avoidPageBreak(y, itemHeight + 4);
      elements.push(sparkle(`evaluation-${index}-icon`, PAGE_MARGIN, y + 2));
      elements.push(text(`evaluation-${index}-text`, item, PAGE_MARGIN + 23, y, contentWidth - 35, itemHeight, styles.body));
      y += itemHeight + 4;
    });
  }

  if (data.portfolio && data.portfolio.items.length > 0) {
    y += 12;
    const gap = data.portfolio.gap ?? 15;
    const useOriginalSize = data.portfolio.useOriginalSize ?? false;
    const fixedHeight = data.portfolio.imageHeight ?? 180;
    const maxCols = 4; // 最大列数

    y = avoidPageBreak(y, 84);
    y = addSectionHeader(elements, 'portfolio', data.sectionTitles?.portfolio || '项目作品', y);

    let currentRowY = y;
    let currentRowUsedCols = 0; // 当前行已使用的列数
    let maxHeightInRow = 0;

    data.portfolio.items.forEach((item, index) => {
      const itemCols = Math.max(1, Math.min(maxCols, item.cols || 2)); // 限制在1-4之间，默认2

      // 如果当前行放不下，换行
      if (currentRowUsedCols + itemCols > maxCols) {
        currentRowY += maxHeightInRow + gap;
        currentRowY = avoidPageBreak(currentRowY, fixedHeight);
        maxHeightInRow = 0;
        currentRowUsedCols = 0;
      }

      // 计算该图片的宽度（基于占据的列数）
      const totalGaps = (maxCols - 1) * gap;
      const availableWidth = contentWidth - totalGaps;
      const singleColWidth = availableWidth / maxCols;
      const imageWidth = singleColWidth * itemCols + gap * (itemCols - 1);

      // 计算x位置
      const x = PAGE_MARGIN + (singleColWidth + gap) * currentRowUsedCols;

      // 计算图片高度
      let imageHeight = fixedHeight;
      if (useOriginalSize && typeof item === 'object' && item.width && item.height) {
        imageHeight = (imageWidth / item.width) * item.height;
      }

      const imageUrl = typeof item === 'string' ? item : item.url;

      elements.push({
        id: `portfolio-${index}`,
        type: 'portfolio-image',
        src: imageUrl,
        x,
        y: currentRowY,
        width: imageWidth,
        height: imageHeight,
        zIndex: 1,
      });

      currentRowUsedCols += itemCols;
      maxHeightInRow = Math.max(maxHeightInRow, imageHeight);
    });

    y = currentRowY + maxHeightInRow + gap;
  }

  return elements;
};

export const getResumeCanvasHeight = (elements: CanvasElement[]) => {
  const bottom = elements.reduce((max, element) => Math.max(max, element.y + element.height + PAGE_BOTTOM_MARGIN), A4_HEIGHT);
  return Math.ceil(bottom / A4_HEIGHT) * A4_HEIGHT;
};

export const resetElementsToTemplate = (current: CanvasElement[], template: CanvasElement[]) => {
  const currentById = new Map(current.map((element) => [element.id, element]));

  return template.map((element) => {
    const matching = currentById.get(element.id);
    if (!matching) return element;
    return {
      ...element,
      text: matching.text ?? element.text,
      src: matching.src ?? element.src,
    };
  });
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const nearestSnap = (
  activeValues: { value: number; offset: number }[],
  targets: number[]
): { delta: number; guide?: number } => {
  let best: { distance: number; delta: number; guide: number } | null = null;

  activeValues.forEach((active) => {
    targets.forEach((target) => {
      const distance = Math.abs(target - active.value);
      if (distance <= SNAP_THRESHOLD && (!best || distance < best.distance)) {
        best = {
          distance,
          delta: target - active.value,
          guide: target,
        };
      }
    });
  });

  return best ? { delta: best.delta, guide: best.guide } : { delta: 0 };
};

export const snapElementPosition = (
  element: CanvasElement,
  rawX: number,
  rawY: number,
  elements: CanvasElement[],
  canvasHeight: number,
  ignoreIds: string[] = [element.id]
): { x: number; y: number; guides: CanvasGuide[] } => {
  const pageCount = Math.ceil(canvasHeight / A4_HEIGHT);
  const ignored = new Set(ignoreIds);
  const verticalTargets = new Set<number>([0, PAGE_MARGIN, A4_WIDTH / 2, A4_WIDTH - PAGE_MARGIN, A4_WIDTH]);
  const horizontalTargets = new Set<number>();

  for (let page = 0; page < pageCount; page += 1) {
    const offset = page * A4_HEIGHT;
    [offset, offset + PAGE_MARGIN, offset + A4_HEIGHT / 2, offset + A4_HEIGHT - PAGE_BOTTOM_MARGIN, offset + A4_HEIGHT].forEach((target) =>
      horizontalTargets.add(target)
    );
  }

  elements.forEach((other) => {
    if (ignored.has(other.id)) return;
    verticalTargets.add(other.x);
    verticalTargets.add(other.x + other.width / 2);
    verticalTargets.add(other.x + other.width);
    horizontalTargets.add(other.y);
    horizontalTargets.add(other.y + other.height / 2);
    horizontalTargets.add(other.y + other.height);
  });

  const x = clamp(rawX, 0, A4_WIDTH - element.width);
  const y = Math.max(0, rawY);

  const verticalSnap = nearestSnap(
    [
      { value: x, offset: 0 },
      { value: x + element.width / 2, offset: element.width / 2 },
      { value: x + element.width, offset: element.width },
    ],
    [...verticalTargets]
  );
  const horizontalSnap = nearestSnap(
    [
      { value: y, offset: 0 },
      { value: y + element.height / 2, offset: element.height / 2 },
      { value: y + element.height, offset: element.height },
    ],
    [...horizontalTargets]
  );

  const guides: CanvasGuide[] = [];
  if (verticalSnap.guide !== undefined) guides.push({ orientation: 'vertical', position: verticalSnap.guide });
  if (horizontalSnap.guide !== undefined) guides.push({ orientation: 'horizontal', position: horizontalSnap.guide });

  return {
    x: Math.round(x + verticalSnap.delta),
    y: Math.round(y + horizontalSnap.delta),
    guides,
  };
};

export const duplicateElement = (element: CanvasElement, elements: CanvasElement[], index = 0): CanvasElement => {
  const maxZ = elements.reduce((max, item) => Math.max(max, item.zIndex ?? 1), 1);
  return {
    ...element,
    id: `${element.id}-copy-${Date.now()}-${Math.random().toString(36).slice(2)}-${index}`,
    x: clamp(element.x + 18, 0, A4_WIDTH - element.width),
    y: element.y + 18,
    zIndex: maxZ + index + 1,
  };
};

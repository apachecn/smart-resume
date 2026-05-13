import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { A4_HEIGHT, A4_WIDTH } from './resumeCanvas';

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

const createExportClone = (element: HTMLElement) => {
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.style.width = `${A4_WIDTH}px`;
  host.style.background = '#ffffff';
  host.style.pointerEvents = 'none';

  const clone = element.cloneNode(true) as HTMLElement;
  clone.classList.add('is-exporting');
  clone.style.transform = 'none';
  clone.style.margin = '0';
  clone.style.boxShadow = 'none';
  clone.style.width = `${A4_WIDTH}px`;
  clone.style.minHeight = `${A4_HEIGHT}px`;

  host.appendChild(clone);
  document.body.appendChild(host);

  return { host, clone };
};

export const captureResumeCanvas = async (element: HTMLElement, scale = 3) => {
  await document.fonts?.ready;
  const { host, clone } = createExportClone(element);

  try {
    const height = Math.max(A4_HEIGHT, clone.scrollHeight);
    return await html2canvas(clone, {
      scale,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: A4_WIDTH,
      height,
      windowWidth: A4_WIDTH,
      windowHeight: height,
      scrollX: 0,
      scrollY: 0,
    });
  } finally {
    host.remove();
  }
};

export const saveResumeAsImage = async (element: HTMLElement, fileName: string) => {
  const canvas = await captureResumeCanvas(element);
  const link = document.createElement('a');
  link.download = fileName;
  link.href = canvas.toDataURL('image/png');
  link.click();
};

export const saveResumeAsPDF = async (element: HTMLElement, fileName: string) => {
  const scale = 3;
  const canvas = await captureResumeCanvas(element, scale);
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pagePixelHeight = A4_HEIGHT * scale;
  const pageCount = Math.ceil(canvas.height / pagePixelHeight);

  for (let page = 0; page < pageCount; page += 1) {
    if (page > 0) pdf.addPage('a4', 'portrait');

    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;
    pageCanvas.height = pagePixelHeight;

    const context = pageCanvas.getContext('2d');
    if (!context) continue;

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    context.drawImage(
      canvas,
      0,
      page * pagePixelHeight,
      canvas.width,
      pagePixelHeight,
      0,
      0,
      canvas.width,
      pagePixelHeight
    );

    pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM, undefined, 'FAST');
  }

  pdf.save(fileName);
};

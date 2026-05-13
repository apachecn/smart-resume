export interface WorkExperience {
  company: string;
  role: string;
  duration: string;
  description: string[];
}

export interface Education {
  school: string;
  major: string;
  degree: string;
  duration: string;
  college: string;
}

export interface ResumeData {
  name: string;
  title: string;
  contact: {
    tel: string;
    email: string;
    blog: string;
    github?: string;
  };
  education: Education[];
  skills: string[];
  workExperience: {
    title: string;
    duration: string;
    summary?: string[];
    projects: {
      name: string;
      description?: string;
      role?: string;
      points: string[];
    }[];
  }[];
  socialProjects: Array<string | SideProject>;
  selfEvaluation: string[];
  portfolio?: {
    items: Array<{
      url: string;
      width?: number;
      height?: number;
      cols?: number; // 该图片占据的列数，0-4，0表示换行
    }>; // 图片数组，包含URL、原始尺寸和列数
    gap?: number; // 图片间距，默认15
    imageHeight?: number; // 图片高度，默认180
    useOriginalSize?: boolean; // 是否使用原始尺寸
  };
  avatar?: string;
  sectionTitles?: {
    contact?: string;
    education?: string;
    skills?: string;
    work?: string;
    social?: string;
    evaluation?: string;
    portfolio?: string;
  };
  canvasElements?: CanvasElement[];
  layoutVersion?: number;
}

export type CanvasElementType = 'text' | 'line' | 'photo' | 'bullet' | 'sparkle' | 'portfolio-image' | 'quote-bar';

export interface SideProject {
  name: string;
  url: string;
  description: string;
}

export interface CanvasTextStyle {
  fontSize: number;
  fontWeight?: number | string;
  color: string;
  lineHeight?: number;
  textAlign?: 'left' | 'center' | 'right';
  textDecoration?: 'none' | 'underline';
  whiteSpace?: 'normal' | 'nowrap' | 'pre-wrap';
}

export interface CanvasElement {
  id: string;
  type: CanvasElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex?: number;
  text?: string;
  src?: string;
  href?: string;
  color?: string;
  style?: CanvasTextStyle;
}

export interface CanvasGuide {
  orientation: 'vertical' | 'horizontal';
  position: number;
}

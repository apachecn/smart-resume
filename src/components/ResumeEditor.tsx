import React from 'react';
import { ResumeData, SideProject } from '../types';
import { Plus, Trash2, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { cn } from '../lib/utils';
import { isSideProject } from '../lib/resumeCanvas';

interface ResumeEditorProps {
  data: ResumeData;
  onChange: (newData: ResumeData) => void;
}

interface InputFieldProps {
  label: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}

function InputField({ label, value, onChange, placeholder = "" }: InputFieldProps) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={onChange}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-resume-blue bg-white transition-all shadow-sm"
      />
    </div>
  );
}

export default function ResumeEditor({ data, onChange }: ResumeEditorProps) {
  const [activeTab, setActiveTab] = React.useState('contact');
  const [editingTitle, setEditingTitle] = React.useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = React.useState('');
  const [initialTitleValue, setInitialTitleValue] = React.useState<string | null>(null);

  const getSectionTitle = (section: string, defaultTitle: string) => {
    return data.sectionTitles?.[section as keyof typeof data.sectionTitles] || defaultTitle;
  };

  const updateSectionTitle = (section: string, title: string) => {
    onChange({
      ...data,
      sectionTitles: {
        ...data.sectionTitles,
        [section]: title
      }
    });
  };

  const updateContact = (key: keyof typeof data.contact, value: string) => {
    onChange({ ...data, contact: { ...data.contact, [key]: value } });
  };

  const updateEducation = (idx: number, field: string, value: string) => {
    const newEdu = [...data.education];
    newEdu[idx] = { ...newEdu[idx], [field]: value };
    onChange({ ...data, education: newEdu });
  };

  const addEducation = () => {
    onChange({
      ...data,
      education: [...data.education, { duration: '', school: '', major: '', degree: '', college: '' }]
    });
  };

  const removeEducation = (idx: number) => {
    onChange({ ...data, education: data.education.filter((_, i) => i !== idx) });
  };

  const updateSkills = (idx: number, value: string) => {
    const newSkills = [...data.skills];
    newSkills[idx] = value;
    onChange({ ...data, skills: newSkills });
  };

  const addSkill = () => {
    onChange({ ...data, skills: [...data.skills, ''] });
  };

  const removeSkill = (idx: number) => {
    onChange({ ...data, skills: data.skills.filter((_, i) => i !== idx) });
  };

  const updateWorkExperience = (workIdx: number, field: string, value: any) => {
    const newWork = [...data.workExperience];
    newWork[workIdx] = { ...newWork[workIdx], [field]: value };
    onChange({ ...data, workExperience: newWork });
  };

  const addWorkExperience = () => {
    onChange({
      ...data,
      workExperience: [...data.workExperience, { title: '', duration: '', summary: [], projects: [{ name: '', description: '', role: '', points: [''] }] }]
    });
  };

  const removeWorkExperience = (idx: number) => {
    onChange({ ...data, workExperience: data.workExperience.filter((_, i) => i !== idx) });
  };

  const addProject = (workIdx: number) => {
    const newWork = [...data.workExperience];
    newWork[workIdx].projects.push({ name: '', description: '', role: '', points: [''] });
    onChange({ ...data, workExperience: newWork });
  };

  const removeProject = (workIdx: number, projectIdx: number) => {
    const newWork = [...data.workExperience];
    newWork[workIdx].projects = newWork[workIdx].projects.filter((_, i) => i !== projectIdx);
    onChange({ ...data, workExperience: newWork });
  };

  const updateProjectPoint = (workIdx: number, projectIdx: number, pointIdx: number, value: string) => {
    const newWork = [...data.workExperience];
    newWork[workIdx].projects[projectIdx].points[pointIdx] = value;
    onChange({ ...data, workExperience: newWork });
  };

  const addProjectPoint = (workIdx: number, projectIdx: number) => {
    const newWork = [...data.workExperience];
    newWork[workIdx].projects[projectIdx].points.push('');
    onChange({ ...data, workExperience: newWork });
  };

  const removeProjectPoint = (workIdx: number, projectIdx: number, pointIdx: number) => {
    const newWork = [...data.workExperience];
    newWork[workIdx].projects[projectIdx].points = newWork[workIdx].projects[projectIdx].points.filter((_, i) => i !== pointIdx);
    onChange({ ...data, workExperience: newWork });
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onChange({ ...data, avatar: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeAvatar = () => {
    onChange({ ...data, avatar: '' });
  };

  const tabs = [
    { id: 'contact', label: '基本信息' },
    { id: 'education', label: '教育背景' },
    { id: 'skills', label: '专业技能' },
    { id: 'work', label: '工作经历' },
    { id: 'social', label: 'Side Project' },
    { id: 'evaluation', label: '自我评价' },
    { id: 'portfolio', label: '项目作品' },
  ];

  const renderEditableTitle = (section: string, defaultTitle: string) => {
    const title = getSectionTitle(section, defaultTitle);
    const isEditing = editingTitle === section;

    const handleStartEdit = () => {
      setInitialTitleValue(title);
      setEditingTitleValue(title);
      setEditingTitle(section);
    };

    const handleFinishEdit = () => {
      const trimmedValue = editingTitleValue.trim();
      const nextTitle = trimmedValue === '' ? (initialTitleValue ?? title) : editingTitleValue;
      updateSectionTitle(section, nextTitle);
      setEditingTitle(null);
      setEditingTitleValue('');
      setInitialTitleValue(null);
    };

    const handleCancelEdit = () => {
      updateSectionTitle(section, initialTitleValue ?? title);
      setEditingTitle(null);
      setEditingTitleValue('');
      setInitialTitleValue(null);
    };

    if (isEditing) {
      return (
        <input
          autoFocus
          type="text"
          value={editingTitleValue}
          onChange={(e) => setEditingTitleValue(e.target.value)}
          onBlur={handleFinishEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleFinishEdit();
            if (e.key === 'Escape') {
              handleCancelEdit();
            }
          }}
          className="text-sm font-bold text-slate-900 border-l-4 border-resume-blue pl-3 py-1 bg-blue-50 outline-none focus:bg-blue-100 transition-all"
        />
      );
    }

    return (
      <h3
        className="text-sm font-bold text-slate-900 border-l-4 border-resume-blue pl-3 cursor-pointer hover:bg-slate-50 transition-all py-1"
        onDoubleClick={handleStartEdit}
        title="双击编辑标题"
      >
        {title}
      </h3>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex border-b border-slate-200 bg-slate-50/50 overflow-x-auto no-scrollbar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-4 text-xs font-bold whitespace-nowrap transition-all border-b-2",
              activeTab === tab.id
                ? "border-resume-blue text-resume-blue bg-white"
                : "border-transparent text-slate-400 hover:text-slate-600 hover:bg-white"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {activeTab === 'contact' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
            {renderEditableTitle('contact', '基本信息')}

            {/* Avatar Upload */}
            <div className="flex flex-col items-center gap-4 p-6 bg-slate-50 border border-slate-200 rounded-xl">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider w-full">一寸照片 (推荐 25mm x 35mm 比例)</label>
              <div className="relative group/avatar">
                {data.avatar ? (
                  <div className="w-[85px] h-[120px] bg-white border border-slate-200 overflow-hidden shadow-sm">
                    <img src={data.avatar} alt="Avatar" className="w-full h-full object-cover" />
                    <button
                      onClick={removeAvatar}
                      className="absolute -right-2 -top-2 p-1.5 bg-red-500 text-white rounded-full shadow-lg opacity-0 group-hover/avatar:opacity-100 transition-all active:scale-95"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="w-[85px] h-[120px] bg-white border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:border-resume-blue hover:text-resume-blue transition-all cursor-pointer">
                    <Plus size={24} className="mb-2" />
                    <span className="text-[10px] font-bold">上传照片</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                )}
              </div>
              <p className="text-[10px] text-slate-400 text-center">支持 JPG, PNG 格式<br/>建议比例 1:1.4 左右</p>
            </div>

            <div className="space-y-4">
              <InputField label="姓名" value={data.name} onChange={(e: any) => onChange({ ...data, name: e.target.value })} />
              <InputField label="求职意向" value={data.title} onChange={(e: any) => onChange({ ...data, title: e.target.value })} />
              <InputField label="手机号码" value={data.contact.tel} onChange={(e: any) => updateContact('tel', e.target.value)} />
              <InputField label="电子邮箱" value={data.contact.email} onChange={(e: any) => updateContact('email', e.target.value)} />
              <InputField label="个人网站 / Blog" value={data.contact.blog} onChange={(e: any) => updateContact('blog', e.target.value)} />
            </div>
          </div>
        )}

        {activeTab === 'education' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
            <div className="flex justify-between items-center">
              {renderEditableTitle('education', '教育背景')}
              <button onClick={addEducation} className="text-resume-blue flex items-center gap-1 text-[11px] font-bold hover:opacity-80 transition-all">
                <Plus size={16} /> 添加项
              </button>
            </div>
            {data.education.map((edu, idx) => (
              <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4 relative group">
                <button onClick={() => removeEducation(idx)} className="opacity-0 group-hover:opacity-100 absolute -right-2 -top-2 p-1 bg-white text-red-500 border border-red-100 rounded-full hover:bg-red-50 shadow-sm transition-all">
                  <Trash2 size={14} />
                </button>
                <div className="grid grid-cols-1 gap-3">
                  <InputField label="时间" value={edu.duration} onChange={(e: any) => updateEducation(idx, 'duration', e.target.value)} />
                  <InputField label="学校名称" value={edu.school} onChange={(e: any) => updateEducation(idx, 'school', e.target.value)} />
                  <div className="grid grid-cols-2 gap-3">
                    <InputField label="学院" value={edu.college} onChange={(e: any) => updateEducation(idx, 'college', e.target.value)} />
                    <InputField label="专业" value={edu.major} onChange={(e: any) => updateEducation(idx, 'major', e.target.value)} />
                  </div>
                  <InputField label="学位" value={edu.degree} onChange={(e: any) => updateEducation(idx, 'degree', e.target.value)} />
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'skills' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
            <div className="flex justify-between items-center">
              {renderEditableTitle('skills', '专业技能')}
              <button onClick={addSkill} className="text-resume-blue flex items-center gap-1 text-[11px] font-bold hover:opacity-80 transition-all">
                <Plus size={16} /> 添加项
              </button>
            </div>
            <div className="space-y-3">
              {data.skills.map((skill, idx) => (
                <div key={idx} className="relative group">
                  <textarea
                    rows={3}
                    value={skill}
                    onChange={e => updateSkills(idx, e.target.value)}
                    className="w-full p-3 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-resume-blue transition-all resize-none shadow-sm"
                  />
                  <button onClick={() => removeSkill(idx)} className="opacity-0 group-hover:opacity-100 absolute -right-2 -top-2 p-1 bg-white text-red-500 border border-red-100 rounded-full shadow-sm transition-all">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'work' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
             <div className="flex justify-between items-center">
              {renderEditableTitle('work', '工作经历')}
              <button onClick={addWorkExperience} className="text-resume-blue flex items-center gap-1 text-[11px] font-bold hover:opacity-80 transition-all">
                <Plus size={16} /> 添加项
              </button>
            </div>
            {data.workExperience.map((work, wIdx) => (
              <div key={wIdx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4 relative group">
                <button onClick={() => removeWorkExperience(wIdx)} className="opacity-0 group-hover:opacity-100 absolute -right-2 -top-2 p-1 bg-white text-red-500 border border-red-100 rounded-full shadow-sm transition-all">
                  <Trash2 size={14} />
                </button>
                <div className="space-y-3">
                  <InputField label="经历标题 / 项目 / 公司" value={work.title} onChange={(e: any) => updateWorkExperience(wIdx, 'title', e.target.value)} />
                  <InputField label="时长 / 标签 (如: 阿里 2年)" value={work.duration} onChange={(e: any) => updateWorkExperience(wIdx, 'duration', e.target.value)} />
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">工作摘要</label>
                    <button
                      onClick={() => updateWorkExperience(wIdx, 'summary', [...(work.summary ?? []), ''])}
                      className="text-[11px] font-bold text-resume-blue hover:opacity-80 transition-all flex items-center gap-1"
                    >
                      <Plus size={14} /> 添加摘要
                    </button>
                  </div>
                  {(work.summary ?? []).map((item, summaryIdx) => (
                    <div key={summaryIdx} className="relative group/summary">
                      <textarea
                        rows={2}
                        value={item}
                        onChange={(e) => {
                          const nextSummary = [...(work.summary ?? [])];
                          nextSummary[summaryIdx] = e.target.value;
                          updateWorkExperience(wIdx, 'summary', nextSummary);
                        }}
                        className="w-full p-2 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:border-resume-blue transition-all resize-none shadow-sm"
                      />
                      <button
                        onClick={() => {
                          const nextSummary = (work.summary ?? []).filter((_, index) => index !== summaryIdx);
                          updateWorkExperience(wIdx, 'summary', nextSummary);
                        }}
                        className="opacity-0 group-hover/summary:opacity-100 absolute -right-2 -top-2 p-1 bg-white text-red-400 border border-red-100 rounded-full shadow-sm transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>

                {work.projects.map((proj, pIdx) => (
                  <div key={pIdx} className="space-y-4 pt-4 border-t border-slate-200 relative group/proj">
                    <button
                      onClick={() => removeProject(wIdx, pIdx)}
                      className="opacity-0 group-hover/proj:opacity-100 absolute -right-2 top-2 p-1 bg-white text-red-500 border border-red-100 rounded-lg shadow-sm transition-all z-10"
                    >
                      <Trash2 size={12} />
                    </button>
                    <InputField label="详细标题 (可选)" value={proj.name} onChange={(e: any) => {
                       const newProjects = [...work.projects];
                       newProjects[pIdx].name = e.target.value;
                       updateWorkExperience(wIdx, 'projects', newProjects);
                    }} />
                    <InputField label="角色 (可选)" value={proj.role || ''} onChange={(e: any) => {
                       const newProjects = [...work.projects];
                       newProjects[pIdx].role = e.target.value;
                       updateWorkExperience(wIdx, 'projects', newProjects);
                    }} />
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">项目背景 / 展示文案</label>
                      <textarea
                        rows={3}
                        value={proj.description || ''}
                        onChange={(e) => {
                          const newProjects = [...work.projects];
                          newProjects[pIdx] = { ...newProjects[pIdx], description: e.target.value };
                          updateWorkExperience(wIdx, 'projects', newProjects);
                        }}
                        className="w-full p-2 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:border-resume-blue transition-all resize-none shadow-sm"
                      />
                    </div>
                    <div className="space-y-3">
                      {proj.points.map((pt, ptIdx) => (
                        <div key={ptIdx} className="relative group/pt">
                          <textarea
                            rows={2}
                            value={pt}
                            onChange={e => updateProjectPoint(wIdx, pIdx, ptIdx, e.target.value)}
                            className="w-full p-2 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:border-resume-blue transition-all resize-none shadow-sm"
                          />
                          <button onClick={() => removeProjectPoint(wIdx, pIdx, ptIdx)} className="opacity-0 group-hover/pt:opacity-100 absolute -right-2 -top-2 p-1 bg-white text-red-400 border border-red-100 rounded-full shadow-sm transition-all">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                      <button onClick={() => addProjectPoint(wIdx, pIdx)} className="text-[11px] font-bold text-resume-blue hover:opacity-80 transition-all flex items-center gap-1">
                        <Plus size={14} /> 添加描述点
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => addProject(wIdx)}
                  className="w-full py-2 border-2 border-dashed border-slate-200 rounded-lg text-[11px] font-bold text-slate-400 hover:border-resume-blue hover:text-resume-blue transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={16} /> 添加项目
                </button>
              </div>
            ))}
          </div>
        )}

        {(activeTab === 'social' || activeTab === 'evaluation') && (
          <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
             <div className="flex justify-between items-center">
                {renderEditableTitle(
                  activeTab === 'social' ? 'social' : 'evaluation',
                  activeTab === 'social' ? 'Side Project' : '自我评价'
                )}
                <button
                    onClick={() => {
                        const emptySideProject: SideProject = { name: '', url: '', description: '' };
                        const list = [
                          ...(activeTab === 'social' ? data.socialProjects : data.selfEvaluation),
                          activeTab === 'social' ? emptySideProject : ''
                        ];
                        onChange({ ...data, [activeTab === 'social' ? 'socialProjects' : 'selfEvaluation']: list });
                    }}
                    className="text-resume-blue flex items-center gap-1 text-[11px] font-bold hover:opacity-80 transition-all"
                >
                    <Plus size={16} /> 添加项
                </button>
             </div>
             <div className="space-y-4">
                {activeTab === 'social' && data.socialProjects.map((item, idx) => {
                  const project = isSideProject(item) ? item : { name: '', url: '', description: item };
                  const updateProject = (patch: Partial<SideProject>) => {
                    const list = [...data.socialProjects];
                    list[idx] = { ...project, ...patch };
                    onChange({ ...data, socialProjects: list });
                  };

                  return (
                    <div key={idx} className="relative group p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                      <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                        <InputField label="项目名称" value={project.name} onChange={(e) => updateProject({ name: e.target.value })} />
                        {project.url && (
                          <a
                            href={project.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-[38px] w-[38px] rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-resume-blue hover:border-resume-blue transition-all flex items-center justify-center"
                            title="打开项目"
                          >
                            <ExternalLink size={16} />
                          </a>
                        )}
                      </div>
                      <InputField label="项目链接" value={project.url} onChange={(e) => updateProject({ url: e.target.value })} />
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">项目介绍</label>
                        <textarea
                          rows={3}
                          value={project.description}
                          onChange={(e) => updateProject({ description: e.target.value })}
                          className="w-full p-3 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-resume-blue transition-all resize-none shadow-sm"
                        />
                      </div>
                      <button onClick={() => {
                          const list = data.socialProjects.filter((_, i) => i !== idx);
                          onChange({ ...data, socialProjects: list });
                        }} className="opacity-0 group-hover:opacity-100 absolute -right-2 -top-2 p-1 bg-white text-red-500 border border-red-100 rounded-full shadow-sm transition-all">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}

                {activeTab === 'evaluation' && data.selfEvaluation.map((item, idx) => (
                  <div key={idx} className="relative group">
                    <textarea
                      rows={3}
                      value={item}
                      onChange={e => {
                        const list = [...data.selfEvaluation];
                        list[idx] = e.target.value;
                        onChange({ ...data, selfEvaluation: list });
                      }}
                      className="w-full p-3 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-resume-blue transition-all resize-none shadow-sm"
                    />
                    <button onClick={() => {
                        const list = data.selfEvaluation.filter((_, i) => i !== idx);
                        onChange({ ...data, selfEvaluation: list });
                      }} className="opacity-0 group-hover:opacity-100 absolute -right-2 -top-2 p-1 bg-white text-red-500 border border-red-100 rounded-full shadow-sm transition-all">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
             </div>
          </div>
        )}

        {activeTab === 'portfolio' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
            {renderEditableTitle('portfolio', '项目作品')}

            <div className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700 font-medium">
                  💡 提示：每张图片可单独设置占据的列数（1-4列）。当一行放不下时会自动换行。
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    图片间距: {data.portfolio?.gap ?? 15}px
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    step="5"
                    value={data.portfolio?.gap ?? 15}
                    onChange={(e) => onChange({
                      ...data,
                      portfolio: {
                        ...data.portfolio,
                        items: data.portfolio?.items || [],
                        gap: parseInt(e.target.value)
                      }
                    })}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-resume-blue"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    图片高度: {data.portfolio?.imageHeight ?? 180}px
                  </label>
                  <input
                    type="range"
                    min="100"
                    max="300"
                    step="10"
                    value={data.portfolio?.imageHeight ?? 180}
                    onChange={(e) => onChange({
                      ...data,
                      portfolio: {
                        ...data.portfolio,
                        items: data.portfolio?.items || [],
                        imageHeight: parseInt(e.target.value),
                        useOriginalSize: false
                      }
                    })}
                    disabled={data.portfolio?.useOriginalSize}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-resume-blue disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <input
                  type="checkbox"
                  id="useOriginalSize"
                  checked={data.portfolio?.useOriginalSize ?? false}
                  onChange={(e) => onChange({
                    ...data,
                    portfolio: {
                      ...data.portfolio,
                      items: data.portfolio?.items || [],
                      useOriginalSize: e.target.checked
                    }
                  })}
                  className="w-4 h-4 text-resume-blue bg-white border-slate-300 rounded focus:ring-resume-blue focus:ring-2"
                />
                <label htmlFor="useOriginalSize" className="text-xs font-medium text-slate-700 cursor-pointer">
                  使用图片原始尺寸（保持宽高比）
                </label>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">作品图片</label>
                  <button
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.multiple = true;
                      input.onchange = (e: any) => {
                        const files = Array.from(e.target?.files || []) as File[];
                        if (files.length > 0) {
                          const imagePromises = files.map(file => {
                            return new Promise<{ url: string; width: number; height: number }>((resolve) => {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                const img = new Image();
                                img.onload = () => {
                                  resolve({
                                    url: reader.result as string,
                                    width: img.width,
                                    height: img.height
                                  });
                                };
                                img.src = reader.result as string;
                              };
                              reader.readAsDataURL(file);
                            });
                          });

                          Promise.all(imagePromises).then(results => {
                            onChange({
                              ...data,
                              portfolio: {
                                ...data.portfolio,
                                items: [...(data.portfolio?.items || []), ...results.map(r => ({ ...r, cols: 2 }))]
                              }
                            });
                          });
                        }
                      };
                      input.click();
                    }}
                    className="text-resume-blue flex items-center gap-1 text-[11px] font-bold hover:opacity-80 transition-all"
                  >
                    <Plus size={16} /> 添加图片
                  </button>
                </div>

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.classList.add('border-resume-blue', 'bg-blue-50');
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.classList.remove('border-resume-blue', 'bg-blue-50');
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.classList.remove('border-resume-blue', 'bg-blue-50');

                    const files = (Array.from(e.dataTransfer.files) as File[]).filter(file =>
                      file.type.startsWith('image/')
                    );

                    if (files.length > 0) {
                      const imagePromises = files.map(file => {
                        return new Promise<{ url: string; width: number; height: number }>((resolve) => {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            const img = new Image();
                            img.onload = () => {
                              resolve({
                                url: reader.result as string,
                                width: img.width,
                                height: img.height
                              });
                            };
                            img.src = reader.result as string;
                          };
                          reader.readAsDataURL(file);
                        });
                      });

                      Promise.all(imagePromises).then(results => {
                        onChange({
                          ...data,
                          portfolio: {
                            ...data.portfolio,
                            items: [...(data.portfolio?.items || []), ...results.map(r => ({ ...r, cols: 2 }))]
                          }
                        });
                      });
                    }
                  }}
                  className="min-h-[200px] p-4 border-2 border-dashed border-slate-200 rounded-lg transition-all"
                >
                  {(!data.portfolio?.items || data.portfolio.items.length === 0) ? (
                    <div className="h-full flex flex-col items-center justify-center py-12 text-center text-slate-400 text-sm">
                      <Plus size={32} className="mb-3 opacity-50" />
                      <p className="font-bold">拖拽图片到此处上传</p>
                      <p className="text-xs mt-1">或点击上方按钮选择文件</p>
                      <p className="text-xs mt-2 text-slate-300">支持多选上传</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {data.portfolio.items.map((item, idx) => {
                        const imgUrl = typeof item === 'string' ? item : item.url;
                        const cols = typeof item === 'object' ? (item.cols ?? 2) : 2;
                        return (
                          <div key={idx} className="relative group bg-slate-50 rounded-lg border border-slate-200 p-3">
                            <div className="flex gap-3">
                              <div className="flex-shrink-0 w-32 h-24 bg-slate-100 rounded overflow-hidden border border-slate-200">
                                <img src={imgUrl} alt={`作品 ${idx + 1}`} className="w-full h-full object-cover" />
                              </div>
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-slate-700">作品 {idx + 1}</span>
                                  <button
                                    onClick={() => {
                                      onChange({
                                        ...data,
                                        portfolio: {
                                          ...data.portfolio,
                                          items: (data.portfolio?.items || []).filter((_, i) => i !== idx)
                                        }
                                      });
                                    }}
                                    className="p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                                {typeof item === 'object' && item.width && item.height && (
                                  <p className="text-[10px] text-slate-400">
                                    尺寸: {item.width} × {item.height}
                                  </p>
                                )}
                                <div className="flex items-center gap-2">
                                  <label className="text-xs font-medium text-slate-600">占据列数:</label>
                                  <input
                                    type="number"
                                    min="1"
                                    max="4"
                                    value={cols}
                                    onChange={(e) => {
                                      const newCols = Math.max(1, Math.min(4, parseInt(e.target.value) || 1));
                                      const newItems = [...(data.portfolio?.items || [])];
                                      if (typeof newItems[idx] === 'object') {
                                        newItems[idx] = { ...newItems[idx], cols: newCols };
                                      }
                                      onChange({
                                        ...data,
                                        portfolio: {
                                          ...data.portfolio,
                                          items: newItems
                                        }
                                      });
                                    }}
                                    className="w-16 px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:border-resume-blue"
                                  />
                                  <span className="text-[10px] text-slate-400">(1-4列)</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

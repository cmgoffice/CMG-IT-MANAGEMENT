import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { ROOT_COLLECTION, ROOT_DOCUMENT } from '../lib/db';
import { useAuth } from '../contexts/AuthContext';

type Project = {
  id: string;
  name: string;
  description: string;
  status: 'Planning' | 'In Progress' | 'Completed' | 'On Hold';
  startDate: string;
  endDate: string;
  team: string[];
  category: string;
  priority: 'Low' | 'Medium' | 'High';
  progress: number;
  images: string[]; // Array of base64 image strings
  pdfReports: { name: string; data: string }[]; // Array of PDF files
  createdAt: string;
};

const statusStyles = {
  'Planning': 'bg-blue-50 text-blue-700 border-blue-200/60',
  'In Progress': 'bg-amber-50 text-amber-700 border-amber-200/60',
  'Completed': 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
  'On Hold': 'bg-slate-100 text-slate-700 border-slate-200/60',
};

const priorityStyles = {
  'Low': 'bg-slate-50 text-slate-600 border-slate-200/60',
  'Medium': 'bg-orange-50 text-orange-700 border-orange-200/60',
  'High': 'bg-rose-50 text-rose-700 border-rose-200/60',
};


const Projects = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'Planning' as Project['status'],
    startDate: '',
    endDate: '',
    team: '',
    category: '',
    priority: 'Medium' as Project['priority'],
    progress: 0,
    images: [] as string[],
    pdfReports: [] as { name: string; data: string }[],
  });
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, ROOT_COLLECTION, ROOT_DOCUMENT, 'projects'));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Project));
      setProjects(data.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      }));
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const filtered = projects.filter((p) => {
    const matchSearch = search.trim() === '' || 
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setIsUploadingFiles(true);
    for (const file of Array.from(files)) {
      try {
        const storageRef = ref(storage, `projects/images/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        setFormData((prev) => ({
          ...prev,
          images: [...prev.images, url],
        }));
      } catch (error) {
        console.error("Error uploading image:", error);
        alert(`Failed to upload image: ${file.name}`);
      }
    }
    setIsUploadingFiles(false);
  };

  const handlePDFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setIsUploadingFiles(true);
    for (const file of Array.from(files)) {
      try {
        const storageRef = ref(storage, `projects/pdfs/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        setFormData((prev) => ({
          ...prev,
          pdfReports: [...prev.pdfReports, { name: file.name, data: url }],
        }));
      } catch (error) {
        console.error("Error uploading PDF:", error);
        alert(`Failed to upload PDF: ${file.name}`);
      }
    }
    setIsUploadingFiles(false);
  };

  const removeImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const removePDF = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      pdfReports: prev.pdfReports.filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return;

    setIsSaving(true);
    try {
    const projectId = selectedProject?.id || `PRJ-${Date.now()}`;
    const rawPayload = {
      name: (formData.name || '').trim(),
      description: (formData.description || '').trim(),
      status: formData.status || 'Planning',
      startDate: formData.startDate || '',
      endDate: formData.endDate || '',
      team: (formData.team || '').split(',').map(t => t.trim()).filter(Boolean),
      category: (formData.category || '').trim(),
      priority: formData.priority || 'Medium',
      progress: Number(formData.progress) || 0,
      images: Array.isArray(formData.images) ? formData.images : [],
      pdfReports: Array.isArray(formData.pdfReports) ? formData.pdfReports : [],
      createdAt: selectedProject?.createdAt || new Date().toISOString(),
    };

    // แปลงข้อมูลเพื่อลบค่า undefined แฝงทั้งหมดที่ทำให้ Firestore บันทึกไม่ได้
    const payload = JSON.parse(JSON.stringify(rawPayload));

    await setDoc(doc(db, ROOT_COLLECTION, ROOT_DOCUMENT, 'projects', projectId), payload);
    
    // Update local state immediately for fast feedback
    setProjects(prev => {
      if (selectedProject) {
        return prev.map(p => p.id === projectId ? { id: projectId, ...payload } : p);
      }
      return [{ id: projectId, ...payload }, ...prev].sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
    });

    setShowAddModal(false);
    setSelectedProject(null);
    setFormData({
      name: '',
      description: '',
      status: 'Planning',
      startDate: '',
      endDate: '',
      team: '',
      category: '',
      priority: 'Medium',
      progress: 0,
      images: [],
      pdfReports: [],
    });
    } catch (error: any) {
      console.error('Error saving project:', error);
      alert('Failed to save project: ' + (error.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedProject) return;
    await deleteDoc(doc(db, ROOT_COLLECTION, ROOT_DOCUMENT, 'projects', selectedProject.id));
    setShowDeleteModal(false);
    setSelectedProject(null);
    await loadProjects();
  };

  const openAddModal = () => {
    setSelectedProject(null);
    setFormData({
      name: '',
      description: '',
      status: 'Planning',
      startDate: '',
      endDate: '',
      team: '',
      category: '',
      priority: 'Medium',
      progress: 0,
      images: [],
      pdfReports: [],
    });
    setShowAddModal(true);
  };

  const openEditModal = (project: Project) => {
    setSelectedProject(project);
    setFormData({
      name: project.name,
      description: project.description,
      status: project.status,
      startDate: project.startDate,
      endDate: project.endDate,
      team: project.team.join(', '),
      category: project.category,
      priority: project.priority,
      progress: project.progress,
      images: project.images || [],
      pdfReports: project.pdfReports || [],
    });
    setShowAddModal(true);
  };

  return (
    <div className="pt-8 pb-12 px-6 md:px-8 min-h-screen relative z-10">
      <div className="max-w-[1400px] mx-auto">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 md:mb-12">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 mb-3 font-display">Projects</h1>
            <p className="text-slate-500 text-base max-w-2xl font-body leading-relaxed">
              Track and manage IT projects with detailed progress monitoring and team collaboration.
            </p>
          </div>
          <div className="flex gap-3 items-center">
            <div className="relative group">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#747c80] group-focus-within:text-[#27619d] transition-colors text-[20px]">
                search
              </span>
              <input
                className="pl-11 pr-4 py-3 bg-white/80 backdrop-blur-md border border-slate-200 rounded-xl focus:ring-4 focus:ring-[#27619d]/10 focus:border-[#27619d]/30 focus:bg-white transition-all text-[15px] w-full md:w-72 shadow-sm font-body outline-none text-slate-800 placeholder:text-slate-400"
                placeholder="Search projects..."
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {userProfile && (
              <button
                onClick={openAddModal}
                className="flex items-center justify-center gap-2 bg-[#27619d] text-white px-6 py-3 rounded-xl font-bold text-[15px] shadow-lg shadow-[#27619d]/20 hover:bg-[#1e4d7a] transition-all hover:-translate-y-0.5 active:translate-y-0 font-body shrink-0"
              >
                <span className="material-symbols-outlined text-[20px]">add</span>
                New Project
              </button>
            )}
          </div>
        </header>

        <section className="flex flex-wrap gap-3 mb-10">
          <div className="flex items-center gap-2 bg-white/80 backdrop-blur-md px-5 py-3 rounded-xl text-[15px] font-medium text-slate-600 border border-slate-200 shadow-sm transition-all hover:bg-white">
            <span className="material-symbols-outlined text-[20px] text-slate-400">filter_list</span>
            Status:
            <select
              className="bg-transparent border-none p-0 text-[#27619d] font-bold focus:ring-0 cursor-pointer outline-none text-[15px] ml-1"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option>All</option>
              <option>Planning</option>
              <option>In Progress</option>
              <option>Completed</option>
              <option>On Hold</option>
            </select>
          </div>
        </section>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#27619d] mb-4"></div>
              <p className="text-[#596064] font-body">Loading projects...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.length === 0 && (
              <div className="col-span-full text-center py-20 bg-white/40 rounded-3xl border border-dashed border-slate-300">
                <span className="material-symbols-outlined text-5xl text-slate-300 mb-3">search_off</span>
                <p className="text-slate-500 font-bold font-body text-lg">No projects found.</p>
              </div>
            )}
            {filtered.map((project) => (
            <div
              key={project.id}
              className="bg-white border border-slate-200 rounded-[24px] overflow-hidden shadow-sm hover:shadow-xl hover:border-slate-300 hover:-translate-y-1 transition-all duration-300 cursor-pointer group flex flex-col"
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              {/* Cover Image */}
              {project.images && project.images.length > 0 ? (
                <div className="w-full aspect-[16/7] overflow-hidden relative shrink-0 bg-slate-100 border-b border-slate-100">
                  <img src={project.images[0]} alt={project.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300"></div>
                </div>
              ) : (
                <div className="w-full aspect-[16/7] bg-slate-50 relative overflow-hidden flex items-center justify-center shrink-0 group-hover:bg-slate-100 transition-colors border-b border-slate-100">
                  <span className="material-symbols-outlined text-4xl text-slate-300">imagesmode</span>
                </div>
              )}

              <div className="p-4 md:p-5 flex flex-col flex-1">
                {/* Title + Actions */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="text-[1rem] font-extrabold text-slate-800 mb-1 font-display leading-tight">{project.name}</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-body">{project.id}</p>
                  </div>
                  {userProfile && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity -mt-1 -mr-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(project);
                        }}
                        className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProject(project);
                          setShowDeleteModal(true);
                        }}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Description */}
                <p className="text-[12px] text-slate-500 mb-3 line-clamp-2 font-body flex-1 leading-relaxed">{project.description}</p>

                {/* Badges */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <span className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest ${statusStyles[project.status] || 'bg-slate-100 text-slate-600'}`}>
                    {project.status}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest ${priorityStyles[project.priority] || 'bg-slate-100 text-slate-600'}`}>
                    {project.priority} Priority
                  </span>
                  {project.category && (
                    <span className="px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border border-slate-200 bg-white text-slate-600">
                      {project.category}
                    </span>
                  )}
                </div>

                {/* Progress */}
                <div className="mb-3">
                  <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 font-body">
                    <span>Progress</span>
                    <span className="text-[#27619d]">{project.progress || 0}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                    <div
                      className="bg-[#27619d] h-1 rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${project.progress || 0}%` }}
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 font-body pt-3 border-t border-slate-100 mt-1">
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">group</span>
                    <span>{project.team?.length || 0} members</span>
                  </div>
                  {project.endDate && (
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">event</span>
                      <span>{new Date(project.endDate).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4 sm:p-6" style={{ zIndex: 99999 }}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => !isSaving && setShowAddModal(false)} />
          <div className="relative bg-white/95 backdrop-blur-xl border border-slate-100 rounded-[24px] shadow-2xl w-full max-w-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto animate-[fadeIn_0.2s_ease-out]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-extrabold text-slate-800 font-display tracking-tight">
                {selectedProject ? 'Edit Project' : 'New Project'}
              </h2>
              <button onClick={() => !isSaving && setShowAddModal(false)} disabled={isSaving} className="p-2 rounded-full hover:bg-slate-100 transition-colors disabled:opacity-50">
                <span className="material-symbols-outlined text-slate-500">close</span>
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-[13px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Project Name <span className="text-red-500 ml-0.5">*</span></label>
                <input
                  type="text"
                  placeholder="e.g. Network Infrastructure Upgrade"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 focus:bg-white rounded-xl border border-slate-200 focus:border-[#27619d] focus:ring-2 focus:ring-[#27619d]/20 transition-all text-sm outline-none text-slate-800 font-medium placeholder:text-slate-400"
                />
              </div>

              <div>
                <label className="text-[13px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Description</label>
                <textarea
                  placeholder="Project description..."

                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 focus:bg-white rounded-xl border border-slate-200 focus:border-[#27619d] focus:ring-2 focus:ring-[#27619d]/20 transition-all text-sm outline-none text-slate-800 resize-none font-medium placeholder:text-slate-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="text-[13px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as Project['status'] })}
                    className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 focus:bg-white rounded-xl border border-slate-200 focus:border-[#27619d] focus:ring-2 focus:ring-[#27619d]/20 transition-all text-sm outline-none text-slate-800 font-medium cursor-pointer"
                  >
                    <option>Planning</option>
                    <option>In Progress</option>
                    <option>Completed</option>
                    <option>On Hold</option>
                  </select>
                </div>

                <div>
                  <label className="text-[13px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as Project['priority'] })}
                    className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 focus:bg-white rounded-xl border border-slate-200 focus:border-[#27619d] focus:ring-2 focus:ring-[#27619d]/20 transition-all text-sm outline-none text-slate-800 font-medium cursor-pointer"
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="text-[13px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Start Date</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 focus:bg-white rounded-xl border border-slate-200 focus:border-[#27619d] focus:ring-2 focus:ring-[#27619d]/20 transition-all text-sm outline-none text-slate-800 font-medium"
                  />
                </div>

                <div>
                  <label className="text-[13px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">End Date</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 focus:bg-white rounded-xl border border-slate-200 focus:border-[#27619d] focus:ring-2 focus:ring-[#27619d]/20 transition-all text-sm outline-none text-slate-800 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="text-[13px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Category</label>
                <input
                  type="text"
                  placeholder="e.g. Infrastructure, Software, Security"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 focus:bg-white rounded-xl border border-slate-200 focus:border-[#27619d] focus:ring-2 focus:ring-[#27619d]/20 transition-all text-sm outline-none text-slate-800 font-medium placeholder:text-slate-400"
                />
              </div>

              <div>
                <label className="text-[13px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Team Members <span className="normal-case tracking-normal font-medium text-slate-400">(comma separated)</span></label>
                <input
                  type="text"
                  placeholder="e.g. John Doe, Jane Smith, Bob Wilson"
                  value={formData.team}
                  onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 focus:bg-white rounded-xl border border-slate-200 focus:border-[#27619d] focus:ring-2 focus:ring-[#27619d]/20 transition-all text-sm outline-none text-slate-800 font-medium placeholder:text-slate-400"
                />
              </div>

              <div>
                <label className="text-[13px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Progress (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.progress}
                  onChange={(e) => setFormData({ ...formData, progress: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 focus:bg-white rounded-xl border border-slate-200 focus:border-[#27619d] focus:ring-2 focus:ring-[#27619d]/20 transition-all text-sm outline-none text-slate-800 font-medium"
                />
              </div>

              {/* Image Upload */}
              <div>
                <label className="text-[13px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Project Images <span className="normal-case tracking-normal font-medium text-slate-400">(Cover Image)</span></label>
                <label className="flex flex-col items-center justify-center w-full h-24 px-4 transition bg-slate-50 hover:bg-[#27619d]/5 border-2 border-slate-200 border-dashed rounded-xl cursor-pointer hover:border-[#27619d]/50 group">
                  <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    {isUploadingFiles ? (
                      <span className="material-symbols-outlined text-[24px] text-[#27619d] animate-spin">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined text-[24px] text-[#27619d]">add_photo_alternate</span>
                    )}
                  </div>
                  <span className="font-bold text-slate-600 text-sm">{isUploadingFiles ? 'Uploading images...' : 'Click to upload images'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
                {formData.images.length > 0 && (
                  <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-5">
                    {formData.images.map((img, idx) => (
                      <div key={idx} className="relative group">
                        <img src={img} alt={`Preview ${idx + 1}`} className="w-full h-28 object-cover rounded-xl border border-slate-200 shadow-sm" />
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-md"
                        >
                          <span className="material-symbols-outlined text-[14px]">close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* PDF Upload */}
              <div>
                <label className="text-[13px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">PDF Reports</label>
                <label className="flex flex-col items-center justify-center w-full h-24 px-4 transition bg-slate-50 hover:bg-[#27619d]/5 border-2 border-slate-200 border-dashed rounded-xl cursor-pointer hover:border-[#27619d]/50 group">
                  <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    {isUploadingFiles ? (
                      <span className="material-symbols-outlined text-[24px] text-red-500 animate-spin">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined text-[24px] text-red-500">picture_as_pdf</span>
                    )}
                  </div>
                  <span className="font-bold text-slate-600 text-sm">{isUploadingFiles ? 'Uploading PDFs...' : 'Click to upload PDF files'}</span>
                  <input
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={handlePDFUpload}
                    className="hidden"
                  />
                </label>
                {formData.pdfReports.length > 0 && (
                  <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {formData.pdfReports.map((pdf, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white border border-slate-200 shadow-sm px-4 py-3.5 rounded-xl">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-red-600">picture_as_pdf</span>
                          <span className="text-sm font-bold text-slate-700 line-clamp-1">{pdf.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removePDF(idx)}
                          className="text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg p-1.5 transition-colors shrink-0"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-8 pt-6 border-t border-slate-100">
              <button
                onClick={() => !isSaving && setShowAddModal(false)}
                disabled={isSaving}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.name.trim() || isSaving || isUploadingFiles}
                className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                  !formData.name.trim() || isSaving || isUploadingFiles
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-[#27619d] text-white hover:bg-[#1e4d7a] hover:-translate-y-0.5 shadow-lg shadow-[#27619d]/20'
                }`}
              >
                {isSaving && <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>}
                {selectedProject ? 'Save Changes' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Modal */}
      {showDeleteModal && selectedProject && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4 sm:p-6" style={{ zIndex: 99999 }}>
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm transition-opacity" onClick={() => setShowDeleteModal(false)} />
          <div className="relative bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl border border-white">
            <h2 className="text-2xl font-extrabold text-slate-800 mb-3 font-display">Delete Project</h2>
            <p className="text-sm text-slate-500 mb-8 leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-slate-700">{selectedProject.name}</span>? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Projects;

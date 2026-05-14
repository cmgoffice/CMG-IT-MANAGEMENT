import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ROOT_COLLECTION, ROOT_DOCUMENT } from '../lib/db';

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
  'Planning': 'bg-blue-100 text-blue-800',
  'In Progress': 'bg-yellow-100 text-yellow-800',
  'Completed': 'bg-green-100 text-green-800',
  'On Hold': 'bg-gray-100 text-gray-800',
};

const priorityStyles = {
  'Low': 'bg-gray-100 text-gray-700',
  'Medium': 'bg-orange-100 text-orange-700',
  'High': 'bg-red-100 text-red-700',
};

const Projects = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
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

  const loadProjects = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, ROOT_COLLECTION, ROOT_DOCUMENT, 'projects'));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Project));
      setProjects(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setFormData((prev) => ({
          ...prev,
          images: [...prev.images, base64],
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const handlePDFUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setFormData((prev) => ({
          ...prev,
          pdfReports: [...prev.pdfReports, { name: file.name, data: base64 }],
        }));
      };
      reader.readAsDataURL(file);
    });
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

    const projectId = selectedProject?.id || `PRJ-${Date.now()}`;
    const payload: Omit<Project, 'id'> = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      status: formData.status,
      startDate: formData.startDate,
      endDate: formData.endDate,
      team: formData.team.split(',').map(t => t.trim()).filter(Boolean),
      category: formData.category.trim(),
      priority: formData.priority,
      progress: formData.progress,
      images: formData.images,
      pdfReports: formData.pdfReports,
      createdAt: selectedProject?.createdAt || new Date().toISOString(),
    };

    await setDoc(doc(db, ROOT_COLLECTION, ROOT_DOCUMENT, 'projects', projectId), payload);
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
    await loadProjects();
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
    <div className="pt-8 pb-12 px-8 min-h-screen relative z-10">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-[#2c3437] mb-2 font-display">Projects</h1>
            <p className="text-[#596064] max-w-lg font-body">
              Track and manage IT projects with detailed progress monitoring and team collaboration.
            </p>
          </div>
          <div className="flex gap-3 items-center">
            <div className="relative group">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#747c80] group-focus-within:text-[#27619d] transition-colors text-[20px]">
                search
              </span>
              <input
                className="pl-10 pr-4 py-2 bg-white/40 backdrop-blur-md border border-white/40 rounded-lg focus:ring-2 focus:ring-[#27619d]/20 focus:bg-white transition-all text-sm w-56 shadow-sm font-body outline-none"
                placeholder="Search projects..."
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 bg-[#27619d] text-[#f8f8ff] px-4 py-2 rounded-lg font-semibold text-sm shadow-lg shadow-[#27619d]/20 hover:opacity-90 transition-opacity active:scale-[0.98] font-body"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              New Project
            </button>
          </div>
        </header>

        <section className="flex flex-wrap gap-3 mb-8">
          <div className="flex items-center gap-2 bg-white/40 backdrop-blur-md px-4 py-2 rounded-full text-sm font-medium text-[#596064] border border-white/50 shadow-sm">
            <span className="material-symbols-outlined text-lg">filter_list</span>
            Status:
            <select
              className="bg-transparent border-none p-0 text-[#27619d] font-bold focus:ring-0 cursor-pointer outline-none text-sm"
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.length === 0 && (
              <div className="col-span-full text-center py-16 text-[#596064] font-body">
                No projects found.
              </div>
            )}
          {filtered.map((project) => (
            <div
              key={project.id}
              className="bg-white/40 backdrop-blur-md border border-white/40 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all cursor-pointer group"
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-[#2c3437] mb-1 font-display">{project.name}</h3>
                  <p className="text-xs text-[#596064] font-body">{project.id}</p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(project);
                    }}
                    className="p-2 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedProject(project);
                      setShowDeleteModal(true);
                    }}
                    className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              </div>

              <p className="text-sm text-[#596064] mb-4 line-clamp-2 font-body">{project.description}</p>

              <div className="flex flex-wrap gap-2 mb-4">
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusStyles[project.status]}`}>
                  {project.status}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${priorityStyles[project.priority]}`}>
                  {project.priority}
                </span>
                {project.category && (
                  <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
                    {project.category}
                  </span>
                )}
              </div>

              <div className="mb-3">
                <div className="flex justify-between text-xs text-[#596064] mb-1 font-body">
                  <span>Progress</span>
                  <span className="font-bold">{project.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-[#27619d] h-2 rounded-full transition-all"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-[#596064] font-body">
                <div className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">group</span>
                  <span>{project.team.length} members</span>
                </div>
                {project.endDate && (
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">event</span>
                    <span>{new Date(project.endDate).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
          <div className="absolute inset-0 bg-black/20" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                {selectedProject ? 'Edit Project' : 'New Project'}
              </h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 rounded-full hover:bg-gray-100">
                <span className="material-symbols-outlined text-gray-600">close</span>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-800 mb-1.5 block">Project Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Network Infrastructure Upgrade"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white rounded-lg border border-gray-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all text-sm outline-none"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-800 mb-1.5 block">Description</label>
                <textarea
                  placeholder="Project description..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2.5 bg-white rounded-lg border border-gray-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all text-sm outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-800 mb-1.5 block">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as Project['status'] })}
                    className="w-full px-3 py-2.5 bg-white rounded-lg border border-gray-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all text-sm outline-none"
                  >
                    <option>Planning</option>
                    <option>In Progress</option>
                    <option>Completed</option>
                    <option>On Hold</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-800 mb-1.5 block">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as Project['priority'] })}
                    className="w-full px-3 py-2.5 bg-white rounded-lg border border-gray-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all text-sm outline-none"
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-800 mb-1.5 block">Start Date</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2.5 bg-white rounded-lg border border-gray-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-800 mb-1.5 block">End Date</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2.5 bg-white rounded-lg border border-gray-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all text-sm outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-800 mb-1.5 block">Category</label>
                <input
                  type="text"
                  placeholder="e.g. Infrastructure, Software, Security"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white rounded-lg border border-gray-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all text-sm outline-none"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-800 mb-1.5 block">Team Members (comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe, Jane Smith, Bob Wilson"
                  value={formData.team}
                  onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white rounded-lg border border-gray-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all text-sm outline-none"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-800 mb-1.5 block">Progress (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.progress}
                  onChange={(e) => setFormData({ ...formData, progress: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2.5 bg-white rounded-lg border border-gray-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all text-sm outline-none"
                />
              </div>

              {/* Image Upload */}
              <div>
                <label className="text-sm font-semibold text-gray-800 mb-1.5 block">Project Images</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="w-full px-3 py-2.5 bg-white rounded-lg border border-gray-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all text-sm outline-none"
                />
                {formData.images.length > 0 && (
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {formData.images.map((img, idx) => (
                      <div key={idx} className="relative group">
                        <img src={img} alt={`Preview ${idx + 1}`} className="w-full h-20 object-cover rounded-lg" />
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <span className="material-symbols-outlined text-xs">close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* PDF Upload */}
              <div>
                <label className="text-sm font-semibold text-gray-800 mb-1.5 block">PDF Reports</label>
                <input
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={handlePDFUpload}
                  className="w-full px-3 py-2.5 bg-white rounded-lg border border-gray-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all text-sm outline-none"
                />
                {formData.pdfReports.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {formData.pdfReports.map((pdf, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-red-600">picture_as_pdf</span>
                          <span className="text-sm text-gray-700">{pdf.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removePDF(idx)}
                          className="text-red-600 hover:bg-red-100 rounded p-1"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-8 pt-6 border-t border-gray-200">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 rounded-lg border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-3 rounded-lg bg-blue-500 text-white font-semibold text-sm hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20"
              >
                {selectedProject ? 'Save Changes' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Modal */}
      {showDeleteModal && selectedProject && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
          <div className="absolute inset-0 bg-black/20" onClick={() => setShowDeleteModal(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-gray-800 mb-2">Delete Project</h2>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete <span className="font-bold">{selectedProject.name}</span>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2.5 rounded-lg bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
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

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ROOT_COLLECTION, ROOT_DOCUMENT } from '../lib/db';
import { useAuth } from '../contexts/AuthContext';

type Project = {
  id: string;
  name: string;
  description: string;
  status: string;
  startDate: string;
  endDate: string;
  team: string[];
  category: string;
  priority: string;
  progress: number;
  images: string[];
  pdfReports: { name: string; data: string }[];
  createdAt: string;
};

type Evaluation = {
  projectId: string;
  evaluatorEmail: string;
  evaluatorName: string;
  ratings: {
    q1: number;
    q2: number;
    q3: number;
    q4: number;
    q5: number;
  };
  comment: string;
  submittedAt: string;
};

const questions = [
  { id: 'q1', text: 'โปรเจ็คนี้ตอบโจทย์ความต้องการขององค์กรได้ดีเพียงใด' },
  { id: 'q2', text: 'ทีมงานมีการสื่อสารและประสานงานที่ดีเพียงใด' },
  { id: 'q3', text: 'โปรเจ็คเสร็จตามกำหนดเวลาและอยู่ในงบประมาณหรือไม่' },
  { id: 'q4', text: 'คุณภาพของผลลัพธ์โปรเจ็คเป็นอย่างไร' },
  { id: 'q5', text: 'คุณพึงพอใจกับโปรเจ็คนี้โดยรวมเพียงใด' },
];

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [showEvalForm, setShowEvalForm] = useState(false);
  const [hasEvaluated, setHasEvaluated] = useState(false);
  const [ratings, setRatings] = useState({ q1: 0, q2: 0, q3: 0, q4: 0, q5: 0 });
  const [comment, setComment] = useState('');
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    loadProject();
    loadEvaluations();
  }, [id]);

  const loadProject = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const docRef = doc(db, ROOT_COLLECTION, ROOT_DOCUMENT, 'projects', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProject({ id: docSnap.id, ...docSnap.data() } as Project);
      }
    } catch (error) {
      console.error('Error loading project:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEvaluations = async () => {
    if (!id) return;
    const evalsSnap = await getDocs(collection(db, ROOT_COLLECTION, ROOT_DOCUMENT, 'projectEvaluations'));
    const evals = evalsSnap.docs
      .map((d) => d.data() as Evaluation)
      .filter((e) => e.projectId === id);
    setEvaluations(evals);
    
    // Check if current user has evaluated
    if (userProfile?.email) {
      const userEval = evals.find((e) => e.evaluatorEmail === userProfile.email);
      setHasEvaluated(!!userEval);
    }
  };

  const handleSubmitEvaluation = async () => {
    if (!id || !userProfile?.email) return;
    
    // Validate all ratings
    if (Object.values(ratings).some((r) => r === 0)) {
      alert('กรุณาให้คะแนนทุกข้อ');
      return;
    }

    const evaluation: Evaluation = {
      projectId: id,
      evaluatorEmail: userProfile.email,
      evaluatorName: `${userProfile.firstName} ${userProfile.lastName}`,
      ratings,
      comment: comment.trim(),
      submittedAt: new Date().toISOString(),
    };

    const evalId = `${id}_${userProfile.email}`;
    await setDoc(doc(db, ROOT_COLLECTION, ROOT_DOCUMENT, 'projectEvaluations', evalId), evaluation);
    
    setShowEvalForm(false);
    setRatings({ q1: 0, q2: 0, q3: 0, q4: 0, q5: 0 });
    setComment('');
    await loadEvaluations();
  };

  const calculateAverageRating = () => {
    if (evaluations.length === 0) return '0';
    const total = evaluations.reduce((sum, e) => {
      const avg = (e.ratings.q1 + e.ratings.q2 + e.ratings.q3 + e.ratings.q4 + e.ratings.q5) / 5;
      return sum + avg;
    }, 0);
    return (total / evaluations.length).toFixed(1);
  };

  const calculateQuestionAverage = (questionId: keyof Evaluation['ratings']) => {
    if (evaluations.length === 0) return '0';
    const total = evaluations.reduce((sum, e) => sum + e.ratings[questionId], 0);
    return (total / evaluations.length).toFixed(1);
  };

  if (loading) {
    return (
      <div className="pt-8 pb-12 px-8 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#27619d] mb-4"></div>
          <p className="text-[#596064] font-body">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="pt-8 pb-12 px-8 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined text-6xl text-gray-400 mb-4">folder_off</span>
          <p className="text-gray-600">Project not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-8 pb-12 px-8 min-h-screen relative z-10">
      <div className="max-w-[1400px] mx-auto">
        
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center gap-2 text-[#27619d] hover:text-[#1e4d7a] mb-8 font-bold transition-colors bg-white/60 backdrop-blur-md px-5 py-2.5 rounded-full w-max shadow-sm border border-white/60 hover:shadow-md"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to Projects
        </button>

        {/* Pinterest-style 3 Columns Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 w-full">

          {/* 1. Project Details Card (รายละเอียด) */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-[32px] p-8 shadow-sm hover:shadow-md transition-shadow">
            <div className="mb-6">
              <h1 className="text-3xl font-extrabold text-slate-800 mb-2 font-display leading-tight">{project.name}</h1>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-body">{project.id}</p>
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
              <span className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border border-white/50 shadow-sm ${
                  project.status === 'Completed' ? 'bg-green-100 text-green-800' :
                  project.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                  project.status === 'Planning' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {project.status}
                </span>
              <span className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border border-white/50 shadow-sm ${
                  project.priority === 'High' ? 'bg-red-100 text-red-700' :
                  project.priority === 'Medium' ? 'bg-orange-100 text-orange-700' :
                  'bg-slate-100 text-slate-700'
                }`}>
                  {project.priority} Priority
                </span>
            </div>

            <p className="text-[14px] text-slate-600 mb-8 font-body leading-relaxed">{project.description}</p>

            <div className="grid grid-cols-2 gap-5 mb-8 p-5 bg-white/50 rounded-2xl border border-white/60">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Category</p>
                <p className="text-sm font-bold text-slate-700">{project.category || 'N/A'}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Start Date</p>
                <p className="text-sm font-bold text-slate-700">
                  {project.startDate ? new Date(project.startDate).toLocaleDateString() : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">End Date</p>
                <p className="text-sm font-bold text-slate-700">
                  {project.endDate ? new Date(project.endDate).toLocaleDateString() : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Team Size</p>
                <p className="text-sm font-bold text-slate-700">{project.team.length} members</p>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex justify-between text-[12px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                <span>Overall Progress</span>
                <span className="text-[#27619d]">{project.progress}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-[#27619d] to-[#5190d6] h-3 rounded-full transition-all duration-700"
                  style={{ width: `${project.progress}%` }}
                />
              </div>
            </div>

            {project.team.length > 0 && (
              <div className="pt-5 border-t border-slate-200/50">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Project Members</p>
                <div className="flex flex-wrap gap-2">
                  {project.team.map((member, idx) => (
                    <span key={idx} className="px-3.5 py-1.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-xs font-bold">
                      {member}
                    </span>
                  ))}
                </div>
              </div>
            )}
            </div>

            {/* 3. Evaluation Section (แบบประเมิน) */}
            <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-[32px] p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-800 mb-1 font-display">Evaluation</h2>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-body">
                    {evaluations.length} evaluation{evaluations.length !== 1 ? 's' : ''} submitted
                  </p>
                </div>
                {!hasEvaluated && !showEvalForm && (
                  <button
                    onClick={() => setShowEvalForm(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-[#27619d] text-white rounded-xl shadow-lg shadow-[#27619d]/30 hover:-translate-y-1 transition-all font-bold text-sm"
                  >
                    <span className="material-symbols-outlined text-[20px]">edit_note</span>
                    Evaluate Project
                  </button>
                )}
                {hasEvaluated && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
                    <span className="material-symbols-outlined text-[20px]">check_circle</span>
                    <span className="text-sm font-bold">Evaluated</span>
                  </div>
                )}
              </div>

              {evaluations.length > 0 && !showEvalForm && (
                <div>
                  <div className="flex items-center gap-5 mb-6">
                    <div className="text-4xl font-extrabold text-[#27619d]">{calculateAverageRating()}</div>
                    <div>
                      <div className="flex gap-1 mb-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span
                            key={star}
                            className={`material-symbols-outlined text-2xl ${
                              star <= parseFloat(calculateAverageRating())
                                ? 'text-amber-400'
                                : 'text-slate-200'
                            }`}
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            star
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {questions.map((q) => (
                      <div key={q.id} className="flex items-center gap-4">
                        <div className="flex-1">
                          <p className="text-[12px] font-bold text-slate-600 mb-1.5 leading-tight">{q.text}</p>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-amber-400 h-1.5 rounded-full transition-all duration-700"
                                style={{ width: `${(parseFloat(calculateQuestionAverage(q.id as keyof Evaluation['ratings'])) / 5) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-[#27619d] w-6 text-right">
                              {calculateQuestionAverage(q.id as keyof Evaluation['ratings'])}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {evaluations.length === 0 && !showEvalForm && (
                <div className="text-center py-8 bg-slate-50/50 rounded-2xl border border-slate-200 border-dashed">
                  <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">star_border</span>
                  <p className="text-sm font-bold text-slate-500">No evaluations yet</p>
                  <p className="text-[11px] font-medium text-slate-400 mt-1">Be the first to share your thoughts!</p>
                </div>
              )}

              {/* Evaluation Form */}
              {showEvalForm && !hasEvaluated && (
                <div className="animate-[fadeIn_0.2s_ease-out]">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-extrabold text-slate-800 font-display">Submit Evaluation</h3>
                    <button onClick={() => setShowEvalForm(false)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors">
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                  <div className="space-y-5">
                    {questions.map((q, idx) => (
                      <div key={q.id}>
                        <p className="text-[13px] font-bold text-slate-700 mb-2.5">
                          <span className="text-[#27619d] mr-1">{idx + 1}.</span>{q.text}
                        </p>
                        <div className="flex gap-2">
                          {[1, 2, 3, 4, 5].map((rating) => (
                            <div
                              key={rating}
                              onClick={() => setRatings({ ...ratings, [q.id]: rating })}
                              className={`flex-1 py-2.5 rounded-xl border-2 transition-all cursor-pointer ${
                                ratings[q.id as keyof typeof ratings] === rating
                                  ? 'border-amber-400 bg-amber-50 text-amber-600 shadow-sm scale-105'
                                  : 'border-slate-200 hover:border-amber-200 text-slate-400 bg-white hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex flex-col items-center pointer-events-none">
                                <span className={`material-symbols-outlined text-xl mb-0.5 ${ratings[q.id as keyof typeof ratings] === rating ? 'text-amber-500' : ''}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                                  star
                                </span>
                                <span className="text-[11px] font-bold">{rating}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    <div className="pt-2">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                        ความคิดเห็นเพิ่มเติม (ถ้ามี)
                      </label>
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="แชร์ความคิดเห็นของคุณเกี่ยวกับโปรเจ็คนี้..."
                        rows={2}
                        className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 focus:bg-white rounded-xl border border-slate-200 focus:border-[#27619d] focus:ring-2 focus:ring-[#27619d]/20 transition-all text-sm outline-none text-slate-800 resize-none font-medium placeholder:text-slate-400"
                      />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => {
                          setShowEvalForm(false);
                          setRatings({ q1: 0, q2: 0, q3: 0, q4: 0, q5: 0 });
                          setComment('');
                        }}
                        className="flex-1 py-3.5 rounded-xl border border-slate-200 text-slate-600 text-[13px] font-bold hover:bg-slate-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSubmitEvaluation}
                        className="flex-1 py-3.5 rounded-xl bg-[#27619d] text-white text-[13px] font-bold hover:bg-[#1e4d7a] transition-colors shadow-lg shadow-[#27619d]/20"
                      >
                        Submit Evaluation
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Comments */}
              {evaluations.length > 0 && !showEvalForm && (
                <div className="border-t border-slate-100 pt-6 mt-6">
                  <h3 className="text-lg font-extrabold text-slate-800 mb-4 font-display flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#27619d] text-xl">forum</span>
                    Comments
                  </h3>
                  <div className="space-y-3">
                    {evaluations.filter((e) => e.comment).map((evaluation, idx) => (
                      <div key={idx} className="bg-slate-50 border border-slate-100 rounded-2xl p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="font-bold text-slate-700 text-[13px]">{evaluation.evaluatorName}</p>
                          <p className="text-[10px] font-bold text-slate-400">
                            {new Date(evaluation.submittedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <p className="text-[13px] text-slate-600 leading-relaxed">{evaluation.comment}</p>
                      </div>
                    ))}
                    {evaluations.filter((e) => e.comment).length === 0 && (
                      <p className="text-[12px] text-slate-400 font-medium text-center py-3 italic">No written comments yet.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-3 flex flex-col items-start space-y-8 w-full max-w-full">
          {/* 2. Project Gallery */}
          {project.images && project.images.length > 0 && (
            <div className="w-fit max-w-full bg-white/70 backdrop-blur-xl border border-white/60 rounded-[32px] p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
              <div className="flex items-center gap-3 mb-6">
                <span className="material-symbols-outlined text-[#27619d] text-2xl">photo_library</span>
                <h2 className="text-xl font-extrabold text-slate-800 font-display">Project Gallery</h2>
              </div>
              
              <div className={`gap-4 sm:gap-6 w-full max-w-full ${
                project.images.length === 1 ? 'grid grid-cols-1 sm:w-[280px]' : 
                project.images.length === 2 ? 'grid grid-cols-1 sm:grid-cols-2 sm:w-[560px]' : 
                'columns-1 sm:columns-2 sm:w-[560px] -mb-4 sm:-mb-6'
              }`}>
                {project.images.map((img, idx) => (
                  <div
                    key={idx}
                    className={`relative rounded-[24px] overflow-hidden cursor-pointer group shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500 bg-slate-100 border border-slate-200/60 w-full ${
                      project.images.length >= 3 ? 'break-inside-avoid inline-block mb-4 sm:mb-6' : ''
                    }`}
                    onClick={() => setSelectedImageIndex(idx)}
                  >
                    <img
                      src={img}
                      alt={`${project.name} - image ${idx + 1}`}
                      className="w-full h-auto block object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                      <span className="material-symbols-outlined text-white opacity-0 group-hover:opacity-100 transition-all duration-300 drop-shadow-lg text-4xl transform scale-50 group-hover:scale-100">zoom_in</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Attached Documents (เอกสารแนบ) */}
          {project.pdfReports && project.pdfReports.length > 0 && (
            <div className="w-fit min-w-[300px] max-w-full bg-white/70 backdrop-blur-xl border border-white/60 rounded-[32px] p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-5">
                <span className="material-symbols-outlined text-[#27619d] text-2xl">folder_open</span>
                <h2 className="text-xl font-extrabold text-slate-800 font-display">Documents</h2>
              </div>
              <div className="flex flex-wrap gap-4">
                {project.pdfReports.map((pdf, idx) => (
                  <a key={idx} href={pdf.data} download={pdf.name} className="flex items-center gap-4 bg-white/60 hover:bg-white border border-slate-200/60 p-4 rounded-2xl transition-all hover:shadow-md hover:-translate-y-1 group pr-8">
                    <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center text-red-500 group-hover:scale-110 group-hover:bg-red-100 transition-all shadow-sm">
                      <span className="material-symbols-outlined text-2xl">picture_as_pdf</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-700 truncate">{pdf.name}</p>
                      <p className="text-xs font-medium text-slate-400 mt-0.5 group-hover:text-[#27619d] transition-colors">Click to download</p>
                    </div>
                    <span className="material-symbols-outlined text-slate-300 group-hover:text-[#27619d] transition-colors">download</span>
                  </a>
                ))}
              </div>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Lightbox Modal for Images */}
      {selectedImageIndex !== null && project?.images && createPortal(
        <div 
          className="fixed inset-0 z-[100000] flex items-center justify-center p-4 sm:p-8 cursor-pointer" 
          onClick={(e) => {
            if (project.images.length > 1) {
              const clickX = e.clientX;
              const screenWidth = window.innerWidth;
              if (clickX < screenWidth / 2) {
                setSelectedImageIndex(prev => prev !== null ? (prev === 0 ? project.images.length - 1 : prev - 1) : null);
              } else {
                setSelectedImageIndex(prev => prev !== null ? (prev === project.images.length - 1 ? 0 : prev + 1) : null);
              }
            } else {
              setSelectedImageIndex(null);
            }
          }}
        >
          <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-xl transition-opacity duration-300"></div>
          <div className="relative max-w-6xl w-full h-full flex flex-col items-center justify-center animate-[fadeIn_0.2s_ease-out]">
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedImageIndex(null); }}
              className="absolute top-0 right-0 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 backdrop-blur-md transition-all z-50"
            >
              <span className="material-symbols-outlined text-3xl">close</span>
            </button>
            
            {/* Main Image Area */}
            <div className="relative flex-1 w-full flex items-center justify-center min-h-0 my-4 sm:my-6">
              {project.images.length > 1 && (
                <button
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setSelectedImageIndex(prev => prev !== null ? (prev === 0 ? project.images.length - 1 : prev - 1) : null); 
                  }}
                  className="absolute left-0 sm:left-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 sm:p-3 backdrop-blur-md transition-all z-50"
                >
                  <span className="material-symbols-outlined text-3xl sm:text-4xl">chevron_left</span>
                </button>
              )}

              <img
                src={project.images[selectedImageIndex]}
                alt="Project Full View"
                className="max-w-full max-h-full object-contain rounded-xl shadow-2xl z-10"
                onClick={(e) => e.stopPropagation()}
              />

              {project.images.length > 1 && (
                <button
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setSelectedImageIndex(prev => prev !== null ? (prev === project.images.length - 1 ? 0 : prev + 1) : null); 
                  }}
                  className="absolute right-0 sm:right-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 sm:p-3 backdrop-blur-md transition-all z-50"
                >
                  <span className="material-symbols-outlined text-3xl sm:text-4xl">chevron_right</span>
                </button>
              )}
            </div>

            {/* Thumbnails Grid at Bottom */}
            {project.images.length > 1 && (
              <div 
                className="w-full flex justify-center gap-3 overflow-x-auto py-2 shrink-0 px-4"
                onClick={(e) => e.stopPropagation()}
              >
                {project.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden shrink-0 transition-all duration-300 ${
                      idx === selectedImageIndex 
                        ? 'ring-2 ring-white scale-110 shadow-lg z-10 opacity-100' 
                        : 'opacity-40 hover:opacity-100 hover:scale-105'
                    }`}
                  >
                    <img src={img} className="w-full h-full object-cover" alt={`Thumbnail ${idx + 1}`} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ProjectDetail;

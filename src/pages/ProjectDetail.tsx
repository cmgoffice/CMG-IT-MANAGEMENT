import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/projects')}
            className="flex items-center gap-2 text-[#27619d] hover:underline mb-4 font-semibold"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            Back to Projects
          </button>
          
          <div className="bg-white/40 backdrop-blur-md border border-white/40 rounded-2xl p-8 shadow-lg">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h1 className="text-3xl font-extrabold text-[#2c3437] mb-2 font-display">{project.name}</h1>
                <p className="text-sm text-[#596064] font-body">{project.id}</p>
              </div>
              <div className="flex gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  project.status === 'Completed' ? 'bg-green-100 text-green-800' :
                  project.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                  project.status === 'Planning' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {project.status}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  project.priority === 'High' ? 'bg-red-100 text-red-700' :
                  project.priority === 'Medium' ? 'bg-orange-100 text-orange-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {project.priority} Priority
                </span>
              </div>
            </div>

            <p className="text-[#596064] mb-6 font-body">{project.description}</p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div>
                <p className="text-xs text-[#596064] mb-1">Category</p>
                <p className="font-semibold text-[#2c3437]">{project.category || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-[#596064] mb-1">Start Date</p>
                <p className="font-semibold text-[#2c3437]">
                  {project.startDate ? new Date(project.startDate).toLocaleDateString() : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#596064] mb-1">End Date</p>
                <p className="font-semibold text-[#2c3437]">
                  {project.endDate ? new Date(project.endDate).toLocaleDateString() : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#596064] mb-1">Team Size</p>
                <p className="font-semibold text-[#2c3437]">{project.team.length} members</p>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex justify-between text-sm text-[#596064] mb-2">
                <span>Progress</span>
                <span className="font-bold text-[#27619d]">{project.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-[#27619d] h-3 rounded-full transition-all"
                  style={{ width: `${project.progress}%` }}
                />
              </div>
            </div>

            {project.team.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-[#596064] mb-2">Team Members:</p>
                <div className="flex flex-wrap gap-2">
                  {project.team.map((member, idx) => (
                    <span key={idx} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                      {member}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Evaluation Section */}
        <div className="bg-white/40 backdrop-blur-md border border-white/40 rounded-2xl p-8 shadow-lg mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-[#2c3437] mb-1 font-display">Project Evaluation</h2>
              <p className="text-sm text-[#596064] font-body">
                {evaluations.length} evaluation{evaluations.length !== 1 ? 's' : ''} submitted
              </p>
            </div>
            {!hasEvaluated && (
              <button
                onClick={() => setShowEvalForm(!showEvalForm)}
                className="flex items-center gap-2 bg-[#27619d] text-white px-4 py-2 rounded-lg font-semibold text-sm shadow-lg hover:opacity-90 transition-opacity"
              >
                <span className="material-symbols-outlined text-sm">rate_review</span>
                Evaluate Project
              </button>
            )}
            {hasEvaluated && (
              <span className="flex items-center gap-2 text-green-600 font-semibold">
                <span className="material-symbols-outlined">check_circle</span>
                You've evaluated this project
              </span>
            )}
          </div>

          {/* Average Ratings */}
          {evaluations.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="text-5xl font-bold text-[#27619d]">{calculateAverageRating()}</div>
                <div>
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        className={`material-symbols-outlined text-2xl ${
                          star <= parseFloat(calculateAverageRating())
                            ? 'text-yellow-400'
                            : 'text-gray-300'
                        }`}
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        star
                      </span>
                    ))}
                  </div>
                  <p className="text-sm text-[#596064]">Average rating from {evaluations.length} evaluations</p>
                </div>
              </div>

              <div className="space-y-3">
                {questions.map((q) => (
                  <div key={q.id} className="flex items-center gap-4">
                    <div className="flex-1">
                      <p className="text-sm text-[#596064] mb-1">{q.text}</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-yellow-400 h-2 rounded-full"
                            style={{ width: `${(parseFloat(calculateQuestionAverage(q.id as any)) / 5) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-[#27619d] w-8">
                          {calculateQuestionAverage(q.id as any)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Evaluation Form */}
          {showEvalForm && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-bold text-[#2c3437] mb-4">ประเมินโปรเจ็คนี้</h3>
              <div className="space-y-6">
                {questions.map((q, idx) => (
                  <div key={q.id}>
                    <p className="text-sm font-semibold text-gray-800 mb-3">
                      {idx + 1}. {q.text}
                    </p>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <button
                          key={rating}
                          onClick={() => setRatings({ ...ratings, [q.id]: rating })}
                          className={`flex-1 py-3 rounded-lg border-2 transition-all ${
                            ratings[q.id as keyof typeof ratings] === rating
                              ? 'border-[#27619d] bg-[#27619d] text-white'
                              : 'border-gray-300 hover:border-[#27619d] text-gray-700'
                          }`}
                        >
                          <div className="flex flex-col items-center">
                            <span className="material-symbols-outlined text-2xl mb-1" style={{ fontVariationSettings: "'FILL' 1" }}>
                              star
                            </span>
                            <span className="text-xs font-semibold">{rating}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                <div>
                  <label className="text-sm font-semibold text-gray-800 mb-2 block">
                    ความคิดเห็นเพิ่มเติม (ถ้ามี)
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="แชร์ความคิดเห็นของคุณเกี่ยวกับโปรเจ็คนี้..."
                    rows={4}
                    className="w-full px-3 py-2.5 bg-white rounded-lg border border-gray-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all text-sm outline-none resize-none"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowEvalForm(false);
                      setRatings({ q1: 0, q2: 0, q3: 0, q4: 0, q5: 0 });
                      setComment('');
                    }}
                    className="flex-1 py-3 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitEvaluation}
                    className="flex-1 py-3 rounded-lg bg-blue-500 text-white font-semibold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20"
                  >
                    Submit Evaluation
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Comments */}
          {evaluations.length > 0 && (
            <div className="border-t border-gray-200 pt-6 mt-6">
              <h3 className="text-lg font-bold text-[#2c3437] mb-4">Comments</h3>
              <div className="space-y-4">
                {evaluations.filter((e) => e.comment).map((evaluation, idx) => (
                  <div key={idx} className="bg-white/60 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-[#2c3437]">{evaluation.evaluatorName}</p>
                      <p className="text-xs text-[#596064]">
                        {new Date(evaluation.submittedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <p className="text-sm text-[#596064]">{evaluation.comment}</p>
                  </div>
                ))}
                {evaluations.filter((e) => e.comment).length === 0 && (
                  <p className="text-sm text-[#596064] text-center py-4">No comments yet</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectDetail;

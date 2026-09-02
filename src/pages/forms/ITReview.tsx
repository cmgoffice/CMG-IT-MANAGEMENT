import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { generateDocNo, ROOT_COLLECTION, ROOT_DOCUMENT } from '../../lib/db';
import { buildReporterSubmissionMeta } from '../../lib/formSubmission';

const ratingLabels: Record<number, string> = {
  1: 'ควรปรับปรุงมาก',
  2: 'พอใช้',
  3: 'ดี',
  4: 'ดีมาก',
  5: 'ยอดเยี่ยม',
};

const ITReview = () => {
  const today = new Date().toISOString().split('T')[0];
  const { userProfile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [, setWrNumber] = useState('');
  const [rating, setRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadDocNo = async () => {
      try {
        const newDocNo = await generateDocNo('FM-IT-008', 'itReviews');
        if (!cancelled) {
          setWrNumber(newDocNo);
        }
      } catch (error) {
        console.error('Failed to generate FM-IT-008 number:', error);
      }
    };

    loadDocNo();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userProfile) return alert('Please login first');
    if (rating === 0) return alert('กรุณาให้คะแนนรีวิว 1-5 ดาว');
    if (!reviewComment.trim()) return alert('กรุณาเขียนรีวิว');

    setIsSubmitting(true);

    try {
      const latestWrNumber = await generateDocNo('FM-IT-008', 'itReviews');
      setWrNumber(latestWrNumber);

      const submissionMeta = buildReporterSubmissionMeta(userProfile, {});

      await addDoc(collection(db, ROOT_COLLECTION, ROOT_DOCUMENT, 'itReviews'), {
        docNo: latestWrNumber,
        wrNumber: latestWrNumber,
        requestDate: today,
        reviewDate: today,
        rating,
        reviewComment: reviewComment.trim(),
        submittedBy: submissionMeta.submittedBy,
        reporter: submissionMeta.reporter,
        status: 'submitted',
        reviewedAt: Timestamp.now(),
        createdAt: Timestamp.now(),
      });

      await addDoc(collection(db, ROOT_COLLECTION, ROOT_DOCUMENT, 'logs'), {
        name: submissionMeta.reporterName,
        email: submissionMeta.reporterEmail,
        action: 'IT Review Submitted',
        module: 'IT Review Form (FM-IT-008)',
        ip: 'Internal',
        ok: true,
        createdAt: Timestamp.now(),
      });

      import('../../lib/lineNotify').then(({ sendLineNotification }) => {
        const todayStr = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
        const lineMessage = `\n📢 รีวิวฝ่าย IT (FM-IT-008)\n───────────────────\n📅 วันที่แจ้ง : ${todayStr}\n📄 เลขที่ใบแจ้ง : ${latestWrNumber}\n⭐ คะแนน : ${rating}/5 ${ratingLabels[rating] || ''}\n📝 รีวิว : ${reviewComment.trim()}\n───────────────────`;
        sendLineNotification(lineMessage);
      });

      setSubmitted(true);
    } catch (error) {
      console.error(error);
      alert('Failed to submit review.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-[95%] mx-auto p-8 md:p-12">
        <div className="glass-card rounded-2xl p-10 text-center shadow-xl">
          <span className="material-symbols-outlined mb-4 text-6xl text-green-500">check_circle</span>
          <h2 className="mb-2 text-3xl font-bold text-on-surface">ส่งรีวิวเรียบร้อย</h2>
          <p className="mb-6 text-on-surface-variant">ขอบคุณสำหรับความคิดเห็นของคุณ ทีม IT จะนำไปปรับปรุงการบริการต่อไป</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-xl bg-primary px-8 py-3 font-bold text-on-primary shadow-lg transition-all hover:scale-[1.02]"
          >
            ส่งรีวิวอีกครั้ง
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-8 md:p-12">
      <header className="mb-12">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-secondary-container/80 px-3 py-1 text-sm font-bold text-on-secondary-container shadow-sm backdrop-blur-md">
            <span className="material-symbols-outlined text-sm">reviews</span>
            เอกสารหน่วยงาน IT/CMG
          </div>
          <h1 className="mb-4 text-4xl font-extrabold tracking-tight text-on-surface md:text-5xl">Reviews</h1>
          <p className="max-w-2xl text-base text-on-surface-variant">
            ให้คะแนนการให้บริการของฝ่าย IT ตั้งแต่ 1-5 ดาว และเขียนรีวิวเพื่อช่วยให้ทีมปรับปรุงการดูแลได้ดียิ่งขึ้น
          </p>
        </div>
      </header>

      <div className="glass-card rounded-2xl border-2 border-primary/20 p-8 shadow-xl shadow-blue-900/5 md:p-10">
        <form className="space-y-10" onSubmit={handleSubmit}>
          <section>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-on-surface">คะแนนรีวิว</h2>
                <p className="text-sm text-on-surface-variant">เลือกคะแนนดาว 1-5 ดาว</p>
              </div>
              <div className="rounded-full bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700">
                {rating > 0 ? `${rating}/5 • ${ratingLabels[rating]}` : 'ยังไม่ได้เลือกคะแนน'}
              </div>
            </div>

            <div className="grid grid-cols-5 gap-3">
              {[1, 2, 3, 4, 5].map((value) => {
                const isActive = rating === value;

                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(value)}
                    className={`rounded-2xl border-2 px-3 py-4 text-center transition-all ${
                      isActive
                        ? 'scale-[1.02] border-amber-400 bg-amber-50 text-amber-700 shadow-sm'
                        : 'border-white/50 bg-white/45 text-slate-500 hover:border-amber-200 hover:bg-white/75'
                    }`}
                  >
                    <div className="pointer-events-none flex flex-col items-center gap-1">
                      <span className="material-symbols-outlined text-[30px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        star
                      </span>
                      <span className="text-sm font-bold">{value}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <label className="mb-3 block text-sm font-bold text-on-surface-variant">เขียนรีวิว</label>
            <textarea
              name="reviewComment"
              rows={6}
              required
              value={reviewComment}
              onChange={(event) => setReviewComment(event.target.value)}
              placeholder="บอกความประทับใจ ปัญหาที่พบ หรือข้อเสนอแนะเพิ่มเติมได้ที่นี่"
              className="w-full rounded-3xl border border-white/50 bg-white/45 px-5 py-4 text-sm text-on-surface shadow-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </section>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-2xl bg-primary px-8 py-3 text-sm font-bold text-on-primary shadow-lg shadow-primary/20 transition-all hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? 'กำลังส่งรีวิว...' : 'ส่งรีวิว'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ITReview;

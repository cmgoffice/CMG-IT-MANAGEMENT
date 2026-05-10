import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';

export const ROOT_COLLECTION = 'CMG-IT-MANAGEMENT';
export const ROOT_DOCUMENT = 'root';

export const menuCollection = (menuName: string) => collection(db, ROOT_COLLECTION, ROOT_DOCUMENT, menuName);

/**
 * Generate the next document number for a given form code by inspecting
 * existing documents in the specified collection.
 * Format: FM-IT-{formNum}-{year}{runningNumber} (e.g. FM-IT-001-2026001)
 * Resets running number to 001 when the year changes.
 */
export const generateDocNo = async (formCode: string, collectionName: string): Promise<string> => {
  const year = new Date().getFullYear();
  const prefix = `${formCode}-${year}`;
  const colRef = collection(db, ROOT_COLLECTION, ROOT_DOCUMENT, collectionName);

  const q = query(
    colRef,
    where('docNo', '>=', prefix),
    where('docNo', '<', `${formCode}-${year + 1}`)
  );

  const snap = await getDocs(q);
  let max = 0;
  snap.forEach((d) => {
    const no = (d.data().docNo as string) || '';
    if (no.startsWith(prefix)) {
      const running = parseInt(no.slice(prefix.length), 10);
      if (!isNaN(running) && running > max) max = running;
    }
  });

  return `${prefix}${String(max + 1).padStart(3, '0')}`;
};

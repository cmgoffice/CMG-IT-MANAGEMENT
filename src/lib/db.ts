import { collection, getDocs, getDocsFromServer } from 'firebase/firestore';
import { db } from './firebase';

export const ROOT_COLLECTION = 'CMG-IT-MANAGEMENT';
export const ROOT_DOCUMENT = 'root';

export const menuCollection = (menuName: string) => collection(db, ROOT_COLLECTION, ROOT_DOCUMENT, menuName);

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const extractRunningNumber = (
  candidate: string,
  formCode: string,
  year: number,
): number | null => {
  const normalized = candidate.trim().toUpperCase();
  if (!normalized) return null;

  const normalizedFormCode = formCode.trim().toUpperCase();
  const escapedFormCode = escapeRegExp(normalizedFormCode);
  const currentYear = String(year);

  const exactPatterns = [
    new RegExp(`^${escapedFormCode}-${currentYear}(\\d{3})$`),
    new RegExp(`^${escapedFormCode}-${currentYear}-(\\d{3})$`),
  ];

  for (const pattern of exactPatterns) {
    const exactMatch = normalized.match(pattern);
    if (!exactMatch) continue;

    const parsed = parseInt(exactMatch[1], 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
};

type GenerateDocNoStrategy = 'fill-gaps' | 'increment-latest';

type NumberFieldKey = 'docNo' | 'wrNumber';

const FORM_NUMBER_FIELDS: Record<string, NumberFieldKey[]> = {
  'FM-IT-001': ['docNo', 'wrNumber'],
  'FM-IT-002': ['wrNumber', 'docNo'],
  'FM-IT-003': ['wrNumber', 'docNo'],
  'FM-IT-004': ['wrNumber', 'docNo'],
  'FM-IT-005': ['wrNumber', 'docNo'],
  'FM-IT-006': ['wrNumber', 'docNo'],
  'FM-IT-007': ['wrNumber', 'docNo'],
  'FM-IT-008': ['wrNumber', 'docNo'],
};

const getPreferredNumberFields = (formCode: string): NumberFieldKey[] =>
  FORM_NUMBER_FIELDS[formCode] || ['wrNumber', 'docNo'];

/**
 * Generate the next document number for a given form code by inspecting
 * existing documents in the specified collection.
 * Format: FM-IT-{formNum}-{year}{runningNumber} (e.g. FM-IT-001-2026001)
 * Resets running number to 001 when the year changes.
 * Default behavior follows the visible number field for that form, matching FormBackend.
 */
export const generateDocNo = async (
  formCode: string,
  collectionName: string,
  strategy: GenerateDocNoStrategy = 'increment-latest',
): Promise<string> => {
  const year = new Date().getFullYear();
  const colRef = collection(db, ROOT_COLLECTION, ROOT_DOCUMENT, collectionName);
  let snap;

  try {
    snap = await getDocsFromServer(colRef);
  } catch (error) {
    console.warn(`Falling back to cached docs for ${collectionName}:`, error);
    snap = await getDocs(colRef);
  }

  const records: Array<Record<NumberFieldKey, string | undefined>> = [];

  snap.forEach((d) => {
    const data = d.data() as Record<NumberFieldKey, string | undefined>;
    records.push(data);
  });

  const preferredFields = getPreferredNumberFields(formCode);
  const activeNumberField =
    preferredFields.find((field) =>
      records.some((record) => {
        const candidate = record[field];
        return typeof candidate === 'string'
          && extractRunningNumber(candidate, formCode, year) !== null;
      }),
    ) ?? preferredFields[0];

  let nextRunningNumber = 1;

  if (strategy === 'increment-latest') {
    const latestRunning = records.reduce<number>((maxRunning, record) => {
      const candidate = record[activeNumberField];
      if (typeof candidate !== 'string') return maxRunning;

      const running = extractRunningNumber(candidate, formCode, year);
      return running !== null && running > maxRunning ? running : maxRunning;
    }, 0);

    nextRunningNumber = latestRunning + 1;
  } else {
    const usedNumbers = new Set<number>();

    records.forEach((data) => {
      const candidate = data[activeNumberField];

      if (typeof candidate !== 'string') return;

      const running = extractRunningNumber(candidate, formCode, year);
      if (running !== null && running > 0) {
        usedNumbers.add(running);
      }
    });

    while (usedNumbers.has(nextRunningNumber)) {
      nextRunningNumber += 1;
    }
  }

  return `${formCode}-${year}${String(nextRunningNumber).padStart(3, '0')}`;
};

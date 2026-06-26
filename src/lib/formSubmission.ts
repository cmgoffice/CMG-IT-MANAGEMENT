import type { UserProfile } from '../contexts/AuthContext';

type SubmissionValue = FormDataEntryValue | string | null | undefined;
type SubmissionValues = Record<string, SubmissionValue>;

interface ReporterFieldOptions {
  departmentField?: string;
  jobTitleField?: string;
  phoneField?: string;
}

const readStringValue = (values: SubmissionValues, fieldName?: string): string => {
  if (!fieldName) return '';

  const value = values[fieldName];
  return typeof value === 'string' ? value.trim() : '';
};

export const buildReporterSubmissionMeta = (
  userProfile: UserProfile,
  values: SubmissionValues,
  options: ReporterFieldOptions = {}
) => {
  const reporterName = `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || 'Unknown';
  const reporterEmail = userProfile.email || 'N/A';
  const reporterDepartment = readStringValue(values, options.departmentField ?? 'department') || userProfile.department || '';
  const reporterJobTitle = readStringValue(values, options.jobTitleField ?? 'jobTitle') || userProfile.position || '';
  const reporterPhone = readStringValue(values, options.phoneField ?? 'phone');

  return {
    reporterName,
    reporterEmail,
    reporterDepartment,
    reporterJobTitle,
    reporterPhone,
    submittedBy: reporterEmail,
    reporter: {
      name: reporterName,
      email: reporterEmail,
      department: reporterDepartment,
      jobTitle: reporterJobTitle,
      phone: reporterPhone,
    },
  };
};

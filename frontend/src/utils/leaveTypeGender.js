export const APPLICABLE_GENDERS = ['All', 'Male', 'Female'];

export const normalizeApplicableGender = (value) => {
  if (!value) return 'All';
  const normalized = String(value).trim().toLowerCase();
  return APPLICABLE_GENDERS.find(gender => gender.toLowerCase() === normalized) || 'All';
};

export const isLeaveTypeApplicableToGender = (leaveType, employeeGender) => {
  const applicableGender = normalizeApplicableGender(leaveType?.applicable_gender);
  if (applicableGender === 'All') return true;
  if (!employeeGender) return false;
  return applicableGender.toLowerCase() === String(employeeGender).trim().toLowerCase();
};

export const filterLeaveTypesByGender = (leaveTypes, employeeGender) => {
  return (leaveTypes || []).filter(type => isLeaveTypeApplicableToGender(type, employeeGender));
};

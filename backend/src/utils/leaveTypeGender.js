const VALID_APPLICABLE_GENDERS = ['All', 'Male', 'Female'];

const normalizeApplicableGender = (value) => {
  if (!value) return 'All';
  const normalized = String(value).trim().toLowerCase();
  const match = VALID_APPLICABLE_GENDERS.find(gender => gender.toLowerCase() === normalized);
  return match || 'All';
};

const isLeaveTypeApplicableToGender = (leaveType, employeeGender) => {
  const applicableGender = normalizeApplicableGender(leaveType?.applicable_gender);
  if (applicableGender === 'All') return true;
  if (!employeeGender) return false;
  return applicableGender.toLowerCase() === String(employeeGender).trim().toLowerCase();
};

module.exports = {
  VALID_APPLICABLE_GENDERS,
  normalizeApplicableGender,
  isLeaveTypeApplicableToGender
};

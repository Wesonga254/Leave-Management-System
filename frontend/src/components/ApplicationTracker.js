import React from 'react';
import './ApplicationTracker.css';

const STEP_LABELS = {
  supervisor: 'Supervisor Review',
  director: 'Director Approval'
};

function prettifyStep(value = '') {
  return STEP_LABELS[value] || value.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function getStepState(step, index, applicationStatus, workflow) {
  const status = (step.status || '').toLowerCase();
  const finalStatus = (applicationStatus || '').toLowerCase();

  if (status === 'approved') return 'complete';
  if (status === 'rejected') return 'rejected';
  if (finalStatus === 'rejected' && status !== 'approved') return index === 0 ? 'complete' : 'waiting';
  if (finalStatus === 'cancelled' || finalStatus === 'canceled') return index === 0 ? 'complete' : 'waiting';

  const firstPendingIndex = (workflow || []).findIndex(item => (item.status || '').toLowerCase() === 'pending');
  if (status === 'pending' && index === firstPendingIndex) return 'active';
  if (status === 'not_required') return 'waiting';
  return 'waiting';
}

function getTrackerSteps(application) {
  const workflow = application?.workflow || [];

  // Filter out HR steps — HR is not involved in approval
  const filteredWorkflow = workflow.filter(step => {
    const level = (step.approval_level || '').toLowerCase();
    return level !== 'hr';
  });

  if (filteredWorkflow.length > 0) {
    const finalStatus = (application.status || '').toLowerCase();
    return [
      { label: 'Submitted', state: 'complete', note: application.created_at },
      ...filteredWorkflow.map((step, index) => ({
        label: prettifyStep(step.approval_level),
        state: getStepState(step, index, application.status, filteredWorkflow),
        note: step.approved_at || step.updated_at,
        comments: step.comments
      })),
      {
        label: finalStatus === 'rejected' ? 'Rejected'
          : finalStatus === 'approved' ? 'Approved'
          : 'Final Decision',
        state: finalStatus === 'approved' ? 'complete'
          : finalStatus === 'rejected' ? 'rejected'
          : 'waiting',
        note: null
      }
    ];
  }

  // Fallback when no workflow data — simple 3-step flow (no HR)
  const status = application?.status || 'pending';
  const normalized = status.toLowerCase();
  const steps = ['Submitted', 'Supervisor Review', 'Approved'];

  if (normalized === 'approved') {
    return steps.map(label => ({ label, state: 'complete' }));
  }

  if (normalized === 'rejected') {
    return [
      { label: 'Submitted', state: 'complete' },
      { label: 'Supervisor Review', state: 'rejected' },
      { label: 'Rejected', state: 'rejected' }
    ];
  }

  if (normalized === 'cancelled' || normalized === 'canceled') {
    return [
      { label: 'Submitted', state: 'complete' },
      { label: 'Cancelled', state: 'rejected' },
      { label: 'Closed', state: 'waiting' }
    ];
  }

  return steps.map((label, index) => ({
    label,
    state: index === 0 ? 'complete' : index === 1 ? 'active' : 'waiting'
  }));
}

function getStepIcon(state, index) {
  if (state === 'complete') return '✓';
  if (state === 'rejected') return '✕';
  if (state === 'active') return '●';
  return index + 1;
}

export default function ApplicationTracker({ application }) {
  if (!application) return null;
  const steps = getTrackerSteps(application);
  const leaveName = application.leave_type_name || application.leave_type || '';
  const dates = `${application.start_date?.slice(0, 10) || ''} → ${application.end_date?.slice(0, 10) || ''}`;

  return (
    <div className="app-tracker">
      <div className="app-tracker-header">
        <span className="app-tracker-type">{leaveName}</span>
        <span className="app-tracker-dates">{dates}</span>
      </div>
      <div className="app-tracker-pipeline">
        {steps.map((step, index) => (
          <div className={`pipeline-step pipeline-${step.state}`} key={`${step.label}-${index}`}>
            <div className="pipeline-connector">
              {index > 0 && <div className={`connector-line connector-${steps[index - 1].state}`}></div>}
              <div className="pipeline-dot">
                <span>{getStepIcon(step.state, index)}</span>
              </div>
            </div>
            <div className="pipeline-content">
              <span className="pipeline-label">{step.label}</span>
              {step.note && (
                <small className="pipeline-timestamp">{new Date(step.note).toLocaleDateString()}</small>
              )}
              {step.comments && (
                <small className="pipeline-comment">"{step.comments}"</small>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

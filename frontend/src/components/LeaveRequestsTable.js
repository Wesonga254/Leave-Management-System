import React from 'react';

const formatDate = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString();
};

function LeaveRequestsTable({
  requests = [],
  showEmployee = false,
  showComments = true,
  actions = null,
  emptyTitle = 'No leave requests found',
  emptyMessage = 'There are no requests to show for this view.'
}) {
  if (!requests.length) {
    return (
      <div className="empty-state">
        <h3>{emptyTitle}</h3>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="table-wrapper">
      <table className="table">
        <thead>
          <tr>
            {showEmployee && <th>Employee</th>}
            <th>Leave Type</th>
            <th>Dates</th>
            <th>Days</th>
            <th>Status</th>
            {showComments && <th>Comments</th>}
            {actions && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {requests.map(request => {
            const status = request.status || request.application_status || request.approval_status || 'pending';
            const latestComment = request.approval_comments || request.comments || request.workflow?.find(step => step.comments)?.comments || '';
            const employeeName = request.employee_name || [request.first_name, request.last_name].filter(Boolean).join(' ') || 'N/A';

            return (
              <tr key={request.id || request.workflow_id}>
                {showEmployee && (
                  <td data-label="Employee">
                    <strong>{employeeName}</strong>
                    <small>{request.employee_id || ''}</small>
                  </td>
                )}
                <td data-label="Leave Type">{request.leave_type_name || request.leave_type || 'N/A'}</td>
                <td data-label="Dates">
                  <small>{formatDate(request.start_date)} - {formatDate(request.end_date)}</small>
                </td>
                <td data-label="Days"><strong>{request.number_of_days || 0}</strong></td>
                <td data-label="Status">
                  <span className={`status-badge status-${String(status).toLowerCase()}`}>
                    {String(status).replace(/_/g, ' ')}
                  </span>
                </td>
                {showComments && <td data-label="Comments">{latestComment || '-'}</td>}
                {actions && <td className="actions-cell" data-label="Actions">{actions(request)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default LeaveRequestsTable;

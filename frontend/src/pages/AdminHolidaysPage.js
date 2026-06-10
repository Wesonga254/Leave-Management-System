import React, { useState, useEffect } from 'react';
import { adminService } from '../services/api';

export default function AdminHolidaysPage() {
  const [holidays, setHolidays] = useState([]);
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { fetchHolidays(); }, []);

  const fetchHolidays = async () => {
    try {
      setLoading(true);
      const res = await adminService.getHolidays();
      if (res.data.success) setHolidays(res.data.data || []);
    } catch (err) {
      setError('Error loading holidays');
    } finally { setLoading(false); }
  };

  const handleAdd = async () => {
    if (!date) { setError('Date required'); return; }
    try {
      await adminService.addHoliday({ date, name });
      setDate(''); setName('');
      await fetchHolidays();
    } catch (err) { setError('Error adding holiday'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this holiday?')) return;
    try { await adminService.deleteHoliday(id); await fetchHolidays(); } catch (err) { setError('Error deleting'); }
  };

  return (
    <div className="card">
      <h2 className="card-title">Public Holidays</h2>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="form-row">
        <div className="form-group">
          <label>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Holiday name" />
        </div>
        <div className="form-group" style={{ alignSelf: 'end' }}>
          <button className="btn btn-primary" onClick={handleAdd}>Add Holiday</button>
        </div>
      </div>

      {loading ? <div className="loading">Loading...</div> : (
        <table className="table">
          <thead><tr><th>Date</th><th>Name</th><th>Actions</th></tr></thead>
          <tbody>
            {holidays.map(h => (
              <tr key={h.id}>
                <td>{new Date(h.date).toLocaleDateString()}</td>
                <td>{h.name}</td>
                <td><button className="btn btn-danger" onClick={() => handleDelete(h.id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

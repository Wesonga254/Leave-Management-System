import React, { useEffect, useState } from 'react';
import { adminService } from '../services/api';

export default function AdminLeaveTypesPage() {
  const [types, setTypes] = useState([]);
  const [name, setName] = useState('');
  const [annualLimit, setAnnualLimit] = useState(0);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchTypes(); }, []);

  const fetchTypes = async () => {
    try { setLoading(true); const res = await adminService.getLeaveTypes(); if (res.data.success) setTypes(res.data.data || []); } catch (err) {} finally { setLoading(false); }
  };

  const handleAdd = async () => {
    try { await adminService.addLeaveType({ name, annual_limit: annualLimit, description }); setName(''); setAnnualLimit(0); setDescription(''); await fetchTypes(); } catch (err) { alert('Error adding'); }
  };

  const handleDelete = async (id) => { if (!window.confirm('Delete leave type?')) return; try { await adminService.deleteLeaveType(id); await fetchTypes(); } catch (err) { alert('Error deleting'); } };

  return (
    <div className="card">
      <h2 className="card-title">Manage Leave Types</h2>
      <div className="form-row">
        <div className="form-group"><label>Name</label><input value={name} onChange={e=>setName(e.target.value)} /></div>
        <div className="form-group"><label>Annual Limit</label><input type="number" value={annualLimit} onChange={e=>setAnnualLimit(parseInt(e.target.value||0))} /></div>
        <div className="form-group"><label>Description</label><input value={description} onChange={e=>setDescription(e.target.value)} /></div>
        <div className="form-group" style={{ alignSelf: 'end' }}><button className="btn btn-primary" onClick={handleAdd}>Add Type</button></div>
      </div>

      {loading ? <div className="loading">Loading...</div> : (
        <table className="table">
          <thead><tr><th>Name</th><th>Limit</th><th>Description</th><th>Actions</th></tr></thead>
          <tbody>
            {types.map(t=> (
              <tr key={t.id}><td>{t.name}</td><td>{t.annual_limit}</td><td>{t.description}</td><td><button className="btn btn-danger" onClick={()=>handleDelete(t.id)}>Delete</button></td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

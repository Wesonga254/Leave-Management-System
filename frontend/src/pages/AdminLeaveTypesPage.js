import React, { useEffect, useState } from 'react';
import { adminService } from '../services/api';
import { APPLICABLE_GENDERS, normalizeApplicableGender } from '../utils/leaveTypeGender';

export default function AdminLeaveTypesPage() {
  const [types, setTypes] = useState([]);
  const [name, setName] = useState('');
  const [annualLimit, setAnnualLimit] = useState(0);
  const [description, setDescription] = useState('');
  const [applicableGender, setApplicableGender] = useState('All');
  const [maxCarryForwardDays, setMaxCarryForwardDays] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchTypes(); }, []);

  const fetchTypes = async () => {
    try { setLoading(true); const res = await adminService.getLeaveTypes(); if (res.data.success) setTypes(res.data.data || []); } catch (err) {} finally { setLoading(false); }
  };

  const handleAdd = async () => {
    try {
      await adminService.addLeaveType({ name, annual_limit: annualLimit, description, applicable_gender: applicableGender, max_carry_forward_days: maxCarryForwardDays });
      setName('');
      setAnnualLimit(0);
      setDescription('');
      setApplicableGender('All');
      setMaxCarryForwardDays(0);
      await fetchTypes();
    } catch (err) { alert('Error adding'); }
  };

  const handleApplicableGenderChange = async (type, value) => {
    try {
      await adminService.updateLeaveType(type.id, { applicable_gender: value });
      setTypes(prev => prev.map(item => item.id === type.id ? { ...item, applicable_gender: value } : item));
    } catch (err) {
      alert('Error updating applicable gender');
    }
  };

  const handleCarryLimitChange = async (type, value) => {
    const max_carry_forward_days = Math.max(0, parseInt(value || 0, 10) || 0);
    try {
      await adminService.updateLeaveType(type.id, { max_carry_forward_days });
      setTypes(prev => prev.map(item => item.id === type.id ? { ...item, max_carry_forward_days } : item));
    } catch (err) {
      alert('Error updating carry-forward limit');
    }
  };

  const handleDelete = async (id) => { if (!window.confirm('Delete leave type?')) return; try { await adminService.deleteLeaveType(id); await fetchTypes(); } catch (err) { alert('Error deleting'); } };

  return (
    <div className="card">
      <h2 className="card-title">Manage Leave Types</h2>
      <div className="form-row">
        <div className="form-group"><label>Name</label><input value={name} onChange={e=>setName(e.target.value)} /></div>
        <div className="form-group"><label>Annual Limit</label><input type="number" value={annualLimit} onChange={e=>setAnnualLimit(parseInt(e.target.value||0))} /></div>
        <div className="form-group"><label>Description</label><input value={description} onChange={e=>setDescription(e.target.value)} /></div>
        <div className="form-group">
          <label>Applies To</label>
          <select value={applicableGender} onChange={e=>setApplicableGender(e.target.value)}>
            {APPLICABLE_GENDERS.map(gender => <option key={gender} value={gender}>{gender}</option>)}
          </select>
        </div>
        <div className="form-group"><label>Max Carry Forward</label><input type="number" min="0" value={maxCarryForwardDays} onChange={e=>setMaxCarryForwardDays(parseInt(e.target.value||0, 10))} /></div>
        <div className="form-group" style={{ alignSelf: 'end' }}><button className="btn btn-primary" onClick={handleAdd}>Add Type</button></div>
      </div>

      {loading ? <div className="loading">Loading...</div> : (
        <table className="table">
          <thead><tr><th>Name</th><th>Limit</th><th>Description</th><th>Applies To</th><th>Max Carry Forward</th><th>Actions</th></tr></thead>
          <tbody>
            {types.map(t=> (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{t.annual_limit}</td>
                <td>{t.description}</td>
                <td>
                  <select value={normalizeApplicableGender(t.applicable_gender)} onChange={e=>handleApplicableGenderChange(t, e.target.value)}>
                    {APPLICABLE_GENDERS.map(gender => <option key={gender} value={gender}>{gender}</option>)}
                  </select>
                </td>
                <td><input type="number" min="0" value={t.max_carry_forward_days || 0} onChange={e=>handleCarryLimitChange(t, e.target.value)} /></td>
                <td><button className="btn btn-danger" onClick={()=>handleDelete(t.id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

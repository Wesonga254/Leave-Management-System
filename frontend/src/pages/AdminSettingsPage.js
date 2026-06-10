import React, { useEffect, useState } from 'react';
import { adminService } from '../services/api';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    try { setLoading(true); const res = await adminService.getSettings(); if (res.data.success) setSettings(res.data.data || []); } catch (err) { }
    finally { setLoading(false); }
  };

  const handleUpdate = async (key, value) => {
    try { await adminService.updateSetting(key, { value }); await fetchSettings(); } catch (err) { alert('Error saving'); }
  };

  return (
    <div className="card">
      <h2 className="card-title">System Settings</h2>
      {loading ? <div className="loading">Loading...</div> : (
        <table className="table">
          <thead><tr><th>Key</th><th>Value</th><th>Description</th><th>Action</th></tr></thead>
          <tbody>
            {settings.map(s => (
              <tr key={s.key}>
                <td>{s.key}</td>
                <td><input value={s.value} onChange={e=>s.value=e.target.value} /></td>
                <td>{s.description}</td>
                <td><button className="btn btn-primary" onClick={() => handleUpdate(s.key, s.value)}>Save</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

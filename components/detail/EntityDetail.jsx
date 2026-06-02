'use client';

import { useState, useEffect, useRef } from 'react';
import StatusBadge from '../shared/StatusBadge';

export default function EntityDetail({ entity, role, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [projectId, setProjectId] = useState(null);
  const [fullEntityType, setFullEntityType] = useState(null);
  const [fullEntity, setFullEntity] = useState(null);
  
  const fetchEntityDetails = async (pid, eid) => {
    try {
      const res = await fetch(`/api/projects/${pid}/entities/${eid}`);
      if (res.ok) {
        const data = await res.json();
        setFullEntity(data);
      }
    } catch (err) {
      console.error('Failed to fetch full entity', err);
    }
  };

  useEffect(() => {
    const pid = sessionStorage.getItem('ktern_project_id');
    setProjectId(pid);
    
    if (entity && pid) {
      // Fetch full entity types because the GET /entities response truncates entityType.id and attributes
      fetch(`/api/projects/${pid}/entity-types`)
        .then(r => r.json())
        .then(types => {
          const matchedType = types.find(t => t.name === (entity.entityType?.name || entity.typeId) || t.id === entity.typeId);
          setFullEntityType(matchedType);
        })
        .catch(console.error);

      // Fetch fresh entity data to get updated values
      fetchEntityDetails(pid, entity.id);
    } else {
      setFullEntityType(null);
      setFullEntity(null);
    }
  }, [entity]);

  if (!entity) return (
    <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4">
      <div className="text-4xl">⟁</div>
      <div className="text-sm font-medium text-gray-500">Select an entity from the tree</div>
    </div>
  );

  const vals = fullEntity?.values || entity.values || {};
  const status = fullEntity?.status || entity.status || 'draft';
  const typeName = entity.entityType?.name || entity.typeId || 'Entity';
  const canEdit = role === 'sme';

  const handleStatusChange = async (newStatus) => {
    if (!projectId) return;
    setSaving(true);
    try {
      await fetch(`/api/projects/${projectId}/entities/${entity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      alert(`Status successfully updated to ${newStatus}`);
      await fetchEntityDetails(projectId, entity.id);
      if (onSaved) onSaved();
    } catch (err) {
      console.error(err);
      alert('Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveField = async (field, value) => {
    if (!projectId || !fullEntityType) return;
    setSaving(true);
    try {
      const attr = fullEntityType.attributes?.find(a => a.name === field);
      const attrKey = attr ? attr.id : field;

      await fetch(`/api/projects/${projectId}/entities/${entity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: { [attrKey]: value } })
      });
      await fetchEntityDetails(projectId, entity.id);
      if (onSaved) onSaved();
    } catch (err) {
      console.error(err);
      alert('Failed to save field');
    } finally {
      setSaving(false);
    }
  };

  const getFieldValue = (fieldName) => {
    const attr = fullEntityType?.attributes?.find(a => a.name === fieldName);
    return attr ? vals[attr.id] : vals[fieldName];
  };

  const getFieldLabel = (name) => {
    return name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const handleAddAttribute = async () => {
    if (!projectId || !fullEntityType) return;
    const name = prompt('Enter new attribute name (e.g. sign_off_notes):');
    if (!name) return;

    const newAttr = {
      id: `attr-${Date.now()}`,
      name: name.toLowerCase().replace(/[^a-z0-9_]+/g, '_'),
      type: 'textarea',
      required: false
    };

    const currentSchema = entity.values?.custom_attributes_schema || [];
    const updatedSchema = [...currentSchema, newAttr];

    try {
      await fetch(`/api/projects/${projectId}/entities/${entity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: { custom_attributes_schema: updatedSchema } })
      });
      if (onSaved) onSaved();
    } catch (err) {
      console.error(err);
      alert('Failed to add attribute');
    }
  };

  const handleDeleteAttribute = async (attrId, isNodeSpecific) => {
    if (!projectId || !fullEntityType) return;
    if (!confirm('Are you sure you want to delete this attribute from the schema?')) return;

    if (isNodeSpecific) {
      const currentSchema = entity.values?.custom_attributes_schema || [];
      const updatedSchema = currentSchema.filter(a => a.id !== attrId);
      try {
        await fetch(`/api/projects/${projectId}/entities/${entity.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: { custom_attributes_schema: updatedSchema } })
        });
        if (onSaved) onSaved();
      } catch (err) {
        console.error(err);
        alert('Failed to delete node attribute');
      }
    } else {
      const updatedAttributes = (fullEntityType.attributes || []).filter(a => a.id !== attrId);
      try {
        await fetch(`/api/projects/${projectId}/entity-types/${fullEntityType.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attributes: updatedAttributes })
        });
        alert('Global Attribute removed! Please refresh the page.');
      } catch (err) {
        console.error(err);
        alert('Failed to delete attribute');
      }
    }
  };

  const globalAttributes = fullEntityType?.attributes?.filter(a => a.name !== 'content' && a.name !== 'name' && a.name !== 'title') || [];
  const nodeAttributes = fullEntity?.values?.custom_attributes_schema || entity.values?.custom_attributes_schema || [];

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[#F8FAFC]">
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xl font-semibold text-[#0F172A]">{Object.values(vals)[0] || entity.displayId}</span>
              <StatusBadge status={status} />
              <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded font-medium">{typeName}</span>
            </div>
            <div className="text-xs text-gray-500">
              ID: {entity.displayId} · Owner: {getFieldValue('owner') || '—'} · Version: {getFieldValue('version') || 1}
            </div>
          </div>
          <div className="flex gap-2">
            {saving && <span className="text-xs text-gray-400 self-center mr-2">Processing...</span>}
            
            {/* Action Buttons based on Workflow Role */}
            {role === 'sme' && status === 'draft' && (
              <button onClick={() => handleStatusChange('in_review')} className="text-xs px-3 py-1.5 bg-amber-100 text-amber-700 font-medium rounded hover:bg-amber-200">
                Submit for Review
              </button>
            )}
            {role === 'reviewer' && status === 'in_review' && (
              <>
                <button onClick={() => handleStatusChange('approved')} className="text-xs px-3 py-1.5 bg-green-100 text-green-700 font-medium rounded hover:bg-green-200">
                  Approve
                </button>
                <button onClick={() => handleStatusChange('draft')} className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 font-medium rounded hover:bg-gray-200">
                  Send Back
                </button>
              </>
            )}
            {role === 'admin' && status === 'approved' && (
              <button onClick={() => handleStatusChange('published')} className="text-xs px-3 py-1.5 bg-[#e13f00] text-white font-medium rounded hover:bg-[#9d0102]">
                Publish Content
              </button>
            )}
          </div>
        </div>

        {/* Metadata Block */}
        <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider">Metadata</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Entity ID</div>
              <div className="text-sm font-medium text-gray-900">{entity.displayId}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Version</div>
              <div className="text-sm font-medium text-gray-900">v{entity.version || 1}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Created Date</div>
              <div className="text-sm font-medium text-gray-900">
                {entity.createdAt ? new Date(entity.createdAt).toLocaleDateString() : '—'}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Reviewer Assignment</div>
              <div className="text-sm font-medium text-gray-900">
                {getFieldValue('assigned_reviewer') || <span className="text-gray-400 italic">Unassigned</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Assigned Reviewer Edit (Admin / SME) */}
        {(role === 'admin' || role === 'sme') && (
           <div className="mb-6">
             <EditableSection 
               label="Assign Reviewer (Email)" 
               field="assigned_reviewer" 
               value={getFieldValue('assigned_reviewer')} 
               canEdit={true} 
               onSave={handleSaveField} 
             />
           </div>
        )}

        {/* Dynamic Schema Fields */}
        <div className="space-y-6 mb-8">
          
          {/* Global Attributes */}
          {globalAttributes.length > 0 && globalAttributes.map(attr => (
            <EditableSection 
              key={attr.id} 
              label={getFieldLabel(attr.name)} 
              field={attr.name} 
              value={getFieldValue(attr.name)} 
              canEdit={canEdit} 
              onSave={handleSaveField} 
              role={role}
              onDelete={() => handleDeleteAttribute(attr.id, false)}
            />
          ))}

          {/* Node-Specific Attributes */}
          {nodeAttributes.length > 0 && nodeAttributes.map(attr => (
            <EditableSection 
              key={attr.id} 
              label={getFieldLabel(attr.name) + ' (Custom)'} 
              field={attr.name} 
              value={getFieldValue(attr.name)} 
              canEdit={canEdit} 
              onSave={handleSaveField} 
              role={role}
              onDelete={() => handleDeleteAttribute(attr.id, true)}
            />
          ))}

          {globalAttributes.length === 0 && nodeAttributes.length === 0 && (
            <div className="text-sm text-gray-500 italic">No attributes defined.</div>
          )}

          {role === 'admin' && (
            <button 
              onClick={handleAddAttribute}
              className="mt-4 text-xs font-medium text-[#e13f00] border border-[#e13f00] px-3 py-1.5 rounded hover:bg-orange-50"
            >
              + Add Attribute to this Node
            </button>
          )}
        </div>

        {/* Attachments */}
        <div>
          <h3 className="text-sm font-bold text-gray-800 mb-3 border-b pb-2">Attachments</h3>
          <AttachmentsTab entityId={entity.id} projectId={projectId} canEdit={canEdit} />
        </div>

      </div>
    </div>
  );
}

function EditableSection({ label, field, value, canEdit, onSave, role, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');

  return (
    <div className="border border-gray-200 rounded overflow-hidden">
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center group">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</span>
          {role === 'admin' && onDelete && (
            <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-red-500 text-xs px-1 hover:bg-red-100 rounded" title="Delete Attribute Schema">🗑</button>
          )}
        </div>
        {canEdit && !editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-gray-500 hover:text-[#e13f00]">Edit</button>
        )}
      </div>
      <div className="p-4 text-sm text-gray-700">
        {editing ? (
          <div>
            <textarea 
              value={draft} 
              onChange={e => setDraft(e.target.value)} 
              className="w-full border rounded p-2 text-sm outline-none focus:border-[#e13f00]"
              rows={4}
            />
            <div className="flex gap-2 mt-2 justify-end">
              <button onClick={() => setEditing(false)} className="text-xs text-gray-500 px-3 py-1 bg-gray-100 rounded">Cancel</button>
              <button onClick={() => { onSave(field, draft); setEditing(false); }} className="text-xs text-white px-3 py-1 bg-[#e13f00] rounded">Save</button>
            </div>
          </div>
        ) : (
          <div className="whitespace-pre-wrap leading-relaxed">
            {value || <span className="text-gray-400 italic">No {label.toLowerCase()} defined.</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function AttachmentsTab({ entityId, projectId, canEdit }) {
  const fileRef = useRef();

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !projectId) return;

    const fd = new FormData();
    fd.append('file', file);
    // KTern expects multipart/form-data for attachments
    try {
      const res = await fetch(`/api/projects/${projectId}/entities/${entityId}/attachments/upload`, {
        method: 'POST',
        body: fd
      });
      if (res.ok) alert('File uploaded successfully via POST!');
      else alert('Failed to upload file');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-4 border border-dashed rounded text-center">
      <div className="text-sm text-gray-500 mb-4">API integration for file attachments active.</div>
      {canEdit && (
        <>
          <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
          <button 
            onClick={() => fileRef.current?.click()}
            className="text-xs bg-white border border-[#e13f00] text-[#e13f00] px-4 py-2 rounded hover:bg-orange-50 font-medium"
          >
            Upload File (Simulates POST)
          </button>
        </>
      )}
    </div>
  );
}



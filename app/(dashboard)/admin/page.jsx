'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState([]);
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDesc, setNewTemplateDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchProjects = () => {
    setLoading(true);
    fetch('/api/projects')
      .then(async (res) => {
        const text = await res.text();
        return text ? JSON.parse(text) : {};
      })
      .then(data => {
        const list = Array.isArray(data) ? data : data.items || data.entities || [];
        const templates = list.filter(p => p.methodology === 'SOP_TEMPLATE');
        const insts = list.filter(p => p.methodology === 'SOP_INSTANCE');
        setProjects(templates);
        setInstances(insts);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleSelectProject = (project) => {
    sessionStorage.setItem('ktern_project_id', project.id);
    router.push(`/admin/workspace?projectId=${project.id}`);
  };

  const handleDeleteProject = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setProjects(projects.filter(p => p.id !== id));
      } else {
        alert('Failed to delete project');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    if (!newTemplateName.trim()) return;
    
    setCreating(true);
    try {
      const slug = newTemplateName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTemplateName.trim(),
          description: newTemplateDesc.trim() || 'SOP Template',
          methodology: 'SOP_TEMPLATE',
          slug: slug
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to create template');
      }

      const newProj = await res.json();
      
      // Bootstrap the Entity Types for the new template
      const defaultTypes = [
        { name: 'Wave', prefix: 'WAV', level: 100 },
        { name: 'Phase', prefix: 'PHS', level: 200 },
        { name: 'Milestone', prefix: 'MIL', level: 300 },
        { name: 'Deliverable', prefix: 'DEL', level: 400 }
      ];

      for (const t of defaultTypes) {
        await fetch(`/api/projects/${newProj.id}/entity-types`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: t.name,
            idPrefix: t.prefix,
            hasStatusWorkflow: false,
            statusWorkflow: [],
            attributes: [{ id: 'content', name: 'content', type: 'STRING', required: true }]
          })
        });
      }

      setShowModal(false);
      setNewTemplateName('');
      setNewTemplateDesc('');
      router.push(`/admin/workspace?projectId=${newProj.id}`);
    } catch (err) {
      console.error(err);
      alert('Error creating template: ' + err.message);
      setCreating(false);
    }
  };

  return (
    <div className="h-full p-8 overflow-auto">
      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold mb-4">Create New Template</h2>
            <form onSubmit={handleCreateTemplate}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
                <input 
                  type="text" 
                  value={newTemplateName}
                  onChange={e => setNewTemplateName(e.target.value)}
                  className="w-full border rounded px-3 py-2 outline-none focus:border-[#e13f00]"
                  placeholder="e.g. Activate Methodology"
                  required
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea 
                  value={newTemplateDesc}
                  onChange={e => setNewTemplateDesc(e.target.value)}
                  className="w-full border rounded px-3 py-2 outline-none focus:border-[#e13f00] resize-none h-20"
                  placeholder="Optional description"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={creating}
                  className="px-4 py-2 bg-[#e13f00] text-white rounded hover:bg-[#c23600] disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Template Library</h1>
            <p className="text-gray-500 text-sm mt-1">Manage SOP templates and structural schemas</p>
          </div>
          <button 
            onClick={() => setShowModal(true)}
            className="bg-[#e13f00] hover:bg-[#c23600] text-white px-4 py-2 rounded-md font-medium transition-colors shadow-sm flex items-center gap-2"
          >
            <span className="text-lg leading-none">+</span> Create Template
          </button>
        </div>

        {loading ? (
          <div className="text-gray-500">Loading templates...</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16 bg-white border border-gray-200 border-dashed rounded-xl">
            <h3 className="text-lg font-medium text-gray-900 mb-1">No Templates Found</h3>
            <p className="text-gray-500 text-sm mb-4">Get started by creating your first SOP methodology template.</p>
            <button 
              onClick={() => setShowModal(true)}
              className="text-[#e13f00] font-medium hover:underline"
            >
              Create Template
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map(p => (
              <div 
                key={p.id}
                onClick={() => handleSelectProject(p)}
                className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-[#e13f00] transition-all cursor-pointer group flex flex-col h-48"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-100 text-[#e13f00] flex items-center justify-center font-bold text-xl">
                    {p.name ? p.name.charAt(0).toUpperCase() : 'T'}
                  </div>
                  <button 
                    onClick={(e) => handleDeleteProject(p.id, e)}
                    className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                  >
                    🗑
                  </button>
                </div>
                <h3 className="font-semibold text-lg text-gray-900 line-clamp-1">{p.name || p.displayId}</h3>
                <p className="text-sm text-gray-500 line-clamp-2 mt-2 flex-1">
                  {p.description || 'No description provided.'}
                </p>
                <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-400 font-mono">
                  ID: {p.id.split('-')[0]}...
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mb-8 mt-16">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">SOP Instances (Pending Publication)</h2>
            <p className="text-gray-500 text-sm mt-1">Review approved content from SMEs and publish to consumers.</p>
          </div>
        </div>

        {loading ? (
          <div className="text-gray-500">Loading instances...</div>
        ) : instances.length === 0 ? (
          <div className="text-center py-16 bg-white border border-gray-200 border-dashed rounded-xl">
            <h3 className="text-lg font-medium text-gray-900 mb-1">No Active Instances</h3>
            <p className="text-gray-500 text-sm mb-4">SMEs haven't created any SOP instances yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {instances.map(p => (
              <div 
                key={p.id}
                onClick={() => handleSelectProject(p)}
                className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-[#e13f00] transition-all cursor-pointer group flex flex-col h-48"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xl">
                    {p.name ? p.name.charAt(0).toUpperCase() : 'I'}
                  </div>
                  <button 
                    onClick={(e) => handleDeleteProject(p.id, e)}
                    className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                  >
                    🗑
                  </button>
                </div>
                <h3 className="font-semibold text-lg text-gray-900 line-clamp-1">{p.name || p.displayId}</h3>
                <p className="text-sm text-gray-500 line-clamp-2 mt-2 flex-1">
                  {p.description || 'Active SOP Instance'}
                </p>
                <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-400 font-mono">
                  ID: {p.id.split('-')[0]}...
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function StatusBadge({ status }) {
  if (!status) return null;

  const statusConfig = {
    draft: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Draft' },
    in_review: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'In Review' },
    approved: { bg: 'bg-green-100', text: 'text-green-700', label: 'Approved' },
    published: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Published' },
  };

  const config = statusConfig[status.toLowerCase()] || { bg: 'bg-gray-100', text: 'text-gray-700', label: status };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}

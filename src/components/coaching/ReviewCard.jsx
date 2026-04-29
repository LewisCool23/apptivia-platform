import React from 'react';
import { Eye, Edit, Trash2, Calendar, Star } from 'lucide-react';
import { reviewStatusConfig, reviewTypes } from './reviewStatusConfig';

export default function ReviewCard({ review, canManage, teamMembers, onView, onEdit, onDelete }) {
  const cfg = reviewStatusConfig[review.status] || reviewStatusConfig.draft;
  const StatusIcon = cfg.icon;
  const typeLabel = reviewTypes[review.review_type]?.shortLabel || review.review_type;

  const repName = teamMembers?.find(m => m.id === review.profile_id);
  const repLabel = repName ? (repName.full_name || repName.email) : 'Unknown Rep';

  const ratingStars = review.final_rating || review.manager_rating;

  return (
    <div className={`border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow flex flex-col border-l-4 ${cfg.borderColor}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900 mb-1">{review.title}</h4>
          <p className="text-xs text-gray-500">{repLabel}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`px-2 py-0.5 text-[10px] rounded-full font-semibold ${
            review.review_type === 'annual' ? 'bg-apptivia-carbon-100 text-purple-700' : 'bg-apptivia-coral-tone-50 text-blue-700'
          }`}>
            {typeLabel}
          </span>
        </div>
      </div>

      {/* Date range */}
      {review.period_start && review.period_end && (
        <div className="flex items-center gap-1.5 mb-2 text-xs text-gray-500">
          <Calendar size={12} />
          <span>{new Date(review.period_start).toLocaleDateString()} — {new Date(review.period_end).toLocaleDateString()}</span>
        </div>
      )}

      {/* Rating */}
      {ratingStars && (
        <div className="flex items-center gap-1 mb-2">
          {[1, 2, 3, 4, 5].map(i => (
            <Star key={i} size={14} className={i <= ratingStars ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'} />
          ))}
          <span className="text-xs text-gray-500 ml-1">{ratingStars}/5</span>
        </div>
      )}

      {/* Status badge */}
      <div className="mb-3">
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
          <StatusIcon size={12} /> {cfg.label}
        </span>
      </div>

      <div className="flex-grow" />

      {/* Actions */}
      <div className="flex gap-2">
        <button onClick={() => onView(review)}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-600 border border-blue-600 rounded-md hover:bg-apptivia-coral-tone-50">
          <Eye size={14} /> View
        </button>
        {canManage && review.status === 'draft' && (
          <>
            <button onClick={() => onEdit(review)}
              className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-300 rounded-md hover:bg-apptivia-paper" title="Edit">
              <Edit size={14} />
            </button>
            <button onClick={() => onDelete(review)}
              className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-300 rounded-md hover:bg-red-50" title="Delete">
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

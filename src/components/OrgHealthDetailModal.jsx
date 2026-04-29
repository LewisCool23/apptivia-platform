import React from 'react';
import { X, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Shared detail modal for Org Health Scorecard dimensions.
 * Shows score, explanation, score components, and live data summary.
 */
export default function OrgHealthDetailModal({
  isOpen,
  onClose,
  title,
  score,
  scoreColors,
  icon: Icon,
  explanation,
  dataPoints,
  dataSummary,
  linkTo,
  linkLabel,
}) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-6 py-5 flex items-center justify-between ${scoreColors?.bg || 'bg-apptivia-carbon-100'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/80">
              {Icon && <Icon size={20} className={scoreColors?.text || 'text-apptivia-carbon-700'} />}
            </div>
            <div>
              <h2 className={`text-lg font-bold ${scoreColors?.text || 'text-apptivia-ink'}`}>{title}</h2>
              <p className="text-xs text-apptivia-carbon-500">Org Health Dimension</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-3xl font-bold ${scoreColors?.text || 'text-apptivia-ink'}`}>{score}</span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-black/10 transition-colors text-apptivia-carbon-500"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Explanation */}
          <div>
            <h3 className="text-sm font-semibold text-apptivia-ink mb-1.5">What This Measures</h3>
            <p className="text-xs text-apptivia-carbon-600 leading-relaxed">{explanation}</p>
          </div>

          {/* Data Points */}
          {dataPoints?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-apptivia-ink mb-2">Score Components</h3>
              <ul className="space-y-1.5">
                {dataPoints.map((dp, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-apptivia-carbon-600">
                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-apptivia-carbon-400 flex-shrink-0" />
                    {dp}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Live Data Summary */}
          {dataSummary?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-apptivia-ink mb-2">Current Data</h3>
              <div className="bg-apptivia-paper rounded-lg p-3 grid grid-cols-2 gap-3">
                {dataSummary.map((item, i) => (
                  <div key={i}>
                    <div className="text-[10px] text-apptivia-carbon-500 uppercase">{item.label}</div>
                    <div className="text-sm font-bold text-apptivia-ink">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-apptivia-paper border-t flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-apptivia-carbon-500 hover:text-apptivia-carbon-700"
          >
            Close
          </button>
          <button
            onClick={() => { onClose(); navigate(linkTo); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-apptivia-coral hover:bg-apptivia-coral transition-colors"
          >
            {linkLabel} <ArrowRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

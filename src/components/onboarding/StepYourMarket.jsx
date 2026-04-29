import React, { useState, useRef, useEffect } from 'react';
import { Target, Plus, X, ChevronDown, Sparkles } from 'lucide-react';
import { validateMarket, INDUSTRY_OPTIONS } from './onboardingConstants';

// ── Industry-specific suggestions ────────────────────────────────────────────
const INDUSTRY_SUGGESTIONS = {
  'Technology / SaaS': {
    pain_points: ['Disconnected sales tech stack', 'Low CRM adoption', 'Pipeline visibility gaps', 'Rep ramp time too long', 'Inaccurate forecasting', 'Missed follow-ups'],
    solution_keywords: ['sales performance management', 'revenue intelligence', 'sales coaching platform', 'pipeline management', 'sales enablement', 'revenue operations'],
    job_titles_to_track: ['VP of Sales', 'CRO', 'Head of Revenue Operations', 'Sales Director', 'VP Business Development', 'Head of Sales Enablement'],
    tech_stack_churning: ['Gong', 'Outreach', 'Salesloft', 'Ambition', 'InsightSquared', 'Clari'],
    target_technologies: ['Salesforce', 'HubSpot', 'Outreach', 'ZoomInfo', 'Gong', 'Marketo', 'Slack'],
  },
  'Construction': {
    pain_points: ['Manual bid tracking', 'Long sales cycles', 'Poor project pipeline visibility', 'Subcontractor coordination delays', 'Missed RFP deadlines', 'Disconnected field and office teams', 'Change order management chaos', 'Inaccurate cost estimation', 'Safety compliance tracking gaps', 'Lack of real-time field reporting', 'Material procurement delays', 'Workforce scheduling conflicts'],
    solution_keywords: ['construction bid management', 'project estimation software', 'construction CRM', 'contractor management platform', 'preconstruction tools', 'construction project management', 'takeoff software', 'construction scheduling', 'construction accounting', 'building information modeling', 'construction document management', 'field service management'],
    job_titles_to_track: ['VP of Business Development', 'Estimating Manager', 'Director of Preconstruction', 'Project Director', 'Chief Estimator', 'VP of Operations', 'Construction Technology Manager', 'Director of Construction', 'VP of Preconstruction', 'Head of IT', 'Procurement Director', 'Safety Director', 'CFO', 'COO'],
    tech_stack_churning: ['Procore', 'PlanGrid', 'BuilderTREND', 'CoConstruct', 'Sage 300', 'Viewpoint Vista', 'CMiC', 'Foundation Software', 'ComputerEase', 'RedTeam', 'Jonas Construction', 'ConstructConnect'],
    target_technologies: ['Procore', 'Bluebeam', 'AutoCAD', 'Autodesk', 'Sage Construction', 'Viewpoint', 'PlanGrid', 'BuilderTREND', 'Revit', 'Navisworks', 'Primavera P6', 'Microsoft Project', 'Trimble', 'Fieldwire', 'Raken', 'Buildertrend'],
  },
  'Financial Services': {
    pain_points: ['Compliance-heavy sales processes', 'Slow deal approvals', 'Client retention risk', 'Manual reporting', 'Cross-sell visibility gaps'],
    solution_keywords: ['financial CRM', 'wealth management platform', 'client relationship management', 'compliance automation', 'financial planning software'],
    job_titles_to_track: ['VP of Sales', 'Managing Director', 'Head of Business Development', 'Chief Revenue Officer', 'Regional Sales Manager'],
    tech_stack_churning: ['Wealthbox', 'Redtail', 'Junxure', 'Orion', 'Advyzon'],
    target_technologies: ['Salesforce Financial Cloud', 'Bloomberg', 'FactSet', 'Morningstar', 'SS&C'],
  },
  'Healthcare': {
    pain_points: ['Long procurement cycles', 'Multi-stakeholder decisions', 'Regulatory compliance barriers', 'Budget constraints', 'Legacy system integration'],
    solution_keywords: ['healthcare sales enablement', 'medical device CRM', 'health tech platform', 'clinical workflow automation', 'patient engagement'],
    job_titles_to_track: ['VP of Sales', 'Director of Business Development', 'Chief Medical Officer', 'VP of IT', 'Director of Procurement'],
    tech_stack_churning: ['Epic', 'Cerner', 'Athenahealth', 'Allscripts', 'Meditech'],
    target_technologies: ['Epic', 'Salesforce Health Cloud', 'Veeva', 'Cerner', 'Athenahealth'],
  },
  'Manufacturing': {
    pain_points: ['Complex quoting processes', 'Long lead times', 'Channel partner management', 'Custom order tracking', 'Distributor relationship gaps'],
    solution_keywords: ['manufacturing CRM', 'configure price quote', 'industrial sales platform', 'distributor management', 'supply chain optimization'],
    job_titles_to_track: ['VP of Sales', 'Director of Channel Sales', 'Regional Sales Manager', 'VP of Operations', 'Head of Distribution'],
    tech_stack_churning: ['SAP', 'Oracle', 'Epicor', 'Infor', 'NetSuite'],
    target_technologies: ['SAP', 'Oracle', 'Epicor', 'NetSuite', 'Infor', 'Siemens PLM'],
  },
  'Insurance': {
    pain_points: ['Slow underwriting turnaround', 'Agent productivity tracking', 'Policy renewal management', 'Multi-carrier quoting', 'Claims process bottlenecks'],
    solution_keywords: ['insurance CRM', 'agency management system', 'policy administration platform', 'insurance sales automation', 'underwriting platform'],
    job_titles_to_track: ['VP of Sales', 'Agency Director', 'Head of Distribution', 'Regional Manager', 'Director of Business Development'],
    tech_stack_churning: ['Applied Epic', 'Vertafore', 'HawkSoft', 'EZLynx', 'AgencyZoom'],
    target_technologies: ['Applied Epic', 'Vertafore', 'Guidewire', 'Duck Creek', 'Salesforce Financial Cloud'],
  },
  'Real Estate': {
    pain_points: ['Lead response time too slow', 'Poor lead qualification', 'Agent productivity tracking', 'Client communication gaps', 'Transaction management complexity'],
    solution_keywords: ['real estate CRM', 'property management platform', 'lead management', 'transaction management', 'real estate marketing automation'],
    job_titles_to_track: ['VP of Sales', 'Broker', 'Director of Leasing', 'Head of Acquisitions', 'Managing Director'],
    tech_stack_churning: ['Yardi', 'RealPage', 'CoStar', 'Buildout', 'Follow Up Boss'],
    target_technologies: ['Yardi', 'CoStar', 'RealPage', 'Salesforce', 'MRI Software'],
  },
  'Professional Services': {
    pain_points: ['Utilization tracking', 'Project scoping accuracy', 'Client relationship management', 'Proposal automation', 'Resource allocation visibility'],
    solution_keywords: ['professional services automation', 'project management platform', 'consulting CRM', 'resource management', 'time and billing software'],
    job_titles_to_track: ['Managing Partner', 'VP of Business Development', 'Director of Client Services', 'Head of Consulting', 'Practice Lead'],
    tech_stack_churning: ['Mavenlink', 'FinancialForce', 'Clarizen', 'Kimble', 'NetSuite OpenAir'],
    target_technologies: ['Salesforce', 'HubSpot', 'NetSuite', 'Mavenlink', 'Monday.com'],
  },
  'Retail / E-Commerce': {
    pain_points: ['Omnichannel sales complexity', 'Customer retention challenges', 'Inventory-sales misalignment', 'Seasonal demand forecasting', 'Vendor management overhead'],
    solution_keywords: ['retail analytics', 'e-commerce platform', 'omnichannel sales', 'customer data platform', 'demand planning'],
    job_titles_to_track: ['VP of Sales', 'Head of E-Commerce', 'Director of Retail Operations', 'Chief Merchandising Officer', 'VP of Business Development'],
    tech_stack_churning: ['Shopify', 'Magento', 'BigCommerce', 'WooCommerce', 'Salesforce Commerce Cloud'],
    target_technologies: ['Shopify', 'Salesforce Commerce Cloud', 'SAP Retail', 'Oracle Retail', 'NetSuite'],
  },
  'Education': {
    pain_points: ['Long enrollment cycles', 'Budget approval complexity', 'Multi-stakeholder committees', 'Procurement process delays', 'Vendor consolidation pressure'],
    solution_keywords: ['education technology platform', 'learning management system', 'student information system', 'edtech CRM', 'enrollment management'],
    job_titles_to_track: ['VP of Sales', 'Director of Partnerships', 'Head of Business Development', 'Chief Academic Officer', 'Director of IT'],
    tech_stack_churning: ['Blackboard', 'Canvas', 'PowerSchool', 'Infinite Campus', 'Ellucian'],
    target_technologies: ['Canvas', 'Blackboard', 'PowerSchool', 'Salesforce Education Cloud', 'Ellucian'],
  },
  '_default': {
    pain_points: ['Disconnected sales tools', 'Pipeline visibility gaps', 'Missed follow-ups', 'Inaccurate forecasting', 'Long sales cycles', 'Low rep productivity'],
    solution_keywords: ['sales performance management', 'CRM platform', 'sales enablement', 'revenue operations', 'pipeline management'],
    job_titles_to_track: ['VP of Sales', 'Sales Director', 'CRO', 'Head of Business Development', 'Regional Sales Manager'],
    tech_stack_churning: ['Salesforce', 'HubSpot', 'Outreach', 'Gong', 'Salesloft'],
    target_technologies: ['Salesforce', 'HubSpot', 'Microsoft Dynamics', 'Outreach', 'ZoomInfo'],
  },
};

function getSuggestions(industry, field) {
  const map = INDUSTRY_SUGGESTIONS[industry] || INDUSTRY_SUGGESTIONS['_default'];
  return map[field] || INDUSTRY_SUGGESTIONS['_default'][field] || [];
}

// ── Enhanced TagField with multi-select dropdown ─────────────────────────────

function TagField({ label, hint, items, onAdd, onRemove, placeholder, tagClass = 'bg-apptivia-coral-tone-50 text-apptivia-coral', required, suggestions = [] }) {
  const [value, setValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  const filtered = suggestions.filter(
    (s) => !items.includes(s) && (!value || s.toLowerCase().includes(value.toLowerCase()))
  );

  const handleAdd = (val) => {
    const trimmed = (val || value).trim();
    if (!trimmed || items.includes(trimmed)) return;
    onAdd(trimmed);
    setValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }
    if (e.key === 'Escape') setIsOpen(false);
  };

  const handleSelect = (suggestion) => {
    onAdd(suggestion);
    setValue('');
    // Keep dropdown open for multi-select
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const hasSuggestions = suggestions.length > 0;

  return (
    <div ref={wrapperRef}>
      <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {hint && <p className="text-xs text-apptivia-carbon-400 mb-1.5">{hint}</p>}
      <div className="relative">
        <div className="flex gap-2 mb-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={value}
              onChange={(e) => { setValue(e.target.value); if (hasSuggestions) setIsOpen(true); }}
              onFocus={() => { if (hasSuggestions) setIsOpen(true); }}
              onKeyDown={handleKeyDown}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${hasSuggestions ? 'pr-8' : ''}`}
              placeholder={placeholder}
            />
            {hasSuggestions && (
              <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-apptivia-carbon-400 hover:text-apptivia-carbon-600"
                tabIndex={-1}
              >
                <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => handleAdd()}
            className="px-3 py-2 bg-apptivia-carbon-100 hover:bg-apptivia-carbon-200 text-apptivia-carbon-600 rounded-lg text-sm"
            title="Add custom value"
          >
            <Plus size={14} />
          </button>
        </div>
        {isOpen && filtered.length > 0 && (
          <div className="absolute z-10 w-[calc(100%-3rem)] bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto -mt-1">
            {filtered.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(suggestion)}
                className="w-full text-left px-3 py-1.5 text-sm text-apptivia-carbon-700 hover:bg-apptivia-coral-tone-50 hover:text-apptivia-coral transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, i) => (
            <span key={i} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${tagClass}`}>
              {item}
              <button type="button" onClick={() => onRemove(i)} className="hover:opacity-70">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function StepYourMarket({ wizardState, updateState }) {
  const { icpConfig, signalConfig } = wizardState;
  const industry = wizardState.orgData?.industry || '';

  // Safely coerce to arrays (handles old string-format drafts)
  const targetIndustries = Array.isArray(icpConfig.target_industries)
    ? icpConfig.target_industries
    : (icpConfig.target_industries || '').split(',').map(s => s.trim()).filter(Boolean);
  const targetTechnologies = Array.isArray(icpConfig.target_technologies)
    ? icpConfig.target_technologies
    : (icpConfig.target_technologies || '').split(',').map(s => s.trim()).filter(Boolean);

  // ICP array field handlers
  const addIcpItem = (field, value) => {
    const current = Array.isArray(icpConfig[field]) ? icpConfig[field] : [];
    updateState({ icpConfig: { ...icpConfig, [field]: [...current, value] } });
  };

  const removeIcpItem = (field, index) => {
    const current = Array.isArray(icpConfig[field]) ? icpConfig[field] : [];
    updateState({ icpConfig: { ...icpConfig, [field]: current.filter((_, i) => i !== index) } });
  };

  // ICP string field handler
  const updateIcp = (field, value) => {
    updateState({ icpConfig: { ...icpConfig, [field]: value } });
  };

  // Signal config handlers
  const addSignalItem = (field, value) => {
    updateState({
      signalConfig: { ...signalConfig, [field]: [...signalConfig[field], value] },
    });
  };

  const removeSignalItem = (field, index) => {
    updateState({
      signalConfig: { ...signalConfig, [field]: signalConfig[field].filter((_, i) => i !== index) },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-apptivia-carbon-100 rounded-lg flex items-center justify-center">
          <Target size={20} className="text-apptivia-ink" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-apptivia-ink">Your Market</h3>
          <p className="text-sm text-apptivia-carbon-500">
            Define your ideal customer and buyer signals — this powers Engage prospecting, Aaron AI coaching, and manager playbooks
          </p>
        </div>
      </div>

      {industry && (
        <div className="flex items-center gap-2 text-xs text-apptivia-ink bg-apptivia-carbon-100 px-3 py-2 rounded-lg">
          <Sparkles size={14} />
          <span>Suggestions pre-loaded for <strong>{industry}</strong> — select from dropdowns or type custom values</span>
        </div>
      )}

      {/* ICP Section */}
      <div className="bg-apptivia-coral-tone-50/50 border border-blue-100 rounded-lg p-4 space-y-4">
        <h4 className="text-sm font-semibold text-apptivia-coral-tone-700 uppercase tracking-wide">Ideal Customer Profile</h4>

        <TagField
          label="Target Industries"
          hint="Industries your ideal customers operate in"
          items={targetIndustries}
          onAdd={(v) => addIcpItem('target_industries', v)}
          onRemove={(i) => removeIcpItem('target_industries', i)}
          suggestions={INDUSTRY_OPTIONS.filter((o) => o !== 'Other')}
          placeholder="Search or type an industry..."
          tagClass="bg-apptivia-coral-tone-50 text-apptivia-coral"
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">Headcount Min</label>
            <input
              type="number"
              value={icpConfig.headcount_min}
              onChange={(e) => updateIcp('headcount_min', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">Headcount Max</label>
            <input
              type="number"
              value={icpConfig.headcount_max}
              onChange={(e) => updateIcp('headcount_max', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">Revenue Min ($M)</label>
            <input
              type="number"
              value={icpConfig.revenue_min_m}
              onChange={(e) => updateIcp('revenue_min_m', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="5"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">Revenue Max ($M)</label>
            <input
              type="number"
              value={icpConfig.revenue_max_m}
              onChange={(e) => updateIcp('revenue_max_m', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="100"
            />
          </div>
        </div>

        <TagField
          label="Target Technologies"
          hint="Tech stack your ideal customers use — helps identify accounts"
          items={targetTechnologies}
          onAdd={(v) => addIcpItem('target_technologies', v)}
          onRemove={(i) => removeIcpItem('target_technologies', i)}
          suggestions={getSuggestions(industry, 'target_technologies')}
          placeholder="Search or type a technology..."
          tagClass="bg-apptivia-coral-tone-50 text-apptivia-coral"
        />
      </div>

      {/* Signal Config Section */}
      <div className="bg-emerald-50/50 border border-emerald-100 rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-emerald-800 uppercase tracking-wide">Buyer Signals & Competitive Intelligence</h4>
          <span className="text-xs text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full font-medium">45+ built-in signals</span>
        </div>

        <TagField
          label="Pain Points You Solve"
          hint="Problems your product addresses — Engage will find companies expressing these"
          items={signalConfig.pain_points}
          onAdd={(v) => addSignalItem('pain_points', v)}
          onRemove={(i) => removeSignalItem('pain_points', i)}
          suggestions={getSuggestions(industry, 'pain_points')}
          placeholder="Select or type a pain point..."
          tagClass="bg-emerald-100 text-emerald-700"
          required
        />

        <TagField
          label="Competitors"
          hint="We'll track companies mentioning or using your competitors"
          items={signalConfig.competitors}
          onAdd={(v) => addSignalItem('competitors', v)}
          onRemove={(i) => removeSignalItem('competitors', i)}
          placeholder="e.g. Gong, Salesforce"
          tagClass="bg-red-100 text-red-700"
        />

        <TagField
          label="Solution Keywords"
          hint="Terms buyers search when looking for your type of solution"
          items={signalConfig.solution_keywords}
          onAdd={(v) => addSignalItem('solution_keywords', v)}
          onRemove={(i) => removeSignalItem('solution_keywords', i)}
          suggestions={getSuggestions(industry, 'solution_keywords')}
          placeholder="Select or type a keyword..."
          tagClass="bg-apptivia-coral-tone-50 text-apptivia-coral"
        />

        <TagField
          label="Job Titles to Track"
          hint="Hiring for these roles signals they may need your product"
          items={signalConfig.job_titles_to_track}
          onAdd={(v) => addSignalItem('job_titles_to_track', v)}
          onRemove={(i) => removeSignalItem('job_titles_to_track', i)}
          suggestions={getSuggestions(industry, 'job_titles_to_track')}
          placeholder="Select or type a job title..."
          tagClass="bg-apptivia-carbon-100 text-apptivia-ink"
        />

        <TagField
          label="Tech Stack Churn Signals"
          hint="Companies leaving these tools may be open to switching"
          items={signalConfig.tech_stack_churning}
          onAdd={(v) => addSignalItem('tech_stack_churning', v)}
          onRemove={(i) => removeSignalItem('tech_stack_churning', i)}
          suggestions={getSuggestions(industry, 'tech_stack_churning')}
          placeholder="Select or type a tool..."
          tagClass="bg-amber-100 text-amber-700"
        />
      </div>
    </div>
  );
}

StepYourMarket.validate = (wizardState) =>
  validateMarket(wizardState.icpConfig, wizardState.signalConfig);

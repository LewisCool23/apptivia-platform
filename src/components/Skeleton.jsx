import React from 'react';

// Reusable skeleton component for loading states
export const Skeleton = ({ className = '', variant = 'default' }) => {
  const baseClasses = 'animate-pulse bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] rounded';
  
  const variantClasses = {
    default: 'h-4 w-full',
    text: 'h-4 w-3/4',
    title: 'h-8 w-1/2',
    circle: 'rounded-full',
    button: 'h-10 w-24',
    card: 'h-32 w-full',
  };

  return (
    <div 
      className={`${baseClasses} ${variantClasses[variant] || variantClasses.default} ${className}`}
      style={{
        animation: 'shimmer 2s infinite',
      }}
    />
  );
};

// Skeleton for stat cards
export const StatCardSkeleton = () => (
  <div className="bg-white rounded-xl p-4 flex flex-col items-start justify-center space-y-2">
    <Skeleton className="h-3 w-20" />
    <Skeleton className="h-6 w-32" />
    <Skeleton className="h-3 w-24" />
  </div>
);

// Skeleton for table rows
export const TableRowSkeleton = ({ columns = 5 }) => (
  <tr className="border-b border-gray-100">
    {Array.from({ length: columns }).map((_, i) => (
      <td key={i} className="px-2 py-3">
        <Skeleton className="h-4 w-full" />
      </td>
    ))}
  </tr>
);

// Skeleton for skillset cards
export const SkillsetCardSkeleton = () => (
  <div className="border-2 border-gray-100 rounded-xl p-6 space-y-4">
    <div className="flex items-center gap-3">
      <Skeleton className="w-12 h-12 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-3 w-full" />
      </div>
    </div>
    <div className="space-y-2">
      <Skeleton className="h-2 w-full rounded-full" />
      <div className="flex justify-between">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
    <Skeleton className="h-20 w-full rounded-lg" />
    <Skeleton className="h-10 w-full rounded-lg" />
  </div>
);

// Add shimmer animation to index.css
export default Skeleton;

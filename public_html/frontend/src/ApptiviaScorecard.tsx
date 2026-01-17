import React, { useState } from 'react';
import { 
  Plus, Settings, TrendingUp, Users, Calendar, Phone, Target, Download, Filter, X, Home, Trophy, 
  MessageCircle, Mail, GitBranch, CheckSquare, Menu, User, Gamepad2, Bot, Camera, Save, 
  UserPlus, Trash2, Edit, BarChart3
} from 'lucide-react';

// Custom circular progress component
interface CircularProgressProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  children?: React.ReactNode;
}
const CircularProgress = ({ progress, size = 80, strokeWidth = 8, color = '#3B82F6', children }: CircularProgressProps) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative inline-block">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-gray-200"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-300 ease-in-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}
// ...existing code...

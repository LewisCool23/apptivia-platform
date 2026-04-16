import { ReactNode, JSX } from 'react';

interface TooltipProps {
  children: ReactNode;
  text: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  wide?: boolean;
}

export default function Tooltip(props: TooltipProps): JSX.Element;

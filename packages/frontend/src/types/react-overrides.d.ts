// Temporary fix for React type mismatches with heroicons and recharts
import React from 'react';

declare module 'react' {
  // Ensure ReactNode types are compatible
  type ReactNode = React.ReactNode;
}

// Fix heroicons type compatibility
declare module '@heroicons/react/24/outline' {
  import { FC, SVGProps } from 'react';
  export const WifiIcon: FC<SVGProps<SVGSVGElement>>;
  export const CloudArrowDownIcon: FC<SVGProps<SVGSVGElement>>;
  export const SignalIcon: FC<SVGProps<SVGSVGElement>>;
  export const BoltIcon: FC<SVGProps<SVGSVGElement>>;
  export const CircleStackIcon: FC<SVGProps<SVGSVGElement>>;
  export const ArrowPathIcon: FC<SVGProps<SVGSVGElement>>;
  export const ExclamationTriangleIcon: FC<SVGProps<SVGSVGElement>>;
  export const CheckCircleIcon: FC<SVGProps<SVGSVGElement>>;
  export const XCircleIcon: FC<SVGProps<SVGSVGElement>>;
}

declare module '@heroicons/react/24/solid' {
  import { FC, SVGProps } from 'react';
}
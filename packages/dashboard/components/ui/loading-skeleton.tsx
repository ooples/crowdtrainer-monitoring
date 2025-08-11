'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface LoadingSkeletonProps {
  className?: string;
  variant?: 'default' | 'card' | 'text' | 'circle' | 'button';
  lines?: number;
}

const variants = {
  default: 'animate-pulse bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700 bg-[length:200%_100%] rounded',
  card: 'animate-pulse bg-gradient-to-r from-gray-700/50 via-gray-600/50 to-gray-700/50 bg-[length:200%_100%] rounded-xl',
  text: 'animate-pulse bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700 bg-[length:200%_100%] rounded h-4',
  circle: 'animate-pulse bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700 bg-[length:200%_100%] rounded-full',
  button: 'animate-pulse bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700 bg-[length:200%_100%] rounded-lg h-10',
};

export function LoadingSkeleton({ 
  className = "", 
  variant = 'default', 
  lines = 1 
}: LoadingSkeletonProps) {
  if (variant === 'text' && lines > 1) {
    return (
      <div className={cn("space-y-2", className)}>
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className={cn(variants[variant], i === lines - 1 && "w-3/4")} />
        ))}
      </div>
    );
  }

  return (
    <div className={cn(variants[variant], className)}>
      <div className="invisible">Loading...</div>
    </div>
  );
}

interface CardSkeletonProps {
  className?: string;
}

export function CardSkeleton({ className = "" }: CardSkeletonProps) {
  return (
    <LoadingSkeleton variant="card" className={cn("p-6 space-y-4", className)}>
      <LoadingSkeleton variant="text" className="w-1/3" />
      <LoadingSkeleton variant="text" className="w-1/2 h-8" />
      <LoadingSkeleton variant="text" className="w-2/3" />
    </LoadingSkeleton>
  );
}

interface MetricCardSkeletonProps {
  className?: string;
}

export function MetricCardSkeleton({ className = "" }: MetricCardSkeletonProps) {
  return (
    <LoadingSkeleton variant="card" className={cn("p-6", className)}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <LoadingSkeleton variant="text" className="w-24" />
          <LoadingSkeleton variant="circle" className="w-3 h-3" />
        </div>
        <LoadingSkeleton variant="text" className="w-16 h-8" />
        <LoadingSkeleton variant="text" className="w-32" />
      </div>
    </LoadingSkeleton>
  );
}

interface EventListSkeletonProps {
  count?: number;
  className?: string;
}

export function EventListSkeleton({ count = 5, className = "" }: EventListSkeletonProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <LoadingSkeleton key={i} variant="card" className="p-4">
          <div className="flex items-start gap-3">
            <LoadingSkeleton variant="circle" className="w-8 h-8 mt-1" />
            <div className="flex-1 space-y-2">
              <LoadingSkeleton variant="text" className="w-3/4" />
              <LoadingSkeleton variant="text" className="w-full" lines={2} />
              <div className="flex items-center gap-4 mt-3">
                <LoadingSkeleton variant="text" className="w-16" />
                <LoadingSkeleton variant="text" className="w-20" />
              </div>
            </div>
            <LoadingSkeleton variant="button" className="w-20 h-6" />
          </div>
        </LoadingSkeleton>
      ))}
    </div>
  );
}
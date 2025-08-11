'use client';

import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GlassCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: React.ReactNode;
  variant?: 'default' | 'subtle' | 'strong';
  hover?: boolean;
  glow?: boolean;
  className?: string;
}

const variants = {
  default: 'backdrop-blur-sm bg-white/5 border border-white/10 shadow-2xl',
  subtle: 'backdrop-blur-xs bg-white/3 border border-white/5 shadow-lg',
  strong: 'backdrop-blur-md bg-white/10 border border-white/20 shadow-3xl',
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 10
    }
  }
};

export function GlassCard({ 
  children, 
  variant = 'default', 
  hover = true,
  glow = false,
  className = "",
  ...props 
}: GlassCardProps) {
  return (
    <motion.div
      variants={itemVariants}
      className={cn(
        'rounded-xl',
        variants[variant],
        hover && 'hover:bg-white/10 transition-all duration-300 cursor-pointer',
        glow && 'shadow-[0_0_20px_rgba(59,130,246,0.15)]',
        className
      )}
      whileHover={hover ? { scale: 1.02, y: -2 } : undefined}
      {...props}
    >
      {children}
    </motion.div>
  );
}
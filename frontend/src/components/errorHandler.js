"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ui/toast';

// Global error tracking (persists between renders)
const handledErrors = new Set();

export default function ErrorHandler() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const hasProcessedError = useRef(false);
  
  useEffect(() => {
    // Only run this once when the component mounts
    if (hasProcessedError.current) return;
    
    const error = searchParams.get('error');
    if (!error) return;
    
    // Only handle this error if it hasn't been handled globally
    if (!handledErrors.has(error)) {
      // Mark as handled globally
      handledErrors.add(error);
      
      // Mark locally to avoid re-processing in this component
      hasProcessedError.current = true;
      
      // Remove error from URL
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('error');
        window.history.replaceState({}, '', url);
      }
      
      // Show relevant toast
      if (error === 'invalid-email') {
        toast({
          title: 'Invalid Email',
          description: 'Please sign in with your UCI email address.',
          status: 'error',
          duration: 4000,
          isClosable: true,
        });
      }
    }
  }, []); // Empty dependency array means this runs once on mount
  
  return null;
}

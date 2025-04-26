'use client';

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen 
      bg-gradient-to-r from-pastel-pink via-lavender to-sky-blue 
      dark:from-dark-gradient-start dark:to-dark-gradient-end 
      animate-gradient bg-[length:400%_400%]">
      
      <div className="relative w-16 h-16">
        {/* Outer Pulsing Ring */}
        <div className="absolute inset-0 rounded-full border-4 border-blue-400 dark:border-purple-400 opacity-20 animate-ping"></div>
        
        {/* Main Spinning Loader */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-t-transparent border-blue-500 dark:border-purple-500 rounded-full animate-spin"></div>
        </div>
      </div>
    </div>
  );
}

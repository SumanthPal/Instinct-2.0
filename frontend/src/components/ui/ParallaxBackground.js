import React from 'react';

const ParallaxBackground = () => {
  return (
    <div className="min-h-screen bg-gradient-to-r from-pastel-pink via-lavender to-sky-blue dark:from-dark-gradient-start dark:to-dark-gradient-end dark:text-dark-text">

    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      <img 
        src="/logo.svg" 
        alt="Background Logo" 
        className="absolute top-1/2 left-1/2 opacity-30 h-100 select-none"
        style={{
          transform: 'translate(-50%, -50%)', // Only center it, no offset
        }}
      />
    </div>
    </div>
  );
};

export default ParallaxBackground;

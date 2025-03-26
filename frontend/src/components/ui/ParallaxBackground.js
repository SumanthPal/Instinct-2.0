import React, { useEffect, useState } from 'react';

const ParallaxBackground = () => {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      requestAnimationFrame(() => {
        setOffset(window.pageYOffset * 0.5); // Adjust the parallax speed here
      });
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      <img 
        src="/logo.svg" 
        alt="Background Logo" 
        className="absolute top-1/2 left-1/2 opacity-30 h-100 select-none"
        style={{
          transform: `translate(-50%, -50%) translateY(${offset}px)`, // Separate transforms
        }}
      />
    </div>
  );
};

export default ParallaxBackground;
'use client';
import React, { useState } from 'react';
import clsx from 'clsx';

const TechTransition = ({
    iconOld,
    iconNew,
    labelOld,
    labelNew,
    tooltipOld,
    tooltipNew,
  }) => {
    const [hovered, setHovered] = useState(false);
  
    return (
      <div
        className="relative group flex items-center space-x-4 justify-center"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="relative h-8 w-8">
          <div className={`absolute inset-0 transition duration-200 ${hovered ? 'opacity-0' : 'opacity-100'}`}>
            {iconOld}
          </div>
          <div className={`absolute inset-0 transition duration-200 ${hovered ? 'opacity-100' : 'opacity-0'}`}>
            {iconNew}
          </div>
        </div>
        <span className="text-xl text-gray-700 dark:text-dark-text relative">
          <span className={`transition duration-200 ${hovered ? 'opacity-0 absolute' : 'opacity-100'}`}>{labelOld}</span>
          <span className={`transition duration-200 ${hovered ? 'opacity-100' : 'opacity-0 absolute'}`}>{labelNew}</span>
        </span>
        <div className="absolute bottom-full mb-2 w-64 text-sm text-white bg-black dark:bg-dark-base px-3 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
          {hovered ? tooltipNew : tooltipOld}
        </div>
      </div>
    );
  };
  export default TechTransition;

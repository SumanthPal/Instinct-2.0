"use client";
import { useState, useEffect } from "react";

const phrases = [
  "Explore UC Irvine clubs",
  "Discover events",
  "Connect with your community",
  "Find your passion",
  "Join exciting activities",
  "Meet new friends",
  "Make a difference",
];

export default function TypingAnimation() {
  const [currentPhrase, setCurrentPhrase] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [typingSpeed, setTypingSpeed] = useState(50); // Speed of typing/deleting

  useEffect(() => {
    const handleTyping = () => {
      const currentText = phrases[phraseIndex];
      if (!isDeleting) {
        // Typing logic
        setCurrentPhrase(currentText.substring(0, currentPhrase.length + 1));
        if (currentPhrase === currentText) {
          // Switch to deleting after a delay
          setTimeout(() => setIsDeleting(true), 1000);
        }
      } else {
        // Deleting logic
        setCurrentPhrase(currentText.substring(0, currentPhrase.length - 1));
        if (currentPhrase === "") {
          // Move to the next phrase
          setIsDeleting(false);
          setPhraseIndex((phraseIndex + 1) % phrases.length);
        }
      }
    };

    const timer = setTimeout(handleTyping, typingSpeed);
    return () => clearTimeout(timer);
  }, [currentPhrase, isDeleting, phraseIndex, typingSpeed]);

  return (
    <div className="text-2xl sm:text-4xl md:text-5xl text-gray-700 dark:text-dark-subtext mb-8">
      <span>{currentPhrase}</span>
      <span className="blinking-cursor">|</span>
    </div>
  );
}
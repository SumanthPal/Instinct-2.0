"use client";
import { useState, useEffect } from "react";

const phrases = [
  "Explore UC Irvine clubs",
  "Discover events",
  "Find your passion",
  "Join exciting activities",
  "Meet new friends",
  "Make a difference",
];

export default function TypingAnimation({ text, className = "" }) {
  const [currentPhrase, setCurrentPhrase] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [typingSpeed, setTypingSpeed] = useState(50); // Speed of typing/deleting

  // Use custom text if provided, otherwise use default phrases
  const displayPhrases = text || phrases;

  useEffect(() => {
    const handleTyping = () => {
      const currentText = displayPhrases[phraseIndex];
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
          setPhraseIndex((phraseIndex + 1) % displayPhrases.length);
        }
      }
    };

    const timer = setTimeout(handleTyping, typingSpeed);
    return () => clearTimeout(timer);
  }, [currentPhrase, isDeleting, phraseIndex, typingSpeed, displayPhrases]);

  return (
    <div className={className}>
      <span>{currentPhrase}</span>
      <span className="blinking-cursor">|</span>
    </div>
  );
}
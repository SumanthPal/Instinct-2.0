"use client";

// This will be our global error state manager
let handledErrors = new Set();

export const ErrorManager = {
  // Check if an error has been handled
  isErrorHandled: (errorType) => {
    return handledErrors.has(errorType);
  },
  
  // Mark an error as handled
  markErrorAsHandled: (errorType) => {
    handledErrors.add(errorType);
  },
  
  // Clear all handled errors (useful for testing)
  clearHandledErrors: () => {
    handledErrors = new Set();
  }
};
// src/utils/errorHandler.ts
import { Alert } from 'react-native';

// Log error to console
export const logError = (error: any, context = {}) => {
  console.error('Error:', error, 'Context:', context);
};

// Handle API errors silently
export const handleApiError = (error: any) => {
  logError(error);
  return null;
};

// Global error handler for uncaught exceptions
const setupGlobalErrorHandling = () => {
  const defaultHandler = ErrorUtils.getGlobalHandler();
  
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    logError(error, { isFatal });
    
    // Optionally show a generic error to the user
    if (isFatal) {
      Alert.alert(
        'Something went wrong',
        'The app encountered an unexpected error. Please restart the app.'
      );
    }
    
    // Call the default handler
    defaultHandler(error, isFatal);
  });
};

export default setupGlobalErrorHandling;
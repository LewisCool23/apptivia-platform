import React, { createContext, useContext } from 'react';
import toast, { Toaster } from 'react-hot-toast';

// Create toast context
const ToastContext = createContext();

// Custom hook to use toast
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    // Fallback if not wrapped in provider
    return {
      success: (message) => toast.success(message),
      error: (message) => toast.error(message),
      loading: (message) => toast.loading(message),
      promise: (promise, messages) => toast.promise(promise, messages),
    };
  }
  return context;
};

// Toast Provider Component
export const ToastProvider = ({ children }) => {
  const showSuccess = (message, options = {}) => {
    toast.success(message, {
      duration: 3000,
      style: {
        background: '#16A34A',
        color: '#F7F5F2',
        fontWeight: '500',
        borderRadius: '8px',
        padding: '12px 16px',
      },
      iconTheme: {
        primary: '#F7F5F2',
        secondary: '#16A34A',
      },
      ...options,
    });
  };

  const showError = (message, options = {}) => {
    toast.error(message, {
      duration: 4000,
      style: {
        background: '#C8341B',
        color: '#F7F5F2',
        fontWeight: '500',
        borderRadius: '8px',
        padding: '12px 16px',
      },
      iconTheme: {
        primary: '#F7F5F2',
        secondary: '#C8341B',
      },
      ...options,
    });
  };

  const showLoading = (message, options = {}) => {
    return toast.loading(message, {
      style: {
        background: '#FF4D2E',
        color: '#F7F5F2',
        fontWeight: '500',
        borderRadius: '8px',
        padding: '12px 16px',
      },
      ...options,
    });
  };

  const showPromise = (promise, messages) => {
    return toast.promise(
      promise,
      {
        loading: messages.loading || 'Loading...',
        success: messages.success || 'Success!',
        error: messages.error || 'Error occurred',
      },
      {
        style: {
          borderRadius: '8px',
          padding: '12px 16px',
          fontWeight: '500',
        },
        success: {
          style: {
            background: '#16A34A',
            color: '#F7F5F2',
          },
          iconTheme: {
            primary: '#F7F5F2',
            secondary: '#16A34A',
          },
        },
        error: {
          style: {
            background: '#C8341B',
            color: '#F7F5F2',
          },
          iconTheme: {
            primary: '#F7F5F2',
            secondary: '#C8341B',
          },
        },
      }
    );
  };

  const showInfo = (message, options = {}) => {
    toast(message, {
      duration: 3000,
      icon: 'ℹ️',
      style: {
        background: '#FF4D2E',
        color: '#F7F5F2',
        fontWeight: '500',
        borderRadius: '8px',
        padding: '12px 16px',
      },
      ...options,
    });
  };

  const dismiss = (toastId) => {
    toast.dismiss(toastId);
  };

  const value = {
    success: showSuccess,
    error: showError,
    loading: showLoading,
    promise: showPromise,
    info: showInfo,
    dismiss,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster
        position="top-right"
        reverseOrder={false}
        gutter={8}
        toastOptions={{
          duration: 3000,
          style: {
            borderRadius: '8px',
            padding: '12px 16px',
            fontSize: '14px',
          },
        }}
      />
    </ToastContext.Provider>
  );
};

export default ToastProvider;

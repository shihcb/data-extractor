import { createContext, useContext } from 'react';

// toast(text, { warn }) shows a message at the bottom of the screen (see Toast.jsx)
export const ToastContext = createContext(() => {});

export const useToast = () => useContext(ToastContext);

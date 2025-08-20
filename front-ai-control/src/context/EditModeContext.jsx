import React, { createContext, useState, useContext } from 'react';

const EditModeContext = createContext();

export const EditModeProvider = ({ children }) => {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <EditModeContext.Provider value={{ isEditing, setIsEditing }}>
      {children}
    </EditModeContext.Provider>
  );
};

export const useEditMode = () => useContext(EditModeContext);
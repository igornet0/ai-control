import React from 'react';

export interface EditModeContextType {
  isEditing: boolean;
  setIsEditing: (isEditing: boolean) => void;
}

export const EditModeProvider: React.FC<{ children: React.ReactNode }>;
export const useEditMode: () => EditModeContextType;

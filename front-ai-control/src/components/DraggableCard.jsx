import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const DraggableCard = ({ 
  id, 
  children, 
  className = "", 
  isDragging = false, 
  dragHandle = true 
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isDraggingFromKit,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDraggingFromKit ? 0.5 : 1,
    zIndex: isDraggingFromKit ? 100 : 0,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${className} relative group`}
    >
      {/* Drag Handle - троеточие в правом верхнем углу */}
      {dragHandle && (
        <div 
          className="absolute top-3 right-3 opacity-0 group-hover:opacity-70 transition-opacity duration-200 cursor-grab active:cursor-grabbing z-20 p-1 rounded hover:bg-gray-700/50"
          {...attributes}
          {...listeners}
        >
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="currentColor" 
            className="text-gray-400 hover:text-gray-300"
          >
            {/* Троеточие вертикальное */}
            <circle cx="12" cy="5" r="2"/>
            <circle cx="12" cy="12" r="2"/>
            <circle cx="12" cy="19" r="2"/>
          </svg>
        </div>
      )}
      
      {children}
    </div>
  );
};

export default DraggableCard;

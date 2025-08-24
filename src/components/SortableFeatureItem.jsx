import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export default function SortableFeatureItem({ feature, priority, isDragOverlay = false, isCompact = false }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: feature.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1000 : 1,
  };

  const baseClasses = `
    bg-gray-700 hover:bg-gray-600 transition-colors duration-200 rounded-lg 
    border border-gray-600 cursor-grab active:cursor-grabbing
    ${isDragging ? 'opacity-50 shadow-2xl ring-2 ring-blue-500' : ''}
    ${isDragOverlay ? 'rotate-3 shadow-2xl' : ''}
  `;
  
  const padding = isCompact ? 'p-3' : 'p-4';
  const iconSize = isCompact ? 'w-8 h-8' : 'w-10 h-10';
  const titleSize = isCompact ? 'text-xs' : 'text-sm';
  const gap = isCompact ? 'gap-3' : 'gap-4';

  return (
    <div
      ref={setNodeRef}
      style={style}
      class={`${baseClasses} ${padding}`}
      {...attributes}
      {...listeners}
    >
      <div class={`flex items-center ${gap}`}>
        {/* Priority Badge - only show if priority is specified */}
        {priority && (
          <div class="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xs">
            {priority}
          </div>
        )}

        {/* Feature Icon */}
        <div class={`flex-shrink-0 ${iconSize} bg-gray-600 rounded-lg flex items-center justify-center`}>
          <span class="material-symbols-outlined text-gray-300 text-lg">
            {feature.icon}
          </span>
        </div>

        {/* Feature Content */}
        <div class="flex-1 min-w-0">
          <h3 class={`font-semibold text-white ${titleSize} mb-1 truncate`}>
            {feature.name}
          </h3>
          {!isCompact && (
            <p class="text-gray-400 text-xs leading-relaxed">
              {feature.description}
            </p>
          )}
        </div>

        {/* Drag Handle */}
        <div class="flex-shrink-0 ml-2">
          <span class="material-symbols-outlined text-gray-400 hover:text-gray-300 text-sm">
            drag_handle
          </span>
        </div>
      </div>
    </div>
  );
}
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export default function SortableFeatureItem({ feature, priority }) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      class={`
        bg-gray-700 hover:bg-gray-600 transition-colors duration-200 rounded-lg p-4 
        border border-gray-600 cursor-grab active:cursor-grabbing
        ${isDragging ? 'opacity-50 shadow-2xl ring-2 ring-blue-500' : ''}
      `}
      {...attributes}
      {...listeners}
    >
      <div class="flex items-center gap-4">
        {/* Priority Badge */}
        <div class="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
          {priority}
        </div>

        {/* Feature Icon */}
        <div class="flex-shrink-0 w-10 h-10 bg-gray-600 rounded-lg flex items-center justify-center">
          <span class="material-symbols-outlined text-gray-300 text-xl">
            {feature.icon}
          </span>
        </div>

        {/* Feature Content */}
        <div class="flex-1 min-w-0">
          <h3 class="font-semibold text-white text-sm mb-1 truncate">
            {feature.name}
          </h3>
          <p class="text-gray-400 text-xs leading-relaxed">
            {feature.description}
          </p>
        </div>

        {/* Drag Handle */}
        <div class="flex-shrink-0 ml-2">
          <span class="material-symbols-outlined text-gray-400 hover:text-gray-300 text-lg">
            drag_handle
          </span>
        </div>
      </div>
    </div>
  );
}
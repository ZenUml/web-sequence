import { useState } from 'preact/hooks';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  restrictToVerticalAxis,
  restrictToWindowEdges,
} from '@dnd-kit/modifiers';
import SortableFeatureItem from './SortableFeatureItem.jsx';

export default function PriorityRanking({ features, priorities, onPrioritiesChange }) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event) {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = priorities.indexOf(active.id);
      const newIndex = priorities.indexOf(over.id);
      
      const newPriorities = arrayMove(priorities, oldIndex, newIndex);
      onPrioritiesChange(newPriorities);
    }
  }

  const sortedFeatures = priorities.map(id => features.find(f => f.id === id));

  return (
    <div class="space-y-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
      >
        <SortableContext items={priorities} strategy={verticalListSortingStrategy}>
          {sortedFeatures.map((feature, index) => (
            <SortableFeatureItem 
              key={feature.id} 
              feature={feature} 
              priority={index + 1}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
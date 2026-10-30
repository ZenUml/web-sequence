import type { Meta, StoryObj } from '@storybook/react-vite';
import { PrimitivesGallery } from './PrimitivesGallery';

const meta: Meta<typeof PrimitivesGallery> = {
  title: 'UI/Primitives',
  component: PrimitivesGallery,
};
export default meta;

type Story = StoryObj<typeof PrimitivesGallery>;

export const LightAndDark: Story = {};

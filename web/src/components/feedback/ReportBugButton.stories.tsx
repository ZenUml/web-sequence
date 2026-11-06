import type { Meta, StoryObj } from '@storybook/react-vite';
import { ReportBugButton } from './ReportBugButton';

const meta: Meta<typeof ReportBugButton> = {
  title: 'Feedback/ReportBugButton',
  component: ReportBugButton,
  args: {
    appVersion: '2026.6.7',
    view: 'editor',
    signedIn: false,
    dsl: 'Alice -> Bob: Hello',
  },
};
export default meta;

type Story = StoryObj<typeof ReportBugButton>;

// The FAB anchors bottom-right of the canvas. Click it to open the modal.
export const Default: Story = {};
export const Anonymous: Story = { args: { signedIn: false } };
export const SignedIn: Story = { args: { signedIn: true } };
// No active diagram (hub / empty doc): the modal hides the DSL toggle.
export const NoEditorContent: Story = { args: { dsl: '', view: 'hub' } };

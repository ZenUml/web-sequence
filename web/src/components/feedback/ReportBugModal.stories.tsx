import type { Meta, StoryObj } from '@storybook/react-vite';
import { ReportBugModal } from './ReportBugModal';

const meta: Meta<typeof ReportBugModal> = {
  title: 'Feedback/ReportBugModal',
  component: ReportBugModal,
  args: {
    open: true,
    onOpenChange: () => {},
    // Don't actually open a tab from a story.
    openUrl: () => {},
    appVersion: '2026.6.7',
    view: 'editor',
    signedIn: false,
    dsl: 'Alice -> Bob: Hello\nBob -> Alice: Hi back',
  },
};
export default meta;

type Story = StoryObj<typeof ReportBugModal>;

// Submit is disabled until the user types a description.
export const Empty: Story = {};
// With editor content, the public-DSL toggle defaults ON.
export const WithDsl: Story = {};
// Anonymous vs signed-in changes the attached-summary line.
export const Anonymous: Story = { args: { signedIn: false } };
export const SignedIn: Story = { args: { signedIn: true } };
// No active diagram: the DSL toggle is hidden and the summary says "No diagram code".
export const NoEditorContent: Story = { args: { dsl: '', view: 'hub' } };

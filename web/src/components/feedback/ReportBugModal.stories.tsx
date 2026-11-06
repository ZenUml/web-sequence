import { useEffect } from 'react';
import { useSettingsStore } from '../../state/settingsStore';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ReportBugModal } from './ReportBugModal';

const meta: Meta<typeof ReportBugModal> = {
  title: 'Feedback/ReportBugModal',
  component: ReportBugModal,
  decorators: [(Story, context) => {
    const appearance = context.parameters.appearance === 'dark' ? 'dark' : 'light';
    useEffect(() => {
      const previous = document.documentElement.dataset.appearance;
      const previousSettings = useSettingsStore.getState().settings;
      document.documentElement.dataset.appearance = appearance;
      useSettingsStore.setState({ settings: { ...previousSettings, appearance } });
      return () => {
        if (previous === undefined) delete document.documentElement.dataset.appearance;
        else document.documentElement.dataset.appearance = previous;
        useSettingsStore.setState({ settings: previousSettings });
      };
    }, [appearance]);
    return <Story />;
  }],
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

export const Dark: Story = { parameters: { appearance: 'dark' } };
export const Narrow: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };

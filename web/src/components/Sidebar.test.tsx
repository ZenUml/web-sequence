import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sidebar } from './Sidebar';
import { useUiStore } from '../state/uiStore';

describe('Sidebar', () => {
  beforeEach(() => {
    // Shared zustand store — reset the panel before each case.
    useUiStore.getState().setActivePanel('editor');
  });

  it('renders the four rail entries with stable testids', () => {
    render(<Sidebar />);
    expect(screen.getByTestId('sidebar-editor')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-library')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-templates')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-help')).toBeInTheDocument();
  });

  it('labels the nav "Primary"', () => {
    render(<Sidebar />);
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

  it('marks the active panel with aria-pressed=true and the other false', () => {
    render(<Sidebar />);
    expect(screen.getByTestId('sidebar-editor')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('sidebar-library')).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Library activates the library panel in the store', async () => {
    render(<Sidebar />);
    await userEvent.click(screen.getByTestId('sidebar-library'));
    expect(useUiStore.getState().activePanel).toBe('library');
    expect(screen.getByTestId('sidebar-library')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('sidebar-editor')).toHaveAttribute('aria-pressed', 'false');
  });

  it('Templates is a fire-and-forget action (no pressed state) and calls onOpenTemplates', async () => {
    const onOpenTemplates = vi.fn();
    render(<Sidebar onOpenTemplates={onOpenTemplates} />);
    const templates = screen.getByTestId('sidebar-templates');
    expect(templates).not.toHaveAttribute('aria-pressed');
    await userEvent.click(templates);
    expect(onOpenTemplates).toHaveBeenCalledTimes(1);
    // Templates must not hijack the panel store.
    expect(useUiStore.getState().activePanel).toBe('editor');
  });

  it('Help calls onOpenHelp and exposes no pressed state', async () => {
    const onOpenHelp = vi.fn();
    render(<Sidebar onOpenHelp={onOpenHelp} />);
    const help = screen.getByTestId('sidebar-help');
    expect(help).not.toHaveAttribute('aria-pressed');
    await userEvent.click(help);
    expect(onOpenHelp).toHaveBeenCalledTimes(1);
  });

  it('does not throw when optional handlers are omitted', async () => {
    render(<Sidebar />);
    await userEvent.click(screen.getByTestId('sidebar-templates'));
    await userEvent.click(screen.getByTestId('sidebar-help'));
    expect(useUiStore.getState().activePanel).toBe('editor');
  });
});

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppHeader } from './AppHeader';
import type { AppUser } from '../../domain/types';

// Pointer capture stubs for Radix dropdown (AppMenu / document menu / ProfileMenu).
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!window.scrollTo) {
    window.scrollTo = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
});

const baseProps = {
  title: 'My Diagram',
  unsavedCount: 0,
  user: null,
  onTitleChange: vi.fn(),
  onNew: vi.fn(),
  onSave: vi.fn(),
  onFork: vi.fn(),
  onLogin: vi.fn(),
  onLogout: vi.fn(),
  onPresent: vi.fn(),
};

const mockUser: AppUser = {
  uid: 'uid-1',
  email: 'user@test.com',
  displayName: 'Jane Doe',
  photoURL: null,
};

// Radix leaves pointer-events:none on the page while a menu's overlay is mounted.
// Press Escape between successive menu opens so the next trigger click isn't
// blocked by a stale portal.
const closeMenu = () => userEvent.keyboard('{Escape}');

describe('AppHeader', () => {
  it('shows header-login when user is null', () => {
    render(<AppHeader {...baseProps} user={null} />);
    expect(screen.getByTestId('header-login')).toBeInTheDocument();
    expect(screen.queryByTestId('profile-trigger')).not.toBeInTheDocument();
  });

  // Spec: signed-out "Sign in" is a secondary outline button, like Fork / Share.
  it('header-login uses the shared secondary button style', () => {
    render(<AppHeader {...baseProps} user={null} />);
    const login = screen.getByTestId('header-login');
    expect(login.className).toContain('editor-button--secondary');
    expect(screen.getByTestId('header-fork').className).toContain('editor-button--secondary');
  });

  it('shows profile-trigger when user is set', () => {
    render(<AppHeader {...baseProps} user={mockUser} />);
    expect(screen.getByTestId('profile-trigger')).toBeInTheDocument();
    expect(screen.queryByTestId('header-login')).not.toBeInTheDocument();
  });

  // New/Save stay in the app menu; Fork is a visible document action.
  it('renders Fork as a top-level action and keeps New/Save in the app menu', async () => {
    const onFork = vi.fn();
    render(<AppHeader {...baseProps} onFork={onFork} />);
    expect(screen.queryByTestId('header-new')).not.toBeInTheDocument();
    expect(screen.queryByTestId('header-save')).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId('header-fork'));
    expect(onFork).toHaveBeenCalledTimes(1);
  });

  // ---- App menu (logo brand ▾) ----

  it('app menu Save item calls onSave', async () => {
    const onSave = vi.fn();
    render(<AppHeader {...baseProps} onSave={onSave} />);
    await userEvent.click(screen.getByTestId('header-menu'));
    await userEvent.click(await screen.findByTestId('header-save'));
    expect(onSave).toHaveBeenCalled();
  });

  it('app menu New fires onNew immediately when there are no unsaved changes', async () => {
    const onNew = vi.fn();
    render(<AppHeader {...baseProps} unsavedCount={0} onNew={onNew} />);
    await userEvent.click(screen.getByTestId('header-menu'));
    await userEvent.click(await screen.findByTestId('header-new'));
    expect(onNew).toHaveBeenCalled();
    expect(screen.queryByTestId('confirm-ok')).not.toBeInTheDocument();
  });

  // #8: guard "New" against data loss when there are unsaved edits.
  it('app menu New opens a discard-confirm (not onNew) when unsavedCount > 0', async () => {
    const onNew = vi.fn();
    render(<AppHeader {...baseProps} unsavedCount={2} onNew={onNew} />);
    await userEvent.click(screen.getByTestId('header-menu'));
    await userEvent.click(await screen.findByTestId('header-new'));
    expect(onNew).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Discard unsaved changes?');
    expect(screen.getByTestId('confirm-ok')).toBeInTheDocument();
  });

  it('app menu New confirm fires onNew; cancel does not', async () => {
    const onNew = vi.fn();
    const { rerender } = render(<AppHeader {...baseProps} unsavedCount={2} onNew={onNew} />);

    await userEvent.click(screen.getByTestId('header-menu'));
    await userEvent.click(await screen.findByTestId('header-new'));
    await userEvent.click(await screen.findByTestId('confirm-cancel'));
    expect(onNew).not.toHaveBeenCalled();

    rerender(<AppHeader {...baseProps} unsavedCount={2} onNew={onNew} />);
    await userEvent.click(screen.getByTestId('header-menu'));
    await userEvent.click(await screen.findByTestId('header-new'));
    await userEvent.click(await screen.findByTestId('confirm-ok'));
    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it('app menu triggers call their injected modal handlers', async () => {
    const onOpenSettings = vi.fn();
    const onOpenCreateNew = vi.fn();
    const onOpenHelp = vi.fn();
    render(
      <AppHeader
        {...baseProps}
        onOpenSettings={onOpenSettings}
        onOpenCreateNew={onOpenCreateNew}
        onOpenHelp={onOpenHelp}
      />,
    );
    await userEvent.click(screen.getByTestId('header-menu'));
    await userEvent.click(await screen.findByTestId('header-settings'));
    expect(onOpenSettings).toHaveBeenCalled();

    await userEvent.click(screen.getByTestId('header-menu'));
    await userEvent.click(await screen.findByTestId('header-create-new'));
    expect(onOpenCreateNew).toHaveBeenCalled();

    await userEvent.click(screen.getByTestId('header-menu'));
    await userEvent.click(await screen.findByTestId('header-help'));
    expect(onOpenHelp).toHaveBeenCalled();
  });

  it('app menu opens the cheat-sheet and shortcuts modals', async () => {
    const onOpenCheatSheet = vi.fn();
    const onOpenShortcuts = vi.fn();
    render(
      <AppHeader {...baseProps} onOpenCheatSheet={onOpenCheatSheet} onOpenShortcuts={onOpenShortcuts} />,
    );
    await userEvent.click(screen.getByTestId('header-menu'));
    await userEvent.click(await screen.findByTestId('header-cheatsheet'));
    expect(onOpenCheatSheet).toHaveBeenCalled();

    await userEvent.click(screen.getByTestId('header-menu'));
    await userEvent.click(await screen.findByTestId('header-shortcuts'));
    expect(onOpenShortcuts).toHaveBeenCalled();
  });

  // REQ-SUB-6: the Pricing trigger only exists when payment is enabled.
  it('shows app-menu Pricing only when paymentEnabled', async () => {
    const onOpenPricing = vi.fn();
    const { rerender } = render(
      <AppHeader {...baseProps} paymentEnabled={false} onOpenPricing={onOpenPricing} />,
    );
    await userEvent.click(screen.getByTestId('header-menu'));
    expect(screen.queryByTestId('header-pricing')).not.toBeInTheDocument();
    await closeMenu();

    rerender(<AppHeader {...baseProps} paymentEnabled onOpenPricing={onOpenPricing} />);
    await userEvent.click(screen.getByTestId('header-menu'));
    await userEvent.click(await screen.findByTestId('header-pricing'));
    expect(onOpenPricing).toHaveBeenCalled();
  });

  // ---- Pricing ----
  // The header shows only Sign in for signed-out users; Pricing stays reachable in
  // the app menu (covered above) and the signed-in account menu.
  it('does not render a separate header Pricing link', () => {
    render(<AppHeader {...baseProps} user={null} paymentEnabled />);
    expect(screen.queryByTestId('header-pricing-link')).not.toBeInTheDocument();
  });

  // ---- Title (no document menu chevron) ----

  it('has no document menu arrow; the title itself is the rename field', () => {
    render(<AppHeader {...baseProps} />);
    expect(screen.queryByTestId('filemenu-trigger')).not.toBeInTheDocument();
    expect(screen.getByTestId('header-title')).toHaveAttribute('aria-label', 'Diagram title');
  });

  it('renders the Diagrams breadcrumb when onGoHome is provided', async () => {
    const onGoHome = vi.fn();
    render(<AppHeader {...baseProps} onGoHome={onGoHome} />);
    const link = screen.getByTestId('header-go-home');
    expect(link).toHaveTextContent('Diagrams');
    await userEvent.click(link);
    expect(onGoHome).toHaveBeenCalledTimes(1);
  });

  // #826: the title field now edits a local DRAFT and commits on Enter/blur (not on
  // every keystroke), so the user can revert with Escape. Editing then pressing Enter
  // commits the typed title via onTitleChange.
  it('editing header-title and pressing Enter commits onTitleChange', async () => {
    const onTitleChange = vi.fn();
    render(<AppHeader {...baseProps} onTitleChange={onTitleChange} />);
    const input = screen.getByTestId('header-title');
    await userEvent.clear(input);
    await userEvent.type(input, 'New Title');
    await userEvent.keyboard('{Enter}');
    expect(onTitleChange).toHaveBeenCalledWith('New Title');
  });

  // #826: blur also commits (commit-on-exit), so clicking away from a renamed field
  // saves it.
  it('editing header-title and blurring commits onTitleChange', async () => {
    const onTitleChange = vi.fn();
    render(<AppHeader {...baseProps} onTitleChange={onTitleChange} />);
    const input = screen.getByTestId('header-title');
    await userEvent.clear(input);
    await userEvent.type(input, 'Blurred Title');
    input.blur();
    expect(onTitleChange).toHaveBeenCalledWith('Blurred Title');
  });

  // #826: Escape reverts the in-progress edit WITHOUT committing — the field returns to
  // the last committed value and onTitleChange is never fired.
  it('pressing Escape reverts the title edit and does not commit', async () => {
    const onTitleChange = vi.fn();
    render(<AppHeader {...baseProps} onTitleChange={onTitleChange} />);
    const input = screen.getByTestId('header-title') as HTMLInputElement;
    expect(input.value).toBe('My Diagram');
    await userEvent.clear(input);
    await userEvent.type(input, 'TempEscapeTitle');
    expect(input.value).toBe('TempEscapeTitle');
    await userEvent.keyboard('{Escape}');
    // Reverted to the committed value; never committed.
    expect(input.value).toBe('My Diagram');
    expect(onTitleChange).not.toHaveBeenCalled();
  });

  // ---- Save-state indicator (replaces the Save button) ----

  it('shows "Saved" when clean and signed in', () => {
    render(<AppHeader {...baseProps} user={mockUser} unsavedCount={0} />);
    const el = screen.getByTestId('header-savestate');
    expect(el).toHaveAttribute('data-state', 'saved');
    expect(el).toHaveTextContent(/saved/i);
  });

  it('shows "Saving…" when saving is true (signed in)', () => {
    render(<AppHeader {...baseProps} user={mockUser} saving unsavedCount={3} />);
    const el = screen.getByTestId('header-savestate');
    expect(el).toHaveAttribute('data-state', 'saving');
    expect(el).toHaveTextContent(/saving/i);
  });

  it('shows amber "Unsaved" when there are unsaved changes', () => {
    render(<AppHeader {...baseProps} user={mockUser} unsavedCount={2} />);
    const el = screen.getByTestId('header-savestate');
    expect(el).toHaveAttribute('data-state', 'dirty');
    expect(el).toHaveTextContent(/unsaved/i);
    expect(el).toHaveAttribute('aria-label', '2 unsaved changes');
  });

  // Signed-out: saves go to this device only — never claim a cloud "Saved".
  it('shows "Saved locally" (not cloud "Saved") when signed out and clean', () => {
    render(<AppHeader {...baseProps} user={null} unsavedCount={0} />);
    const el = screen.getByTestId('header-savestate');
    expect(el).toHaveAttribute('data-state', 'local');
    expect(el).toHaveTextContent('Saved locally');
  });

  // A brand-new signed-out diagram has not been written anywhere yet: never claim
  // "Saved locally" before the first local save.
  it('shows neutral "Local only" for a signed-out diagram not yet saved on this device', () => {
    render(<AppHeader {...baseProps} user={null} unsavedCount={0} savedLocally={false} />);
    const el = screen.getByTestId('header-savestate');
    expect(el).toHaveAttribute('data-state', 'local-new');
    expect(el).toHaveTextContent('Local only');
    expect(el).not.toHaveTextContent(/saved/i);
  });

  // readOnly: no save happens — never show Saving/Unsaved.
  it('never shows Unsaved or Saving when readOnly (even with unsaved/saving)', () => {
    render(<AppHeader {...baseProps} user={mockUser} readOnly unsavedCount={5} saving />);
    const el = screen.getByTestId('header-savestate');
    expect(el).toHaveAttribute('data-state', 'readonly');
    expect(el).not.toHaveTextContent(/saving/i);
    expect(el).not.toHaveTextContent(/unsaved/i);
  });

  // Signed-out local saves are real saves: pending and in-flight states are
  // reported truthfully instead of a constant label.
  it('shows Unsaved then Saving… for signed-out local saves', () => {
    const { rerender } = render(<AppHeader {...baseProps} user={null} dirty unsavedCount={1} />);
    expect(screen.getByTestId('header-savestate')).toHaveAttribute('data-state', 'dirty');
    rerender(<AppHeader {...baseProps} user={null} saving dirty unsavedCount={1} />);
    expect(screen.getByTestId('header-savestate')).toHaveAttribute('data-state', 'saving');
  });

  // Metadata edits (rename / page ops) set `dirty` but not `unsavedCount`. The
  // indicator must still read "Unsaved" off `dirty`, not a false "Saved".
  it('shows "Unsaved" for a metadata edit (dirty but unsavedCount === 0)', () => {
    render(<AppHeader {...baseProps} user={mockUser} dirty unsavedCount={0} />);
    const el = screen.getByTestId('header-savestate');
    expect(el).toHaveAttribute('data-state', 'dirty');
    expect(el).toHaveTextContent(/unsaved/i);
    expect(el).toHaveAttribute('aria-label', 'Unsaved changes');
  });

  // ---- Right group: Present + account ----

  it('Present button calls onPresent', async () => {
    const onPresent = vi.fn();
    render(<AppHeader {...baseProps} onPresent={onPresent} />);
    await userEvent.click(screen.getByTestId('header-present'));
    expect(onPresent).toHaveBeenCalled();
  });

  // Present is the filled primary action; its icon + aria-label keep it named
  // when the visible label collapses at narrow widths (CSS).
  it('Present is the primary action with an accessible name + icon', () => {
    render(<AppHeader {...baseProps} />);
    const present = screen.getByTestId('header-present');
    expect(present).toHaveAttribute('aria-label', 'Present');
    expect(present.className).toContain('editor-button--primary');
    expect(present.querySelector('svg')).toBeInTheDocument();
    expect(screen.getByText('Present').className).toContain('editor-button-label');
  });

  it('keeps logo + title + savestate + account in the tree', () => {
    render(<AppHeader {...baseProps} user={mockUser} />);
    expect(screen.getByTestId('header-menu')).toBeInTheDocument();
    expect(screen.getByTestId('header-title')).toBeInTheDocument();
    expect(screen.getByTestId('header-savestate')).toBeInTheDocument();
    expect(screen.getByTestId('profile-trigger')).toBeInTheDocument();
  });

  it('orders document actions Fork, Share, Present', () => {
    render(<AppHeader {...baseProps} actions={<button data-testid="share-btn">Share</button>} />);
    const ids = Array.from(document.querySelectorAll('.editor-document-actions button')).map((b) => b.getAttribute('data-testid'));
    expect(ids).toEqual(['header-fork', 'share-btn', 'header-present']);
  });

  // ---- Sidebar toggle + appearance ----

  it('renders the code-pane toggle only when wired and reports its state', async () => {
    const onToggleEditor = vi.fn();
    const { rerender } = render(<AppHeader {...baseProps} />);
    expect(screen.queryByTestId('header-toggle-editor')).not.toBeInTheDocument();
    rerender(<AppHeader {...baseProps} onToggleEditor={onToggleEditor} editorCollapsed={false} />);
    const toggle = screen.getByTestId('header-toggle-editor');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(toggle);
    expect(onToggleEditor).toHaveBeenCalledTimes(1);
    rerender(<AppHeader {...baseProps} onToggleEditor={onToggleEditor} editorCollapsed />);
    expect(screen.getByTestId('header-toggle-editor')).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders the appearance toggle with a label for the next appearance', async () => {
    const onToggleAppearance = vi.fn();
    const { rerender } = render(<AppHeader {...baseProps} appearance="light" onToggleAppearance={onToggleAppearance} />);
    const toggle = screen.getByTestId('header-appearance');
    expect(toggle).toHaveAttribute('aria-label', 'Switch to dark appearance');
    await userEvent.click(toggle);
    expect(onToggleAppearance).toHaveBeenCalledTimes(1);
    rerender(<AppHeader {...baseProps} appearance="dark" onToggleAppearance={onToggleAppearance} />);
    expect(screen.getByTestId('header-appearance')).toHaveAttribute('aria-label', 'Switch to light appearance');
  });

  it('renders injected actions (e.g. Share) in the right group', () => {
    render(<AppHeader {...baseProps} actions={<button data-testid="share-btn">Share</button>} />);
    expect(screen.getByTestId('share-btn')).toBeInTheDocument();
  });

  // ---- Login modal ----

  it('clicking header-login opens the login modal', async () => {
    render(<AppHeader {...baseProps} user={null} />);
    await userEvent.click(screen.getByTestId('header-login'));
    expect(await screen.findByTestId('login-google')).toBeInTheDocument();
  });

  it('clicking login-github inside open modal calls onLogin with github', async () => {
    const onLogin = vi.fn();
    render(<AppHeader {...baseProps} user={null} onLogin={onLogin} />);
    await userEvent.click(screen.getByTestId('header-login'));
    await userEvent.click(await screen.findByTestId('login-github'));
    expect(onLogin).toHaveBeenCalledWith('github');
  });

  it('forwards loginError into the LoginModal', async () => {
    render(<AppHeader {...baseProps} user={null} loginError="Sign-in failed" />);
    await userEvent.click(screen.getByTestId('header-login'));
    expect(await screen.findByTestId('login-error')).toHaveTextContent('Sign-in failed');
  });
});

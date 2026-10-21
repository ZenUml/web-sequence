import { createRef } from 'react';
import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { composite, contrastRatio, installUiCascade, tokenColor, usedColor } from './computedCascade';
import { Menu, MenuContent, MenuItem, MenuTrigger } from './Menu';

beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {};
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
});

describe('Menu', () => {
  it('opens in a portal on the dark surface and closes on Escape back to the trigger', async () => {
    render(
      <Menu>
        <MenuTrigger>File</MenuTrigger>
        <MenuContent>
          <MenuItem>Rename</MenuItem>
        </MenuContent>
      </Menu>,
    );

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    const trigger = screen.getByRole('button', { name: 'File' });
    await userEvent.click(trigger);

    const menu = await screen.findByRole('menu');
    expect(menu).toHaveAttribute('data-ui-surface', 'dark');
    expect(menu.className).toContain('ui-surface-dark');
    expect(menu.className).toContain('ui-menu');

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('uses the surface passed to the portaled content', async () => {
    render(
      <Menu>
        <MenuTrigger>File</MenuTrigger>
        <MenuContent surface="light" className="caller-menu">
          <MenuItem>Rename</MenuItem>
        </MenuContent>
      </Menu>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'File' }));
    const menu = await screen.findByRole('menu');
    expect(menu).toHaveAttribute('data-ui-surface', 'light');
    expect(menu.className).toContain('ui-surface-light');
    expect(menu.className).toContain('caller-menu');
  });

  it('activates the highlighted item from the keyboard and forwards a ref', async () => {
    const onSelect = vi.fn();
    const ref = createRef<HTMLDivElement>();
    render(
      <Menu>
        <MenuTrigger>File</MenuTrigger>
        <MenuContent ref={ref}>
          <MenuItem onSelect={onSelect}>Rename</MenuItem>
        </MenuContent>
      </Menu>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'File' }));
    expect(ref.current).toBe(screen.getByRole('menu'));
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalled();
  });

  it('swaps the danger highlight instead of stacking it on the default one', () => {
    render(
      <Menu open>
        <MenuTrigger>File</MenuTrigger>
        <MenuContent>
          <MenuItem tone="danger">Delete</MenuItem>
          <MenuItem>Keep</MenuItem>
        </MenuContent>
      </Menu>,
    );
    const danger = screen.getByRole('menuitem', { name: 'Delete' });
    const keep = screen.getByRole('menuitem', { name: 'Keep' });
    expect(danger.className).toContain('data-[highlighted]:bg-danger/20');
    expect(danger.className).not.toContain('ui-menu-item--danger');
    expect(keep.className).not.toContain('bg-danger/20');
    expect(keep.className).toContain('ui-menu-item');
  });

  it('paints readable danger states on a light menu and keeps the dark danger highlight', async () => {
    installUiCascade();
    const onSelect = vi.fn();
    const { unmount } = render(
      <Menu>
        <MenuTrigger>File</MenuTrigger>
        <MenuContent surface="light">
          <MenuItem tone="danger" onSelect={onSelect}>
            Delete
          </MenuItem>
          <MenuItem disabled tone="danger">
            Locked
          </MenuItem>
        </MenuContent>
      </Menu>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'File' }));
    const menu = await screen.findByRole('menu');
    const item = screen.getByRole('menuitem', { name: 'Delete' });
    const resting = usedColor(item, 'color');
    const paper = tokenColor(menu, '--ui-surface');
    expect(paper).toEqual([255, 255, 255, 1]);
    expect(contrastRatio([resting[0], resting[1], resting[2]], [paper[0], paper[1], paper[2]])).toBeGreaterThanOrEqual(
      4.5,
    );

    await userEvent.keyboard('{ArrowDown}');
    expect(item).toHaveAttribute('data-highlighted');
    const ink = usedColor(item, 'color');
    const wash = composite(usedColor(item, 'backgroundColor'), paper);
    expect(contrastRatio([ink[0], ink[1], ink[2]], wash)).toBeGreaterThanOrEqual(4.5);
    expect(ink[0]).not.toBe(232);
    expect(ink[1]).not.toBe(238);

    const locked = screen.getByRole('menuitem', { name: 'Locked' });
    expect(locked).toHaveAttribute('data-disabled');
    const lockedColor = usedColor(locked, 'color');
    expect(lockedColor[0]).toBe(122);
    expect(lockedColor[1]).toBe(135);
    expect(lockedColor[2]).toBe(148);
    await userEvent.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledTimes(1);
    unmount();

    render(
      <Menu>
        <MenuTrigger>File</MenuTrigger>
        <MenuContent surface="dark">
          <MenuItem tone="danger">Delete</MenuItem>
          <MenuItem disabled tone="danger">
            Locked
          </MenuItem>
        </MenuContent>
      </Menu>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'File' }));
    const darkItem = screen.getByRole('menuitem', { name: 'Delete' });
    await userEvent.keyboard('{ArrowDown}');
    const darkInk = usedColor(darkItem, 'color');
    expect(darkInk[0]).toBe(232);
    expect(darkInk[1]).toBe(238);
    expect(darkInk[2]).toBe(247);
    const darkLocked = usedColor(screen.getByRole('menuitem', { name: 'Locked' }), 'color');
    expect(darkLocked[0]).toBe(135);
    expect(darkLocked[1]).toBe(148);
    expect(darkLocked[2]).toBe(163);
  });
});

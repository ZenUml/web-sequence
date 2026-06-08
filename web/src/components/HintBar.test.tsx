import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HintBar } from './HintBar'
import { commandsForZone } from '../editor/slashCommands'

describe('HintBar', () => {
  it('renders head-zone commands (e.g. /participant) when zone="head"', () => {
    render(<HintBar zone="head" onInsert={() => {}} />)

    const headCmds = commandsForZone('head')
    // Every head command must have a chip
    for (const cmd of headCmds) {
      expect(screen.getByTestId(`hint-${cmd.name}`)).toBeInTheDocument()
    }

    // Sanity: /participant is one of them
    expect(screen.getByTestId('hint-participant')).toBeInTheDocument()
  })

  it('renders block-zone commands (e.g. /if) when zone="block"', () => {
    render(<HintBar zone="block" onInsert={() => {}} />)

    const blockCmds = commandsForZone('block')
    for (const cmd of blockCmds) {
      expect(screen.getByTestId(`hint-${cmd.name}`)).toBeInTheDocument()
    }

    // Sanity: /if is one of them
    expect(screen.getByTestId('hint-if')).toBeInTheDocument()
  })

  it('does NOT render block commands when zone="head"', () => {
    render(<HintBar zone="head" onInsert={() => {}} />)
    const blockCmds = commandsForZone('block')
    for (const cmd of blockCmds) {
      expect(screen.queryByTestId(`hint-${cmd.name}`)).not.toBeInTheDocument()
    }
  })

  it('does NOT render head commands when zone="block"', () => {
    render(<HintBar zone="block" onInsert={() => {}} />)
    const headCmds = commandsForZone('head')
    for (const cmd of headCmds) {
      expect(screen.queryByTestId(`hint-${cmd.name}`)).not.toBeInTheDocument()
    }
  })

  it('calls onInsert with the command template when a chip is clicked (block zone)', () => {
    const onInsert = vi.fn()
    render(<HintBar zone="block" onInsert={onInsert} />)

    fireEvent.click(screen.getByTestId('hint-if'))

    expect(onInsert).toHaveBeenCalledTimes(1)
    // The template from slashCommands.ts for /if
    const ifCmd = commandsForZone('block').find((c) => c.name === 'if')!
    expect(onInsert).toHaveBeenCalledWith(ifCmd.template)
  })

  it('calls onInsert with the command template when a chip is clicked (head zone)', () => {
    const onInsert = vi.fn()
    render(<HintBar zone="head" onInsert={onInsert} />)

    fireEvent.click(screen.getByTestId('hint-participant'))

    expect(onInsert).toHaveBeenCalledTimes(1)
    const participantCmd = commandsForZone('head').find((c) => c.name === 'participant')!
    expect(onInsert).toHaveBeenCalledWith(participantCmd.template)
  })

  it('each chip has title=detail and aria-label for accessibility', () => {
    render(<HintBar zone="block" onInsert={() => {}} />)

    const blockCmds = commandsForZone('block')
    for (const cmd of blockCmds) {
      const chip = screen.getByTestId(`hint-${cmd.name}`)
      expect(chip).toHaveAttribute('title', cmd.detail)
      expect(chip).toHaveAttribute('aria-label', `Insert ${cmd.label}`)
    }
  })

  it('has role="toolbar" and aria-label on the container', () => {
    render(<HintBar zone="block" onInsert={() => {}} />)
    const toolbar = screen.getByRole('toolbar')
    expect(toolbar).toHaveAttribute('aria-label', 'Insert slash command')
  })
})

import { commandsForZone, type SlashCommand, type SlashZone } from '../editor/slashCommands'
import { cn } from '../ui/cn'

// Compact chip that renders a single slash command.
// Clicking calls onInsert with the raw CodeMirror snippet template; the
// integrator decides whether to pass it through snippet() or insert it literally.
function CommandChip({
  command,
  onInsert,
}: {
  command: SlashCommand
  onInsert: (template: string) => void
}) {
  return (
    <button
      type="button"
      data-testid={`hint-${command.name}`}
      title={command.detail}
      aria-label={`Insert ${command.label}`}
      onClick={() => onInsert(command.template)}
      className={cn(
        'flex items-center gap-1 rounded-md px-2 py-[3px]',
        'text-ondark-muted transition-colors duration-150 ease-draft ring-draft',
        'hover:bg-ink-700/70 hover:text-ondark-strong',
        'text-[11px] font-mono leading-[1.6]',
      )}
    >
      {/* slash token in accent colour */}
      <span className="text-ondark-strong font-semibold" aria-hidden="true">
        /{command.name}
      </span>
      {/* human label — secondary */}
      <span className="text-ondark-muted hidden sm:inline">{command.label}</span>
    </button>
  )
}

// HintBar — context-sensitive strip above the DSL editor.
//
// Props:
//   zone      — 'head' | 'block'; controls which slash commands are shown.
//   onInsert  — called with command.template when a chip is clicked.
//
// Mirrors the Toolbox chrome family: bg-ink-850 strip, ink-line border,
// hidden md:flex responsive wrapper, role="toolbar" + aria-label.
export function HintBar({ zone, onInsert }: { zone: SlashZone; onInsert: (template: string) => void }) {
  const commands = commandsForZone(zone)

  return (
    <div
      role="toolbar"
      aria-label="Insert slash command"
      className="hidden flex-wrap items-center gap-[3px] border-b border-ink-line bg-ink-850 px-3 py-[6px] md:flex"
    >
      {/* Discovery cue — tells the user they can type "/" to trigger the same list */}
      <span
        className="mr-2 flex items-center gap-1 text-[10px] text-ondark-muted select-none"
        aria-hidden="true"
      >
        <span className="font-mono font-semibold text-ondark-strong">/</span>
        <span>commands</span>
      </span>

      {/* One chip per command, inside an .igroup-style cluster */}
      <div className="flex items-center gap-[3px] rounded-[9px] border border-ink-line/40 bg-ink-950/50 p-[3px]">
        {commands.map((cmd) => (
          <CommandChip key={cmd.name} command={cmd} onInsert={onInsert} />
        ))}
      </div>
    </div>
  )
}

import { openSearchPanel, findNext, findPrevious } from '@codemirror/search';
import { toggleComment, indentMore, indentLess } from '@codemirror/commands';
import type { KeyBinding } from '@codemirror/view';
import * as prettier from 'prettier/standalone';
import cssPlugin from 'prettier/plugins/postcss';

export const editorKeymap: KeyBinding[] = [
  { key: 'Mod-f', run: openSearchPanel },
  { key: 'Mod-g', run: findNext },
  { key: 'Mod-Shift-g', run: findPrevious },
  {
    key: 'Mod-Alt-f',
    run: (v) => {
      openSearchPanel(v);
      return true;
    },
  }, // find & replace panel
  { key: 'Mod-/', run: toggleComment },
  { key: 'Mod-]', run: indentMore },
  { key: 'Mod-[', run: indentLess },
];

export async function formatCss(code: string): Promise<string> {
  return prettier.format(code, { parser: 'css', plugins: [cssPlugin] });
}

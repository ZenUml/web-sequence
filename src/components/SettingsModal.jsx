import React from 'react';
import { editorThemes } from '../editorThemes';
import * as Dialog from '@radix-ui/react-dialog';
import { clsx } from 'clsx';
import * as Select from '@radix-ui/react-select';
import * as RadioGroup from '@radix-ui/react-radio-group';

function CheckboxSetting({
  title,
  label,
  onChange,
  pref,
  name,
  showWhenExtension,
}) {
  return (
    <div className="flex gap-2 items-center">
      <label
        for={name}
        className={clsx(
          showWhenExtension ? 'show-when-extension' : '',
          'h-5 w-11 relative',
        )}
        title={title}
      >
        <input
          id={name}
          type="checkbox"
          className="opacity-0 w-0 h-0 peer"
          checked={pref}
          onChange={onChange}
          data-setting={name}
        />{' '}
        <span className="absolute h-full inset-0 left-1 bottom-1 duration-300 rounded-[32px] bg-gray-600 peer-checked:bg-primary before:absolute before:w-4 before:h-4 before:left-[2px] before:bottom-[2px] before:bg-white before:rounded-full before:duration-300 peer-checked:before:translate-x-[20px]"></span>
      </label>
      <label for={name}>{label}</label>
    </div>
  );
}

export default function SettingsModal(props) {
  const updateSetting = (e) => {
    console.log(e)(e);
  };

  return (
    <Dialog.Root open={props.open} onOpenChange={props.onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-black/50 backdrop-blur-sm data-[state=open]:animate-overlayShow fixed inset-0" />
        <Dialog.Content className="text-sm overflow-y-auto text-gray-500 data-[state=open]:animate-contentShow fixed top-[50%] left-[50%] max-h-[85vh] w-[90vw] overflow-hidden max-w-[650px] translate-x-[-50%] translate-y-[-50%] rounded-[6px] bg-black-400 p-[25px] shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] focus:outline-none">
          <Dialog.Title className="font-medium text-xl font-semibold">
            Keyboard Shortcuts
          </Dialog.Title>
          <div className="my-6">
            <h3 class="text-lg font-semibold mb-3">Indentation</h3>
            <div
              class="my-3 flex justify-between"
              title="I know this is tough, but you have to decide one!"
            >
              <div>Indentation style</div>
              <RadioGroup.Root
                className="flex gap-6"
                defaultValue={props.prefs.indentation}
                aria-label="View density"
                onValueChange={(value) =>
                  props.onChange({
                    settingName: 'indentation',
                    value,
                  })
                }
              >
                <div className="flex items-center">
                  <RadioGroup.Item
                    className="cursor-pointer  bg-gray-600 data-[state=checked]:bg-white w-5 h-5 rounded-full hover:bg-primary duration-200 hover:scale-95 outline-none cursor-default"
                    value="spaces"
                    id="Spaces"
                  >
                    <RadioGroup.Indicator className="flex items-center justify-center w-full h-full relative after:content-[''] after:block after:w-2.5 after:h-2.5 after:rounded-[50%] after:bg-primary" />
                  </RadioGroup.Item>
                  <label className="ml-3 " htmlFor="Spaces">
                    Spaces
                  </label>
                </div>
                <div className="flex items-center">
                  <RadioGroup.Item
                    className="cursor-pointer bg-gray-600 data-[state=checked]:bg-white w-5 h-5 rounded-full hover:bg-primary duration-200 hover:scale-95 outline-none cursor-default"
                    value="tabs"
                    id="tabs"
                  >
                    <RadioGroup.Indicator className="flex items-center justify-center w-full h-full relative after:content-[''] after:block after:w-2.5 after:h-2.5 after:rounded-[50%] after:bg-primary" />
                  </RadioGroup.Item>
                  <label className="ml-3 " htmlFor="tabs">
                    Tabs
                  </label>
                </div>
              </RadioGroup.Root>
            </div>
            <div className="my-3 flex justify-between">
              <label>Indentation size</label>
              <Select.Root
                value={props.prefs.indentSize}
                onValueChange={(value) =>
                  props.onChange({
                    settingName: 'indentSize',
                    value,
                  })
                }
              >
                <Select.Trigger className="inline-flex items-center justify-between w-24 rounded px-4 leading-none h-9 gap-1 bg-black-600  shadow-[0_2px_10px] shadow-black/10 hover:bg-mauve3 focus:shadow-[0_0_0_2px] focus:shadow-black data-[placeholder]:text-violet9 outline-none focus:shadow-none">
                  <Select.Value placeholder="Select Processor" />
                  <span className="material-symbols-outlined">
                    keyboard_arrow_down
                  </span>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content
                    position="popper"
                    sideOffset={4}
                    className="max-h-80 w-24 overflow-hidden bg-black-600  rounded-md shadow-[0px_10px_38px_-10px_rgba(22,_23,_24,_0.35),0px_10px_20px_-15px_rgba(22,_23,_24,_0.2)]"
                  >
                    <Select.Viewport className="p-[5px]">
                      <Select.Group>
                        <Select.Item
                          className="py-1.5 px-2 data-[highlighted]:outline-none data-[highlighted]:bg-primary text-sm rounded"
                          value="1"
                        >
                          <Select.ItemText>1</Select.ItemText>
                        </Select.Item>
                        <Select.Item
                          className="py-1.5 px-2 data-[highlighted]:outline-none data-[highlighted]:bg-primary text-sm rounded"
                          value="2"
                        >
                          <Select.ItemText>2</Select.ItemText>
                        </Select.Item>
                        <Select.Item
                          className="py-1.5 px-2 data-[highlighted]:outline-none data-[highlighted]:bg-primary text-sm rounded"
                          value="3"
                        >
                          <Select.ItemText>3</Select.ItemText>
                        </Select.Item>
                        <Select.Item
                          className="py-1.5 px-2 data-[highlighted]:outline-none data-[highlighted]:bg-primary text-sm rounded"
                          value="4"
                        >
                          <Select.ItemText>4</Select.ItemText>
                        </Select.Item>
                        <Select.Item
                          className="py-1.5 px-2 data-[highlighted]:outline-none data-[highlighted]:bg-primary text-sm rounded"
                          value="5"
                        >
                          <Select.ItemText>5</Select.ItemText>
                        </Select.Item>
                        <Select.Item
                          className="py-1.5 px-2 data-[highlighted]:outline-none data-[highlighted]:bg-primary text-sm rounded"
                          value="6"
                        >
                          <Select.ItemText>6</Select.ItemText>
                        </Select.Item>
                        <Select.Item
                          className="py-1.5 px-2 data-[highlighted]:outline-none data-[highlighted]:bg-primary text-sm rounded"
                          value="7"
                        >
                          <Select.ItemText>7</Select.ItemText>
                        </Select.Item>
                      </Select.Group>
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>
            <hr className="my-4 border-black-700" />
            <h3 className="text-lg font-semibold mb-3">Editor</h3>
            <div className="flex flex-col my-4">
              <div className="flex justify-between items-center">
                <label className="line">Preprocessors</label>
                <div className="grid grid-cols-3 gap-1.5">
                  <Select.Root
                    value={props.prefs.htmlMode}
                    onValueChange={(value) =>
                      props.onChange({
                        settingName: 'htmlMode',
                        value,
                      })
                    }
                  >
                    <Select.Trigger className="inline-flex items-center justify-between w-36 rounded px-4 leading-none h-9 gap-1 bg-black-600  shadow-[0_2px_10px] shadow-black/10 hover:bg-mauve3 focus:shadow-[0_0_0_2px] focus:shadow-black data-[placeholder]:text-violet9 outline-none focus:shadow-none">
                      <Select.Value placeholder="Select Processor" />
                      <span className="material-symbols-outlined">
                        keyboard_arrow_down
                      </span>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Content
                        position="popper"
                        sideOffset={4}
                        className="w-36 overflow-hidden bg-black-600  rounded-md shadow-[0px_10px_38px_-10px_rgba(22,_23,_24,_0.35),0px_10px_20px_-15px_rgba(22,_23,_24,_0.2)]"
                      >
                        <Select.Viewport className="p-[5px]">
                          <Select.Group>
                            <Select.Item
                              className="py-1.5 px-2 data-[highlighted]:outline-none data-[highlighted]:bg-primary text-sm rounded"
                              value="html"
                            >
                              <Select.ItemText>HTML</Select.ItemText>
                            </Select.Item>
                            <Select.Item
                              className="py-1.5 px-2 data-[highlighted]:outline-none data-[highlighted]:bg-primary text-sm rounded"
                              value="markdown"
                            >
                              <Select.ItemText>Markdown</Select.ItemText>
                            </Select.Item>
                            <Select.Item
                              className="py-1.5 px-2 data-[highlighted]:outline-none data-[highlighted]:bg-primary text-sm rounded"
                              value="jade"
                            >
                              <Select.ItemText>Pug</Select.ItemText>
                            </Select.Item>
                          </Select.Group>
                        </Select.Viewport>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>
                  <Select.Root
                    value={props.prefs.cssMode}
                    onValueChange={(value) =>
                      props.onChange({
                        settingName: 'cssMode',
                        value,
                      })
                    }
                  >
                    <Select.Trigger className="inline-flex items-center justify-between w-36 rounded px-4 leading-none h-9 gap-1 bg-black-600  shadow-[0_2px_10px] shadow-black/10 hover:bg-mauve3 focus:shadow-[0_0_0_2px] focus:shadow-black data-[placeholder]:text-violet9 outline-none focus:shadow-none">
                      <Select.Value placeholder="Select Processor" />
                      <span className="material-symbols-outlined">
                        keyboard_arrow_down
                      </span>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Content
                        position="popper"
                        sideOffset={4}
                        className="w-36 overflow-hidden bg-black-600  rounded-md shadow-[0px_10px_38px_-10px_rgba(22,_23,_24,_0.35),0px_10px_20px_-15px_rgba(22,_23,_24,_0.2)]"
                      >
                        <Select.Viewport className="p-[5px]">
                          <Select.Group>
                            <Select.Item
                              className="py-1.5 px-2 data-[highlighted]:outline-none data-[highlighted]:bg-primary text-sm rounded"
                              value="css"
                            >
                              <Select.ItemText>CSS</Select.ItemText>
                            </Select.Item>
                            <Select.Item
                              className="py-1.5 px-2 data-[highlighted]:outline-none data-[highlighted]:bg-primary text-sm rounded"
                              value="scss"
                            >
                              <Select.ItemText>SCSS</Select.ItemText>
                            </Select.Item>
                            <Select.Item
                              className="py-1.5 px-2 data-[highlighted]:outline-none data-[highlighted]:bg-primary text-sm rounded"
                              value="sass"
                            >
                              <Select.ItemText>SASS</Select.ItemText>
                            </Select.Item>
                            <Select.Item
                              className="py-1.5 px-2 data-[highlighted]:outline-none data-[highlighted]:bg-primary text-sm rounded"
                              value="stylus"
                            >
                              <Select.ItemText>Stylus</Select.ItemText>
                            </Select.Item>
                            <Select.Item
                              className="py-1.5 px-2 data-[highlighted]:outline-none data-[highlighted]:bg-primary text-sm rounded"
                              value="acss"
                            >
                              <Select.ItemText>Atomic CSS</Select.ItemText>
                            </Select.Item>
                          </Select.Group>
                        </Select.Viewport>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>
                  <Select.Root
                    value={props.prefs.jsMode}
                    onValueChange={(value) =>
                      props.onChange({
                        settingName: 'jsMode',
                        value,
                      })
                    }
                  >
                    <Select.Trigger className="inline-flex items-center justify-between w-36 rounded px-4 leading-none h-9 gap-1 bg-black-600  shadow-[0_2px_10px] shadow-black/10 hover:bg-mauve3 focus:shadow-[0_0_0_2px] focus:shadow-black data-[placeholder]:text-violet9 outline-none focus:shadow-none">
                      <Select.Value placeholder="Select Processor" />
                      <span className="material-symbols-outlined">
                        keyboard_arrow_down
                      </span>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Content
                        position="popper"
                        sideOffset={4}
                        className="w-36 overflow-hidden bg-black-600  rounded-md shadow-[0px_10px_38px_-10px_rgba(22,_23,_24,_0.35),0px_10px_20px_-15px_rgba(22,_23,_24,_0.2)]"
                      >
                        <Select.Viewport className="p-[5px]">
                          <Select.Group>
                            <Select.Item
                              className="py-1.5 px-2 data-[highlighted]:outline-none data-[highlighted]:bg-primary text-sm rounded"
                              value="js"
                            >
                              <Select.ItemText>JavaScript</Select.ItemText>
                            </Select.Item>
                            <Select.Item
                              className="py-1.5 px-2 data-[highlighted]:outline-none data-[highlighted]:bg-primary text-sm rounded"
                              value="coffee"
                            >
                              <Select.ItemText>CoffeeScript</Select.ItemText>
                            </Select.Item>
                            <Select.Item
                              className="py-1.5 px-2 data-[highlighted]:outline-none data-[highlighted]:bg-primary text-sm rounded"
                              value="es6"
                            >
                              <Select.ItemText>ES6 (Babel)</Select.ItemText>
                            </Select.Item>
                            <Select.Item
                              className="py-1.5 px-2 data-[highlighted]:outline-none data-[highlighted]:bg-primary text-sm rounded"
                              value="typescript"
                            >
                              <Select.ItemText>TypeScript</Select.ItemText>
                            </Select.Item>
                          </Select.Group>
                        </Select.Viewport>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>
                </div>
              </div>
              <div className="flex justify-between mt-4">
                <div>Theme</div>
                <Select.Root
                  value={props.prefs.editorTheme}
                  onValueChange={(value) =>
                    props.onChange({
                      settingName: 'editorTheme',
                      value,
                    })
                  }
                >
                  <Select.Trigger className="inline-flex items-center justify-between w-36 rounded px-4 leading-none h-9 gap-1 bg-black-600  shadow-[0_2px_10px] shadow-black/10 hover:bg-mauve3 focus:shadow-[0_0_0_2px] focus:shadow-black data-[placeholder]:text-violet9 outline-none focus:shadow-none">
                    <Select.Value placeholder="Select Processor" />
                    <span className="material-symbols-outlined">
                      keyboard_arrow_down
                    </span>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content
                      position="popper"
                      sideOffset={4}
                      className="w-36 overflow-hidden bg-black-600  rounded-md shadow-[0px_10px_38px_-10px_rgba(22,_23,_24,_0.35),0px_10px_20px_-15px_rgba(22,_23,_24,_0.2)]"
                    >
                      <Select.Viewport className="p-[5px]">
                        <Select.Group>
                          {editorThemes.map((theme) => (
                            <Select.Item
                              className="py-1.5 px-2 data-[highlighted]:outline-none data-[highlighted]:bg-primary text-sm rounded"
                              value={theme}
                            >
                              <Select.ItemText>{theme}</Select.ItemText>
                            </Select.Item>
                          ))}
                        </Select.Group>
                      </Select.Viewport>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
              </div>
              <div className="flex justify-between mt-4">
                <div>Font Family</div>
                <div className="flex flex-col gap-1.5">
                  <Select.Root
                    value={props.prefs.editorFont}
                    onValueChange={(value) =>
                      props.onChange({
                        settingName: 'editorFont',
                        value,
                      })
                    }
                  >
                    <Select.Trigger className="inline-flex items-center justify-between min-w-[144px] rounded px-4 leading-none h-9 gap-1 bg-black-600  shadow-[0_2px_10px] shadow-black/10 hover:bg-mauve3 focus:shadow-[0_0_0_2px] focus:shadow-black data-[placeholder]:text-violet9 outline-none focus:shadow-none">
                      <Select.Value placeholder="Select Processor" />
                      <span className="material-symbols-outlined">
                        keyboard_arrow_down
                      </span>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Content
                        position="popper"
                        sideOffset={4}
                        className="max-h-80 min-w-36 overflow-hidden bg-black-600  rounded-md shadow-[0px_10px_38px_-10px_rgba(22,_23,_24,_0.35),0px_10px_20px_-15px_rgba(22,_23,_24,_0.2)]"
                      >
                        <Select.ScrollUpButton className="flex items-center justify-center h-[25px] bg-white text-violet11 cursor-default">
                          up
                        </Select.ScrollUpButton>
                        <Select.Viewport className="p-[5px]">
                          <Select.Group>
                            <Select.Item
                              className="py-1.5 px-2 data-[highlighted]:outline-none data-[highlighted]:bg-primary text-sm rounded"
                              value="FiraCode"
                            >
                              <Select.ItemText>Fira Code</Select.ItemText>
                            </Select.Item>
                            <Select.Item
                              className="py-1.5 px-2 data-[highlighted]:outline-none data-[highlighted]:bg-primary text-sm rounded"
                              value="Inconsolata"
                            >
                              <Select.ItemText>Inconsolata</Select.ItemText>
                            </Select.Item>
                            <Select.Item
                              className="py-1.5 px-2 data-[highlighted]:outline-none data-[highlighted]:bg-primary text-sm rounded"
                              value="Monoid"
                            >
                              <Select.ItemText>Monoid</Select.ItemText>
                            </Select.Item>
                            <Select.Item
                              className="py-1.5 px-2 data-[highlighted]:outline-none data-[highlighted]:bg-primary text-sm rounded"
                              value="FixedSys"
                            >
                              <Select.ItemText>FixedSys</Select.ItemText>
                            </Select.Item>
                            <Select.Separator className="h-[1px] bg-black-400 m-[5px]" />
                            <Select.Item
                              className="py-1.5 px-2 data-[highlighted]:outline-none data-[highlighted]:bg-primary text-sm rounded"
                              value="other"
                            >
                              <Select.ItemText>
                                Other fonts from system
                              </Select.ItemText>
                            </Select.Item>
                          </Select.Group>
                        </Select.Viewport>
                        <Select.ScrollDownButton className="flex items-center justify-center h-[25px] bg-white text-violet11 cursor-default">
                          down
                        </Select.ScrollDownButton>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>
                  {props.prefs.editorFont === 'other' && (
                    <input
                      id="customEditorFontInput"
                      type="text"
                      className="px-3 py-2 h-9 bg-black-600 text-sm appearance-none outline-0 border-none placeholder:text-sm placeholder:text-gray-500"
                      value={props.prefs.editorCustomFont}
                      placeholder="Custom font name here"
                      data-setting="editorCustomFont"
                      onChange={(e) =>
                        props.onChange({
                          settingName: 'editorFont',
                          value: e.target.value,
                        })
                      }
                    />
                  )}
                </div>
              </div>
              <div className="flex justify-between mt-4">
                <div>Font Size</div>
                <Select.Root
                  value={props.prefs.fontSize}
                  onValueChange={(value) =>
                    props.onChange({
                      settingName: 'fontSize',
                      value,
                    })
                  }
                >
                  <Select.Trigger className="inline-flex items-center justify-between w-36 rounded px-4 leading-none h-9 gap-1 bg-black-600  shadow-[0_2px_10px] shadow-black/10 hover:bg-mauve3 focus:shadow-[0_0_0_2px] focus:shadow-black data-[placeholder]:text-violet9 outline-none focus:shadow-none">
                    <Select.Value placeholder="Select Processor" />
                    <span className="material-symbols-outlined">
                      keyboard_arrow_down
                    </span>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content
                      position="popper"
                      sideOffset={4}
                      className="max-h-80 w-36 overflow-hidden bg-black-600  rounded-md shadow-[0px_10px_38px_-10px_rgba(22,_23,_24,_0.35),0px_10px_20px_-15px_rgba(22,_23,_24,_0.2)]"
                    >
                      <Select.Viewport className="p-[5px]">
                        <Select.Group>
                          <Select.Item
                            className="py-1.5 px-2 data-[highlighted]:outline-none data-[highlighted]:bg-primary text-sm rounded"
                            value="12"
                          >
                            <Select.ItemText>12 px</Select.ItemText>
                          </Select.Item>
                          <Select.Item
                            className="py-1.5 px-2 data-[highlighted]:outline-none data-[highlighted]:bg-primary text-sm rounded"
                            value="13"
                          >
                            <Select.ItemText>13 px</Select.ItemText>
                          </Select.Item>
                          <Select.Item
                            className="py-1.5 px-2 data-[highlighted]:outline-none data-[highlighted]:bg-primary text-sm rounded"
                            value="14"
                          >
                            <Select.ItemText>14 px</Select.ItemText>
                          </Select.Item>
                          <Select.Item
                            className="py-1.5 px-2 data-[highlighted]:outline-none data-[highlighted]:bg-primary text-sm rounded"
                            value="15"
                          >
                            <Select.ItemText>15 px</Select.ItemText>
                          </Select.Item>
                          <Select.Item
                            className="py-1.5 px-2 data-[highlighted]:outline-none data-[highlighted]:bg-primary text-sm rounded"
                            value="16"
                          >
                            <Select.ItemText>16 px</Select.ItemText>
                          </Select.Item>
                          <Select.Item
                            className="py-1.5 px-2 data-[highlighted]:outline-none data-[highlighted]:bg-primary text-sm rounded"
                            value="17"
                          >
                            <Select.ItemText>17 px</Select.ItemText>
                          </Select.Item>
                          <Select.Item
                            className="py-1.5 px-2 data-[highlighted]:outline-none data-[highlighted]:bg-primary text-sm rounded"
                            value="18"
                          >
                            <Select.ItemText>18 px</Select.ItemText>
                          </Select.Item>
                        </Select.Group>
                      </Select.Viewport>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
              </div>
              <div className="my-4 flex justify-between">
                <div>Key bindings</div>
                <RadioGroup.Root
                  className="flex gap-6"
                  defaultValue={props.prefs.keymap}
                  aria-label="View density"
                  onValueChange={(value) =>
                    props.onChange({
                      settingName: 'keymap',
                      value,
                    })
                  }
                >
                  <div className="flex items-center">
                    <RadioGroup.Item
                      className="cursor-pointer  bg-gray-600 data-[state=checked]:bg-white w-5 h-5 rounded-full hover:bg-primary duration-200 hover:scale-95 outline-none cursor-default"
                      value="sublime"
                      id="r1"
                    >
                      <RadioGroup.Indicator className="flex items-center justify-center w-full h-full relative after:content-[''] after:block after:w-2.5 after:h-2.5 after:rounded-[50%] after:bg-primary" />
                    </RadioGroup.Item>
                    <label className="ml-3 " htmlFor="r1">
                      Sublime
                    </label>
                  </div>
                  <div className="flex items-center">
                    <RadioGroup.Item
                      className="cursor-pointer bg-gray-600 data-[state=checked]:bg-white w-5 h-5 rounded-full hover:bg-primary duration-200 hover:scale-95 outline-none cursor-default"
                      value="vim"
                      id="r2"
                    >
                      <RadioGroup.Indicator className="flex items-center justify-center w-full h-full relative after:content-[''] after:block after:w-2.5 after:h-2.5 after:rounded-[50%] after:bg-primary" />
                    </RadioGroup.Item>
                    <label className="ml-3 " htmlFor="r2">
                      Vim
                    </label>
                  </div>
                </RadioGroup.Root>
              </div>
            </div>
            <hr className="my-4 border-black-700" />
            <div>
              <div className="text-lg font-semibold mb-3">Others</div>
              <div className="grid grid-cols-2 gap-3">
                <CheckboxSetting
                  name="lineWrap"
                  title="Toggle wrapping of long sentences onto new line"
                  label="Line wrap"
                  pref={props.prefs.lineWrap}
                  onChange={(e) => {
                    props.onChange({
                      settingName: 'lineWrap',
                      value: e.target.checked,
                    });
                  }}
                />
                <CheckboxSetting
                  name="autoCloseTags"
                  title="Add the closing tag automatically on seeing an opening tag in HTML"
                  label="Auto-close tags"
                  pref={props.prefs.autoCloseTags}
                  onChange={(e) => {
                    props.onChange({
                      settingName: 'autoCloseTags',
                      value: e.target.checked,
                    });
                  }}
                />
                <CheckboxSetting
                  name="refreshOnResize"
                  title="Your Preview will refresh when you resize the preview split"
                  label="Refresh preview on resize"
                  pref={props.prefs.refreshOnResize}
                  onChange={(e) => {
                    props.onChange({
                      settingName: 'refreshOnResize',
                      value: e.target.checked,
                    });
                  }}
                />
                <CheckboxSetting
                  name="autoComplete"
                  title="Turns on the auto-completion suggestions as you type"
                  label="Auto-complete suggestions"
                  pref={props.prefs.autoComplete}
                  onChange={(e) => {
                    props.onChange({
                      settingName: 'autoComplete',
                      value: e.target.checked,
                    });
                  }}
                />
                <CheckboxSetting
                  name="autoPreview"
                  title="Refreshes the preview as you code. Otherwise use the Run button"
                  label="Auto-preview"
                  pref={props.prefs.autoPreview}
                  onChange={(e) => {
                    props.onChange({
                      settingName: 'autoPreview',
                      value: e.target.checked,
                    });
                  }}
                />
                <CheckboxSetting
                  name="preserveLastCode"
                  title="Loads the last open creation when app starts"
                  label="Preserve last written code"
                  pref={props.prefs.preserveLastCode}
                  onChange={(e) => {
                    props.onChange({
                      settingName: 'preserveLastCode',
                      value: e.target.checked,
                    });
                  }}
                />
                <CheckboxSetting
                  name="replaceNewTab"
                  title="Turning this on will start showing ZenUML in every new tab you open"
                  label="Replace new tab page"
                  pref={props.prefs.replaceNewTab}
                  onChange={(e) => {
                    props.onChange({
                      settingName: 'replaceNewTab',
                      value: e.target.checked,
                    });
                  }}
                />
                <CheckboxSetting
                  name="preserveConsoleLogs"
                  title="Preserves the console logs across your preview refreshes"
                  label="Preserve console logs"
                  pref={props.prefs.preserveConsoleLogs}
                  onChange={(e) => {
                    props.onChange({
                      settingName: 'preserveConsoleLogs',
                      value: e.target.checked,
                    });
                  }}
                />
                <CheckboxSetting
                  name="lightVersion"
                  title="Switch to lighter version for better performance. Removes things like blur etc."
                  label="Fast/light version"
                  pref={props.prefs.lightVersion}
                  onChange={(e) => {
                    props.onChange({
                      settingName: 'lightVersion',
                      value: e.target.checked,
                    });
                  }}
                />
              </div>
            </div>
          </div>
          <Dialog.Close asChild>
            <button
              className="hover:bg-black-600/30 text-gray-100 absolute top-7 right-6 inline-flex h-8 w-8 p-1.5 hover:bg-gray-600 appearance-none items-center justify-center rounded-md outline-none"
              aria-label="Close"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

import React, { Component } from 'react';

class Toolbox extends Component {
  insertCode(param) {
    this.props.clickSvg(param);
  }

  render() {
    return (
      <div className="flex gap-6 px-10 py-2 bg-black-400 flex-wrap">
        <button className="hover:bg-black-600 p-1 h-7 w-7 rounded-lg flex items-center justify-between">
          <svg
            id="addNewParticipantButton"
            width="100%"
            height="100%"
            viewBox="0 0 50 50"
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            xmlnsXlink="http://www.w3.org/1999/xlink"
            onClick={() => {
              this.insertCode('NewParticipant');
            }}
          >
            <title>New participant</title>
            <g stroke="none" stroke-width="4" fill="none" fill-rule="evenodd">
              <g id="Participant-Copy" stroke="#A5A5A5">
                <rect
                  id="Rectangle"
                  x="8.5"
                  y="4.5"
                  width="34"
                  height="10"
                  rx="3"
                />
                <path
                  d="M25.5,15 L25.5,47.5"
                  id="Line"
                  stroke-linecap="square"
                  stroke-dasharray="5"
                />
              </g>
            </g>
          </svg>
        </button>
        <button className="hover:bg-black-600 p-1 h-7 w-7 rounded-lg flex items-center justify-between">
          <svg
            id="addAsyncMessageButton"
            width="100%"
            height="100%"
            viewBox="0 0 50 50"
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            xmlnsXlink="http://www.w3.org/1999/xlink"
            onClick={() => {
              this.insertCode('A->B:message');
            }}
          >
            <title>Async message</title>
            <g stroke="none" stroke-width="4" fill="none" fill-rule="evenodd">
              <g id="Message-Copy">
                <path
                  d="M40.5,5 L40.5,47"
                  id="Line"
                  stroke="#A5A5A5"
                  stroke-linecap="square"
                  stroke-dasharray="5"
                />
                <path
                  d="M11.6315789,20 L37,20"
                  id="Line-2"
                  stroke="#A5A5A5"
                  stroke-width="4"
                  stroke-linecap="square"
                />
                <path
                  d="M31.9736842,13.7258398 L37.5869926,25.0263158 L26.3603759,25.0263158 L31.9736842,13.7258398 Z"
                  id="Triangle"
                  stroke="#A5A5A5"
                  stroke-width="4"
                  transform="translate(31.973684, 20.000000) rotate(90.000000) translate(-31.973684, -20.000000) "
                />
                <path
                  d="M9.5,5 L9.5,47"
                  id="Line"
                  stroke="#A5A5A5"
                  stroke-linecap="square"
                  stroke-dasharray="5"
                />
                <rect
                  id="Rectangle"
                  fill="#A5A5A5"
                  x="25"
                  y="13"
                  width="3"
                  height="6"
                />
                <rect
                  id="Rectangle"
                  fill="#A5A5A5"
                  x="25"
                  y="21"
                  width="3"
                  height="6"
                />
              </g>
            </g>
          </svg>
        </button>
        <button className="hover:bg-black-600 p-1 h-7 w-7 rounded-lg flex items-center justify-between">
          <svg
            id="addSyncMessageButton"
            width="100%"
            height="100%"
            viewBox="0 0 50 50"
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            xmlnsXlink="http://www.w3.org/1999/xlink"
            onClick={() => {
              this.insertCode('A.message {\n}');
            }}
          >
            <title>Sync message</title>
            <g stroke="none" stroke-width="4" fill="none" fill-rule="evenodd">
              <g id="Execution-Copy" stroke="#A5A5A5">
                <path
                  d="M40.5,5 L40.5,47"
                  id="Line"
                  stroke-linecap="square"
                  stroke-dasharray="5"
                />
                <rect
                  id="Rectangle"
                  fill="#A5A5A5"
                  x="37.5"
                  y="20.5"
                  width="6"
                  height="13"
                />
                <path
                  d="M11.6315789,20 L34.3684211,20"
                  id="Line-2"
                  stroke-width="4"
                  stroke-linecap="square"
                />
                <polygon
                  id="Triangle"
                  stroke-width="4"
                  fill="#A5A5A5"
                  transform="translate(32.473684, 20.000000) rotate(90.000000) translate(-32.473684, -20.000000) "
                  points="32.4736842 15.4736842 36.4736842 24.5263158 28.4736842 24.5263158"
                />
                <path
                  d="M9.5,5 L9.5,47"
                  id="Line"
                  stroke-linecap="square"
                  stroke-dasharray="5"
                />
              </g>
            </g>
          </svg>
        </button>
        <button className="hover:bg-black-600 p-1 h-7 w-7 rounded-lg flex items-center justify-between">
          <svg
            id="addReturnValueButton"
            width="100%"
            height="100%"
            viewBox="0 0 50 50"
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            xmlnsXlink="http://www.w3.org/1999/xlink"
            onClick={() => {
              this.insertCode('result = A.message {\n}');
            }}
          >
            <title>Return value</title>
            <g
              id="Execution-Copy-4"
              stroke="none"
              stroke-width="4"
              fill="none"
              fill-rule="evenodd"
            >
              <path
                d="M40.5,5 L40.5,47"
                id="Line"
                stroke="#A5A5A5"
                stroke-linecap="square"
                stroke-dasharray="5"
              />
              <rect
                id="Rectangle"
                stroke="#A5A5A5"
                fill="#A5A5A5"
                x="37.5"
                y="20.5"
                width="6"
                height="13"
              />
              <path
                d="M11.6315789,20 L34.3684211,20"
                id="Line-2"
                stroke="#A5A5A5"
                stroke-width="4"
                stroke-linecap="square"
              />
              <polygon
                id="Triangle"
                stroke="#A5A5A5"
                stroke-width="4"
                fill="#A5A5A5"
                transform="translate(32.473684, 20.000000) rotate(90.000000) translate(-32.473684, -20.000000) "
                points="32.4736842 15.4736842 36.4736842 24.5263158 28.4736842 24.5263158"
              />
              <path
                d="M9.5,5 L9.5,47"
                id="Line"
                stroke="#A5A5A5"
                stroke-linecap="square"
                stroke-dasharray="5"
              />
              <path
                d="M36.5,34 L17.0526316,34"
                id="Line"
                stroke="#A5A5A5"
                stroke-width="4"
                stroke-linecap="square"
                stroke-dasharray="3"
              />
              <path
                d="M11.5,34 L18,34"
                id="Line-2-Copy"
                stroke="#A5A5A5"
                stroke-width="4"
                stroke-linecap="square"
                transform="translate(15.000000, 34.000000) rotate(-180.000000) translate(-15.000000, -34.000000) "
              />
              <g
                id="Group-Copy"
                transform="translate(19.500000, 34.000000) rotate(-180.000000) translate(-19.500000, -34.000000) translate(14.000000, 27.000000)"
              >
                <path
                  d="M6.97368421,0.725839752 L12.5869926,12.0263158 L1.36037585,12.0263158 L6.97368421,0.725839752 Z"
                  id="Triangle"
                  stroke="#A5A5A5"
                  stroke-width="4"
                  transform="translate(6.973684, 7.000000) rotate(90.000000) translate(-6.973684, -7.000000) "
                />
                <path
                  d="M6.97368421,0.725839752 L12.5869926,12.0263158 L1.36037585,12.0263158 L6.97368421,0.725839752 Z"
                  id="Triangle-Copy"
                  stroke="#A5A5A5"
                  stroke-width="4"
                  transform="translate(6.973684, 7.000000) rotate(90.000000) translate(-6.973684, -7.000000) "
                />
                <rect
                  id="Rectangle"
                  fill="#A5A5A5"
                  x="0"
                  y="0"
                  width="3"
                  height="6"
                />
                <rect
                  id="Rectangle"
                  fill="#A5A5A5"
                  x="0"
                  y="8"
                  width="3"
                  height="6"
                />
              </g>
            </g>
          </svg>
        </button>
        <button className="hover:bg-black-600 p-1 h-7 w-7 rounded-lg flex items-center justify-between">
          <svg
            id="addSelfMessageButton"
            width="100%"
            height="100%"
            viewBox="0 0 50 50"
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            xmlnsXlink="http://www.w3.org/1999/xlink"
            onClick={() => {
              this.insertCode('A.message() {\n  selfMessage()\n}');
            }}
          >
            <title>Self message</title>
            <g
              id="Execution-Copy-2"
              stroke="none"
              stroke-width="4"
              fill="none"
              fill-rule="evenodd"
            >
              <path
                d="M20.5,4 L20.5,46"
                id="Line"
                stroke="#A5A5A5"
                stroke-linecap="square"
                stroke-dasharray="5"
              />
              <rect
                id="Rectangle"
                stroke="#A5A5A5"
                fill="#A5A5A5"
                x="17.5"
                y="24.5"
                width="6"
                height="13"
              />
              <g
                id="Group-2"
                transform="translate(20.000000, 12.000000)"
                stroke="#A5A5A5"
                stroke-width="4"
              >
                <g id="Group">
                  <path d="M1,1 L23,1" id="Line-2" stroke-linecap="square" />
                  <path
                    d="M17.0526316,12.5 L22.5,12.5"
                    id="Line-2"
                    stroke-linecap="square"
                  />
                  <path d="M23,12 L23,1" id="Line-2" stroke-linecap="square" />
                  <polygon
                    id="Triangle"
                    fill="#A5A5A5"
                    transform="translate(10.526316, 12.000000) rotate(270.000000) translate(-10.526316, -12.000000) "
                    points="10.5263158 7.47368421 14.5263158 16.5263158 6.52631579 16.5263158"
                  />
                </g>
              </g>
            </g>
          </svg>
        </button>
        <button className="hover:bg-black-600 p-1 h-7 w-7 rounded-lg flex items-center justify-between">
          <svg
            id="addNewInstanceButton"
            width="100%"
            height="100%"
            viewBox="0 0 50 50"
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            xmlnsXlink="http://www.w3.org/1999/xlink"
            onClick={() => {
              this.insertCode('a = new A()');
            }}
          >
            <title>New instance</title>
            <g stroke="none" stroke-width="4" fill="none" fill-rule="evenodd">
              <g id="Creation-Copy">
                <path
                  d="M40.5,32 L40.5,49"
                  id="Line"
                  stroke="#A5A5A5"
                  stroke-linecap="square"
                  stroke-dasharray="5"
                />
                <path
                  d="M11.6315789,26 L29,26"
                  id="Line-2"
                  stroke="#A5A5A5"
                  stroke-width="4"
                  fill="#A5A5A5"
                  stroke-linecap="square"
                />
                <polygon
                  id="Triangle"
                  stroke="#A5A5A5"
                  stroke-width="4"
                  fill="#A5A5A5"
                  transform="translate(28.526316, 26.000000) rotate(90.000000) translate(-28.526316, -26.000000) "
                  points="28.5263158 21.4736842 32.5263158 30.5263158 24.5263158 30.5263158"
                />
                <path
                  d="M9.5,5 L9.5,47"
                  id="Line"
                  stroke="#A5A5A5"
                  stroke-linecap="square"
                  stroke-dasharray="5"
                />
                <rect
                  id="Rectangle"
                  stroke="#A5A5A5"
                  x="35.5"
                  y="20.5"
                  width="10"
                  height="10"
                  rx="3"
                />
              </g>
            </g>
          </svg>
        </button>
        <button className="hover:bg-black-600 p-1 h-7 w-7 rounded-lg flex items-center justify-between">
          <svg
            id="addConditionalButton"
            width="100%"
            height="100%"
            viewBox="0 0 50 50"
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            xmlnsXlink="http://www.w3.org/1999/xlink"
            onClick={() => {
              this.insertCode('if(condition) {\n  A.method()\n}');
            }}
          >
            <title>Conditional</title>
            <g stroke="none" stroke-width="4" fill="none" fill-rule="evenodd">
              <g id="Alt-Copy">
                <rect
                  id="Rectangle"
                  stroke="#A5A5A5"
                  x="4.5"
                  y="8.5"
                  width="40"
                  height="35"
                />
                <path
                  d="M5.57147686,20.9013672 L22,21"
                  id="Line-3"
                  stroke="#A5A5A5"
                  stroke-linecap="square"
                />
                <text
                  id="Alt"
                  font-family="Arial-Black, Arial Black"
                  font-size="14"
                  font-weight="700"
                  fill="#A5A5A5"
                >
                  <tspan x="14" y="37">
                    Alt
                  </tspan>
                </text>
                <path
                  d="M25.5,15.2006836 L22.1101562,20.9013672"
                  id="Line-3"
                  stroke="#A5A5A5"
                  stroke-linecap="square"
                />
                <path
                  d="M25.5,15.2006836 L25.5,9"
                  id="Line-4"
                  stroke="#A5A5A5"
                  stroke-linecap="square"
                />
              </g>
            </g>
          </svg>
        </button>
        <button className="hover:bg-black-600 p-1 h-7 w-7 rounded-lg flex items-center justify-between">
          <svg
            id="addLoopButton"
            width="100%"
            height="100%"
            viewBox="0 0 50 50"
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            xmlnsXlink="http://www.w3.org/1999/xlink"
            onClick={() =>
              this.insertCode('while(condition) {\n  A.method()\n}')
            }
          >
            <title>Loop</title>
            <g stroke="none" strokeWidth="4" fill="none" fill-rule="evenodd">
              <g id="Loop-Copy">
                <rect
                  id="Rectangle"
                  stroke="#A5A5A5"
                  x="4.5"
                  y="8.5"
                  width="40"
                  height="35"
                />
                <path
                  d="M5.57147686,20.9013672 L22,21"
                  id="Line-3"
                  stroke="#A5A5A5"
                  stroke-linecap="square"
                />
                <text
                  id="Loop"
                  font-family="Arial-Black, Arial Black"
                  font-size="14"
                  font-weight="700"
                  fill="#A5A5A5"
                >
                  <tspan x="6" y="37">
                    Loop
                  </tspan>
                </text>
                <path
                  d="M25.5,15.2006836 L22.1101562,20.9013672"
                  id="Line-3"
                  stroke="#A5A5A5"
                  stroke-linecap="square"
                />
                <path
                  d="M25.5,15.2006836 L25.5,9"
                  id="Line-4"
                  stroke="#A5A5A5"
                  stroke-linecap="square"
                />
              </g>
            </g>
          </svg>
        </button>
        <button className="hover:bg-black-600 p-1 h-7 w-7 rounded-lg flex items-center justify-between">
          <svg
            width="100%"
            height="16"
            viewBox="0 0 20 16"
            fill="none"
            onClick={() => {
              this.insertCode('//Note\nA.message()');
            }}
          >
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M1.9998 14.3999H18.3998V4.82084L15.8231 1.5999H1.9998V14.3999ZM16.3998 0.399902L19.5998 4.3999V15.5999H0.799805V0.399902H16.3998Z"
              fill="#C2C2C2"
            />
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M15 0.799805H16.2V4.1998H19.2V5.3998H15V0.799805Z"
              fill="#C2C2C2"
            />
          </svg>
        </button>
      </div>
    );
  }
}

export default Toolbox;

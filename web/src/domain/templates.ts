import type { Item } from './types';

// Curated "Create New" templates. Content PORTED VERBATIM from legacy
// src/templates/template-{basic,black-white,blue,starUMLTheme}.json — copying
// title/mainSizes/htmlMode/cssMode/jsMode/js/css/html. The legacy `layoutMode`
// field is intentionally DROPPED (not part of the rewrite's Item model).
//
// NOTE on titles: legacy black-white.json and blue.json BOTH carry the
// item title "Advanced" (distinguished only by id). We keep item.title verbatim
// and use the top-level `title` for the card's display name so the inventory
// reads clearly.
export interface Template {
  id: 'basic' | 'black-white' | 'blue' | 'starUMLTheme';
  title: string;
  // Picker grouping (REQ §04): 'start' = example starters, 'styles' = themed
  // looks. ADDITIVE optional field — does NOT affect template content/ids or the
  // onSelect(item) contract; only drives the CreateNewModal section a card lands
  // in. Defaults to 'styles' when absent.
  group?: 'start' | 'styles';
  item: Partial<Item>;
}

export const TEMPLATES: Template[] = [
  {
    id: 'basic',
    title: 'Basic',
    group: 'start',
    item: {
      title: 'Basic',
      mainSizes: [30, 70],
      htmlMode: 'html',
      cssMode: 'css',
      jsMode: 'js',
      js: '// This is a sample\nA.method() {\n  if(condition) {\n    B.method()\n  }\n}',
      html: '',
    },
  },
  {
    id: 'black-white',
    title: 'Black & White',
    group: 'styles',
    item: {
      title: 'Advanced',
      mainSizes: [30, 70],
      htmlMode: 'html',
      cssMode: 'less',
      jsMode: 'js',
      js: 'Client->SGW."Get order by id" {\n  svc.Get(id) {\n    new X()\n    rep."load order" {\n      =="Start Here"==\n      MF."load order from mainframe"\n      =="End Here"==\n      if(order == null) {\n        @return \n        SGW->Client:404\n      } else {\n        return order\n      }\n      \n      while(true) {\n        svc.refresh(data)\n      }\n      processOrder()\n    }\n    return order\n  }\n  return response\n}',
      css: '@fragmentBorderColor: rgba(0, 0, 0, 0.30);\n@nameBackgroundColor: rgba(0, 0, 0, 0.07);\n@messageLineColor: #000;\n@occuranceBorderColor: #000;\n@occuranceBackgroundColor: #F5F5F5;\n@participantLineColor: rgba(0, 0, 0, 0.40);\n@participantBorderColor: #000;\n@participantBackgroundColor: #fff;\n@dividerBackgroundColor: #000;\n@dividerBorderColor: #000;\n\n#diagram {\n  .sequence-diagram {\n    .divider {\n      .name {\n        padding: 2px 6px 2px 6px;\n        border-radius: 0px;\n        margin: 0px;\n        border-color: @dividerBorderColor;\n        box-shadow: 2px 2px 0px @dividerBorderColor;\n      }\n      .left {\n        background: @dividerBackgroundColor;\n      }\n      .right {\n        background: @dividerBackgroundColor;\n      }\n    }\n    .lifeline {\n      .participant {\n        font-weight: 400;\n        border: 2px solid @participantBorderColor;\n        background: @participantBackgroundColor;  \n        box-shadow: 2px 2px 0px @participantBorderColor;\n        label {\n          text-decoration: underline;\n        }\n      }\n      .line {\n        border-left-color: @participantLineColor;\n      }\n    }\n    .message {\n      .name {\n        padding-bottom: 1px;\n      }\n      border-bottom-color: @messageLineColor;\n      svg {\n        polyline {\n          fill: @messageLineColor;\n          stroke: @messageLineColor;\n        }\n      }\n    }\n    .message.self {\n      svg>polyline:not(.head) {\n        fill: none;\n      }\n    }\n    .occurrence {\n      background-color: white;\n      border: 2px solid @occuranceBorderColor;\n      background-color: @occuranceBackgroundColor;\n    }\n    .fragment {\n      margin-top: 8px;\n      margin-bottom: 8px;\n      border-radius: 0px;\n      border: 1px solid @fragmentBorderColor;\n      .fragment.par>.block>.statement-container:not(:first-child), .segment:not(:first-child) {\n        border-top: 1px solid @fragmentBorderColor;\n      }\n      .header {\n        .name {\n          padding: 4px 4px 4px 6px;\n          background: @nameBackgroundColor;\n          label { /* name label */\n            background: transparent;\n            padding: 0px;\n          }\n        }\n      }\n    }\n    .statement-container {\n      margin-bottom: 8px;\n    }\n  }\n}',
      html: '',
    },
  },
  {
    id: 'blue',
    title: 'Blue',
    group: 'styles',
    item: {
      title: 'Advanced',
      mainSizes: [30, 70],
      htmlMode: 'html',
      cssMode: 'less',
      jsMode: 'js',
      js: 'Client->SGW."Get order by id" {\n  svc.Get(id) {\n    new X()\n    rep."load order" {\n      =="Start Here"==\n      MF."load order from mainframe"\n      =="End Here"==\n      if(order == null) {\n        @return \n        SGW->Client:404\n      } else {\n        return order\n      }\n      \n      while(true) {\n        svc.refresh(data)\n      }\n      processOrder()\n    }\n    return order\n  }\n  return response\n}',
      css: '@fragmentBorderColor: rgba(4, 46, 110, 0.30);\n@nameBackgroundColor: rgba(4, 46, 110, 0.10);\n@labelTextColor: #032C72;\n@messageLineColor: #032C72;\n@occuranceBorderColor: #032C72;\n@occuranceBackgroundColor: #fff;\n@participantLineColor: #032C72;\n@participantBorderColor: #032C72;\n@participantTextColor: #032C72;\n@participantBackgroundColor: rgba(146, 192, 240, 0.30);\n@dividerBackgroundColor: #E28553;\n@dividerBorderColor: #E28553;\n@dividerTextColor: #E28553;\n\n#diagram {\n  .sequence-diagram {\n    .divider {\n      .name {\n        padding: 2px 6px 2px 6px;\n        border-radius: 4px;\n        margin: 0px;\n        border-color: @dividerBorderColor;\n        color: @dividerTextColor;\n      }\n      .left {\n        background: @dividerBackgroundColor;\n      }\n      .right {\n        background: @dividerBackgroundColor;\n      }\n    }\n    .lifeline {\n      .participant {\n        font-weight: 400;\n        border: 2px solid @participantBorderColor;\n        background: @participantBackgroundColor;      \n        label {\n          text-decoration: underline;\n          color: @participantTextColor;\n        }\n      }\n      .line {\n        border-left-color: @participantLineColor;\n      }\n    }\n    .message {\n      .name {\n        padding-bottom: 1px;\n        color: @messageLineColor;\n      }\n      border-bottom-color: @messageLineColor;\n      svg {\n        polyline {\n          fill: @messageLineColor;\n          stroke: @messageLineColor;\n        }\n      }\n    }\n    .message.self {\n      svg>polyline:not(.head) {\n        fill: none;\n      }\n    }\n    .occurrence {\n      background-color: white;\n      border: 2px solid @occuranceBorderColor;\n      background-color: @occuranceBackgroundColor;\n    }\n    .fragment {\n      margin-top: 8px;\n      margin-bottom: 8px;\n      border-radius: 4px;\n      border: 1px solid @fragmentBorderColor;\n      .fragment.par>.block>.statement-container:not(:first-child), .segment:not(:first-child) {\n        border-top: 1px solid @fragmentBorderColor;\n      }\n      .header {\n        .name {\n          padding: 4px 4px 4px 6px;\n          background: @nameBackgroundColor;\n          label { /* name label */\n            background: transparent;\n            padding: 0px;\n            color: @labelTextColor;\n          }\n        }\n      }\n    }\n    .statement-container {\n      margin-bottom: 8px;\n    }\n  }\n}',
      html: '',
    },
  },
  {
    id: 'starUMLTheme',
    title: 'starUML Theme',
    group: 'styles',
    item: {
      title: 'starUML Theme',
      mainSizes: [30, 70],
      htmlMode: 'html',
      cssMode: 'less',
      jsMode: 'js',
      js: '// This is a sample\nA.do() {\n  if (condition1) {\n    X.doSomething()\n  } else if (condition2) {\n    Y.doSomethingElse\n  } else {\n    doNothing()\n  }\n}',
      css: '// This is a sample\n@borderColor: #b94065;\n    #diagram {\n      .sequence-diagram {\n        .lifeline {\n          .participant {\n            font-weight: 400;\n            border: 2px solid @borderColor;\n            background: #fffec8;\n      \n            label {\n              text-decoration: underline;\n            }\n          }\n          .line {\n            border-left-color: @borderColor;\n          }\n         }\n        .message {\n          border-bottom-color: @borderColor;\n          svg {\n            polyline {\n              fill: @borderColor;\n              stroke: @borderColor;\n            }\n          }\n        }\n        .message.self {\n          svg>polyline:not(.head) {\n            fill: none;\n          }\n        }\n        .occurrence {\n          background-color: white;\n          border: 2px solid @borderColor;\n        }\n      }\n    }',
      html: '',
    },
  },
];

// Empty starter for a brand-new blank diagram. No fabricated DSL — genuinely
// empty content with the default editor modes.
export function blankTemplate(): Partial<Item> {
  return {
    js: '',
    css: '',
    html: '',
    htmlMode: 'html',
    cssMode: 'css',
    jsMode: 'js',
  };
}

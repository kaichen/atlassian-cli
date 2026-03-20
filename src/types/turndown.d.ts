declare module "turndown" {
  interface TurndownOptions {
    headingStyle?: "setext" | "atx";
    hr?: string;
    bulletListMarker?: "-" | "+" | "*";
    codeBlockStyle?: "indented" | "fenced";
    fence?: "```" | "~~~";
    emDelimiter?: "_" | "*";
    strongDelimiter?: "**" | "__";
    linkStyle?: "inlined" | "referenced";
    linkReferenceStyle?: "full" | "collapsed" | "shortcut";
    preformattedCode?: boolean;
  }

  type ReplacementFunction = (
    content: string,
    node: unknown,
    options: TurndownOptions,
  ) => string;

  interface Rule {
    filter: string | string[] | ((node: unknown, options: TurndownOptions) => boolean);
    replacement: ReplacementFunction;
  }

  export default class TurndownService {
    constructor(options?: TurndownOptions);
    addRule(key: string, rule: Rule): this;
    keep(filter: string | string[] | ((node: unknown) => boolean)): this;
    remove(filter: string | string[] | ((node: unknown) => boolean)): this;
    use(plugin: ((service: TurndownService) => void) | Array<(service: TurndownService) => void>): this;
    turndown(input: string | unknown): string;
  }
}

declare module "turndown-plugin-gfm" {
  import TurndownService from "turndown";

  type TurndownPlugin = (service: TurndownService) => void;

  export const gfm: TurndownPlugin;
  export const tables: TurndownPlugin;
  export const strikethrough: TurndownPlugin;
  export const taskListItems: TurndownPlugin;
  export const highlightedCodeBlock: TurndownPlugin;
  const plugin: {
    gfm: TurndownPlugin;
    tables: TurndownPlugin;
    strikethrough: TurndownPlugin;
    taskListItems: TurndownPlugin;
    highlightedCodeBlock: TurndownPlugin;
  };
  export default plugin;
}

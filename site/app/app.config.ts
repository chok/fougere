export default defineAppConfig({
  ui: {
    colors: {
      primary: 'fern',
      neutral: 'stone',
    },
    // The package-manager tabs (`modules/managers.ts`): text tabs above the block, the chosen one
    // underlined, the way a terminal's tool is picked rather than a file's.
    prose: {
      // pnpm's own mark draws half its squares in white, which a light page cannot show.
      codeIcon: { pnpm: 'i-vscode-icons-file-type-light-pnpm' },
      codeGroup: {
        slots: {
          root: 'relative my-5',
          list: 'relative flex items-center gap-1 border-0 border-b border-default bg-transparent rounded-none p-0 overflow-x-auto mb-3',
          indicator: 'absolute left-0 inset-y-auto bottom-0 h-0.5 w-(--reka-tabs-indicator-size) translate-x-(--reka-tabs-indicator-position) transition-[translate,width] duration-200 bg-inverted rounded-none shadow-none',
          trigger: 'relative inline-flex items-center gap-2 px-3 pt-1 pb-2.5 text-sm rounded-none text-dimmed hover:bg-transparent hover:text-default data-[state=active]:text-highlighted outline-primary/25 focus-visible:outline-3 transition-colors',
        },
      },
    },
  },
});

'use client';

import { SvgIcon, type SvgIconProps } from '@mui/material';

type IconProps = SvgIconProps;

export const FougereContentIcon = (props: IconProps) => (
  <SvgIcon {...props}><path d="M6 2h9l5 5v15H6a2 2 0 0 1-2-2V4c0-1.1.9-2 2-2Zm8 2H6v16h12V8h-4V4Zm-6 7h8v2H8v-2Zm0 4h8v2H8v-2Z" /></SvgIcon>
);
export const DraftIcon = (props: IconProps) => (
  <SvgIcon {...props}><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1 11H7v-2h4V5h2v8Z" /></SvgIcon>
);
export const PublishedIcon = (props: IconProps) => (
  <SvgIcon {...props}><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z" /></SvgIcon>
);
export const FougereUsersIcon = (props: IconProps) => (
  <SvgIcon {...props}><path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3Zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3Zm0 2c-2.33 0-7 1.17-7 3.5V19h10v-2.5c0-.87.34-1.62.91-2.26C10.55 13.41 8.9 13 8 13Zm8 0c-.9 0-2.55.41-3.91 1.24.57.64.91 1.39.91 2.26V19h10v-2.5c0-2.33-4.67-3.5-7-3.5Z" /></SvgIcon>
);
export const ArrowIcon = (props: IconProps) => (
  <SvgIcon {...props}><path d="m9.3 5.3 6.7 6.7-6.7 6.7-1.4-1.4 5.3-5.3-5.3-5.3 1.4-1.4Z" /></SvgIcon>
);
export const AddIcon = (props: IconProps) => (
  <SvgIcon {...props}><path d="M11 5h2v14h-2zM5 11h14v2H5z" /></SvgIcon>
);

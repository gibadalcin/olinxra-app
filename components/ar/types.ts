export type ARPreviewProps = {
  html: string;
  baseUrl: string;
  webRef: any;
  onMessageHandler: (e: any) => void;
  styles: any;
  screenHeight: number;
  normalizedKey?: string | null;
};

export type ARLauncherProps = {
  isReady: boolean;
  statusMessage: string;
  onLaunch: () => void;
  styles: any;
  showButton?: boolean;
};

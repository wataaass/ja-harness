export type ConfirmRequest = {
  tool: string;
  title: string;
  detail: string;
};

export type Confirm = (request: ConfirmRequest) => Promise<boolean>;

export type ConfirmRequest = {
  tool: string;
  title: string;
  detail: string;
  outside?: boolean;
  hunks?: string[][];
};

export type Decision = {
  allow: boolean;
  always?: boolean;
  reason?: string;
  acceptedHunks?: boolean[];
};

export type Confirm = (request: ConfirmRequest) => Promise<boolean | Decision>;

export function toDecision(value: boolean | Decision): Decision {
  if (typeof value === "boolean") {
    return { allow: value };
  }
  return value;
}

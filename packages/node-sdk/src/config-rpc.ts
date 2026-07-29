import {
  createRPC,
  ErrorCodes,
  MultiAIError,
  parseConfigString,
  resolveConfigPath,
  type RPCMethods,
} from '@multiai/agent-core';
import { z } from 'zod';

export type MultiAIConfigValidationPathSegment = string | number;

export interface MultiAIConfigValidationIssue {
  readonly path: readonly MultiAIConfigValidationPathSegment[];
  readonly message: string;
}

export interface ResolveMultiAIConfigPathInput {
  readonly homeDir?: string | undefined;
  readonly configPath?: string | undefined;
}

export interface ValidateMultiAIConfigTomlInput {
  readonly text: string;
  readonly filePath?: string | undefined;
}

export interface MultiAIConfigRpc {
  resolveConfigPath(input?: ResolveMultiAIConfigPathInput): Promise<string>;
  validateConfigToml(input: ValidateMultiAIConfigTomlInput): Promise<void>;
}

interface MultiAIConfigCoreRpc {
  resolveConfigPath(input: ResolveMultiAIConfigPathInput): string;
  validateConfigToml(input: ValidateMultiAIConfigTomlInput): void;
}

interface MultiAIConfigClientRpc {}

class MultiAIConfigCoreRpcImpl implements MultiAIConfigCoreRpc {
  resolveConfigPath(input: ResolveMultiAIConfigPathInput): string {
    return resolveConfigPath(input);
  }

  validateConfigToml(input: ValidateMultiAIConfigTomlInput): void {
    try {
      parseConfigString(input.text, input.filePath);
    } catch (error) {
      const validationIssues = extractValidationIssues(error);
      if (validationIssues !== undefined) {
        throw toConfigValidationError(error, validationIssues);
      }
      throw error;
    }
  }
}

export class MultiAIConfigRpcClient implements MultiAIConfigRpc {
  private readonly ready: Promise<RPCMethods<MultiAIConfigCoreRpc>>;

  constructor() {
    const [coreRpc, clientRpc] = createRPC<MultiAIConfigCoreRpc, MultiAIConfigClientRpc>();
    void coreRpc(new MultiAIConfigCoreRpcImpl());
    this.ready = clientRpc({});
  }

  async resolveConfigPath(input: ResolveMultiAIConfigPathInput = {}): Promise<string> {
    const rpc = await this.ready;
    return rpc.resolveConfigPath(input);
  }

  async validateConfigToml(input: ValidateMultiAIConfigTomlInput): Promise<void> {
    const rpc = await this.ready;
    await rpc.validateConfigToml(input);
  }
}

export function createMultiAIConfigRpc(): MultiAIConfigRpc {
  return new MultiAIConfigRpcClient();
}

function toConfigValidationError(
  error: unknown,
  validationIssues: readonly MultiAIConfigValidationIssue[],
): MultiAIError {
  const details =
    error instanceof MultiAIError && error.details !== undefined
      ? { ...error.details, validationIssues }
      : { validationIssues };

  if (error instanceof MultiAIError) {
    return new MultiAIError(error.code, error.message, { details });
  }

  const message = error instanceof Error ? error.message : String(error);
  return new MultiAIError(ErrorCodes.CONFIG_INVALID, message, { details });
}

function extractValidationIssues(error: unknown): readonly MultiAIConfigValidationIssue[] | undefined {
  const zodError = findZodError(error);
  if (zodError === undefined) return undefined;
  return zodError.issues.map((issue) => ({
    path: issue.path.map((segment) =>
      typeof segment === 'number' ? segment : String(segment),
    ),
    message: issue.message,
  }));
}

function findZodError(error: unknown): z.ZodError | undefined {
  if (error instanceof z.ZodError) return error;
  if (error instanceof Error && error.cause instanceof z.ZodError) return error.cause;
  return undefined;
}
